# @andy-toolforge/llm-gateway — Design Specification

## Overview

Extract the LLM orchestration logic from `@andy-toolforge/core` into a standalone package `@andy-toolforge/llm-gateway` that provides both an HTTP server (OpenAI-compatible REST API) and an SDK (`require('@andy-toolforge/llm-gateway')`) with multi-provider support, failover, rate limiting, key rotation, cost tracking, response caching, and multi-tenant auth — all powered by a composable Pipeline architecture.

**Current state:** `@andy-toolforge/core` has `LLMClient` + `OpenAIAdapter` (fetch-based, supports gemini/groq/openai-compatible) and `GenAIAdapter` (Google GenAI SDK). No HTTP server, no rate limiting, no key rotation, no caching, no multi-tenant auth. Domain packages (footage-generation, content-research) extend `LLMClient` with domain-specific methods.

**Desired state:** A new `@andy-toolforge/llm-gateway` package with a Pipeline-of-Stages architecture. The pipeline handles everything: auth, rate limit, cache, routing, key rotation, provider call, cost logging. Exposed via (a) SDK: `gw.chat({...})` and (b) HTTP: OpenAI-compatible `/v1/chat/completions`. Existing `LLMClient` in core becomes a thin wrapper over the gateway SDK for backward compatibility.

**Why standalone:** So it can be deployed as a container (Docker), used as an HTTP proxy by any language, or imported as an SDK in Node.js projects — without pulling in the rest of toolforge.

---

## Package Structure

```
packages/llm-gateway/
├── package.json              # @andy-toolforge/llm-gateway
├── lib/
│   ├── index.js              # Public API: Gateway class, createGateway()
│   ├── pipeline.js           # Pipeline — chains Stages, executes ctx through them
│   ├── stage.js              # Stage base class: constructor(name), async execute(ctx, next)
│   ├── stages/
│   │   ├── auth.js           # AuthStage — validate API key, resolve tenant
│   │   ├── rate-limit.js     # RateLimitStage — per-tenant token bucket
│   │   ├── cache.js          # CacheStage — response cache (in-memory / pluggable)
│   │   ├── router.js         # RouterStage — model → provider matching + fallback
│   │   ├── key-rotator.js    # KeyRotatorStage — try next key on 401
│   │   ├── provider.js       # ProviderStage — wraps OpenAIAdapter / GenAIAdapter
│   │   ├── cost-logger.js    # CostLoggerStage — token counting + cost record
│   │   └── circuit-breaker.js # CircuitBreakerStage — provider health tracking
│   ├── http/
│   │   ├── server.js         # Express server: /v1/chat/completions, /health, /readyz
│   │   └── middleware.js     # cors, body-parser, request-id, request-cancellation
│   ├── router/
│   │   ├── model-map.js      # Model → provider mapping config
│   │   └── fallback-chain.js # Provider fallback priority rules
│   ├── cache/
│   │   ├── memory-store.js   # Default in-memory cache (LRU)
│   │   └── types.js          # Cache interface for pluggable backends (Redis, etc.)
│   └── types.js              # JSDoc typedefs: ChatRequest, ChatResponse, PipelineContext
├── bin/
│   └── cli.js                # CLI: npx gateway start --config gateway.json
└── README.md
```

### Dependencies

- `@andy-toolforge/core` (>=1.2.0) — for `OpenAIAdapter`, `GenAIAdapter`, `Logger`
- `express` — HTTP server
- No other new deps in v1

---

## Core Architecture: Pipeline + Stages

### PipelineContext (`ctx`)

A mutable object flowing through every stage:

```js
ctx = {
  // Request (read-only through pipeline)
  model: 'gemini-3.1-flash-lite',
  messages: [{ role: 'user', content: '...' }],
  stream: false,
  tenant: 'default',
  requestId: 'req_abc123',

  // Populated by stages
  provider: 'gemini',          // resolved by RouterStage
  apiKey: '...',               // resolved by AuthStage or KeyRotatorStage
  adapter: OpenAIAdapter,       // resolved by RouterStage
  cost: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
  cached: false,
  dryRun: false,

  // Response (after ProviderStage)
  response: null,              // { content, toolCalls, usage }

  // Errors
  error: null,
};
```

### Pipeline

```js
class Pipeline {
  constructor(stages = []) { this._stages = stages; this._inflight = new Set(); }
  use(stage) { this._stages.push(stage); return this; }
  get inflightCount() { return this._inflight.size; }

  async execute(ctx) {
    const rid = ctx.requestId;
    this._inflight.add(rid);
    try {
      let i = 0;
      const next = async () => {
        if (i >= this._stages.length) return;
        const stage = this._stages[i++];
        await stage.execute(ctx, next);
      };
      await next();
      if (ctx.error) throw ctx.error;
      return ctx.stream ? ctx.responseStream : ctx.response;
    } finally {
      this._inflight.delete(rid);
    }
  }
}
```

### Stage interface

```js
class Stage {
  constructor(name) { this.name = name; }
  async execute(ctx, next) {
    // Pre-processing: validate/modify ctx
    await next();
    // Post-processing: read/modify ctx after downstream stages
  }
}
```

Stages call `next()` to pass control downstream. They can:
- Modify `ctx` before calling `next()` (set up)
- Modify `ctx` after `next()` returns (teardown/post-processing)
- Skip `next()` entirely (short-circuit: cache hit, rate limited, dry run)
- Set `ctx.error` and skip `next()` (fail fast)

For streaming requests (`ctx.stream === true`), all stages still execute through the chain.
Stream-sensitive stages handle it differently:
- **CacheStage:** skip caching for streaming responses
- **ProviderStage:** set `ctx.responseStream` then call `next()` — does NOT skip downstream
- **CostLoggerStage:** wrap `ctx.responseStream` to log cost on stream-end event

---

## Pipeline Execution Order

Stages execute in this order. Each stage either passes to the next via `next()` or short-circuits:

```
Request → AuthStage → RateLimitStage → CacheStage → RouterStage
  → KeyRotatorStage → ProviderStage → CircuitBreakerStage → CostLoggerStage → Response
```

Key interactions:
- **CacheStage** short-circuits (skips remaining stages) on cache hit
- **RouterStage** consults **CircuitBreakerStage** state when selecting fallback providers — skips OPEN providers
- **CircuitBreakerStage** records ProviderStage outcome post-execution (pre-checks are done by RouterStage)
- **CostLoggerStage** always runs last, handles both sync and streaming paths

---

## Stage Details with Edge Case Solutions

### AuthStage

- Validates API key from `ctx.headers['authorization']` (HTTP) or `ctx.apiKey` (SDK)
- Resolves `ctx.tenant` from key mapping
- **Edge case:** Multi-tenant key rotation — supports multiple active keys per tenant during rotation window
- Rejects with 401 if key not found

### RateLimitStage

- Per-tenant token bucket: `{ [tenant]: { tokens, lastRefill, capacity, refillRate } }`
- **Edge case:** Returns `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers via `ctx.responseHeaders`
- When exhausted: sets `ctx.error = new RateLimitError()` and skips `next()`

### CacheStage

- Cache key = `hash(tenant + model + JSON.stringify(messages))`
- On hit: sets `ctx.response = cachedResponse`, `ctx.cached = true`, skips `next()`
- On miss: calls `next()`, then stores `ctx.response` in cache
- **Edge case:** Tenant isolation — tenant ID is part of cache key, Tenant A never sees Tenant B's cached responses
- **Edge case:** Streaming not cached (stream responses pass through)
- Pluggable backend: default `MemoryStore` (LRU, max 1000 entries, TTL 5min)

### RouterStage

Maps model name → provider config via `model-map.js`:

```js
// config/gateway.json
{
  "models": {
    "gemini-3.1-flash-lite": { provider: "gemini", adapter: "GenAIAdapter" },
    "gemini-3.1-flash":      { provider: "gemini", adapter: "GenAIAdapter" },
    "gpt-4o-mini":           { provider: "openai", adapter: "OpenAIAdapter" },
    "gpt-4o":                { provider: "openai", adapter: "OpenAIAdapter" },
    "llama-3.3-70b":         { provider: "groq",   adapter: "OpenAIAdapter" }
  },
  "fallbacks": {
    "gpt-4o-mini": ["gemini-3.1-flash", "llama-3.3-70b"],
    "gemini-3.1-flash": ["gpt-4o-mini"]
  }
}
```

- Sets `ctx.adapter` to the matching adapter instance
- **Edge case: Model collision** — if 2 providers both serve `llama-3-70b`, RouterStage uses `tiebreaker` strategy: `cost` (cheapest wins) or `latency` (fastest wins), configurable per model
- **Edge case: Model alias** — `gpt-4-turbo` can be an alias pointing to same config as `gpt-4o`; resolved before routing
- **Edge case: Unknown model** — error with available model list
- **Dry run mode:** If `ctx.dryRun === true`, RouterStage resolves the model→provider route, computes estimated cost from pricing table, sets `ctx.response`, and skips `next()` — no downstream stages run, no API call made, no cost incurred

```js
async execute(ctx, next) {
  const candidate = this._selectProvider(ctx.model, ctx.tenant);
  if (!candidate) throw new ModelNotFoundError(ctx.model);

  if (ctx.dryRun) {
    ctx.response = {
      model: ctx.model,
      provider: candidate.provider,
      adapter: candidate.adapter.constructor.name,
      estimatedCost: this._estimateCost(ctx.model, candidate.provider),
      cacheStatus: ctx.cached ? 'hit' : 'miss',
    };
    return; // skip next() — no API call
  }

  ctx.provider = candidate.provider;
  ctx.adapter = candidate.adapter;
  ctx.providerTimeout = candidate.timeoutMs;
  await next();
}
```

### KeyRotatorStage

- Maintains `{ [provider]: [key1, key2, ...] }` pool
- On first call: uses `ctx.apiKey` (primary)
- **Edge case: Key rotation rollover** — if primary key returns 401, tries next key in pool; if a fallback key succeeds, marks primary as degraded and returns success
- After N consecutive failures across all keys: marks provider degraded (feeds into CircuitBreakerStage)

### ProviderStage

Wraps existing `OpenAIAdapter` / `GenAIAdapter` from `@andy-toolforge/core`:

```js
async execute(ctx, next) {
  const adapter = ctx.adapter;
  // Normalize ctx.messages into adapter format
  // Handle streaming or non-streaming
  ctx.rawResponse = await adapter.chat({...});
  // Normalize response back to ctx.response
  ctx.cost = { promptTokens, completionTokens, costUsd };
}
```

**Edge case: Streaming** — ProviderStage always calls `next()` so downstream stages (CostLoggerStage) still execute:

```js
async execute(ctx, next) {
  if (ctx.stream) {
    ctx.responseStream = adapter.chatStream({
      messages: ctx.messages,
      signal: ctx.abortSignal,     // request cancellation
      timeout: ctx.providerTimeout, // per-provider timeout
    });
    // Still call next() — CostLoggerStage wraps the stream for end-of-stream logging
    await next();
  } else {
    ctx.rawResponse = await adapter.chat({
      messages: ctx.messages,
      signal: ctx.abortSignal,
      timeout: ctx.providerTimeout,
    });
    ctx.cost = { promptTokens, completionTokens, costUsd };
    await next();
  }
}
```

### AbortSignal wiring

- HTTP middleware creates `AbortController` per request, assigns `ctx.abortSignal`
- On client disconnect (`req.on('close')`): abort controller is triggered
- ProviderStage passes `ctx.abortSignal` to `.chat()` or `.chatStream()`
- Existing adapters (`OpenAIAdapter`, `GenAIAdapter`) accept optional `{ signal }` parameter for `fetch()` / `@google/genai` cancellation
- **Edge case:** Cancelling a streaming request mid-way → provider API call is aborted → cost savings

### Per-provider timeout

- Configurable via `gateway.json`: `{ providers: { gemini: { timeoutMs: 15000 }, groq: { timeoutMs: 30000 } } }`
- RouterStage sets `ctx.providerTimeout` from matched provider config
- ProviderStage passes timeout to adapter; if exceeded, throws `TimeoutError` which triggers fallback chain

### CircuitBreakerStage

- Sits AFTER ProviderStage to record outcome (pre-checks done by RouterStage during fallback selection)
- Tracks per-provider health: `{ [provider]: { failures, lastFailure, state: 'closed'|'open'|'half-open' } }`
- **closed**: normal operation
- **open**: after N failures in M minutes → reject immediately without calling adapter
- **half-open**: after cooldown period, allow 1 probe request; success → close, failure → open again
- Configurable: `{ threshold: 5, cooldownMs: 30000, halfOpenMaxRequests: 1 }`
- Records only non-4xx failures (auth failures are handled by KeyRotatorStage, not circuit breaker)

**RouterStage interaction:**

```js
// Inside RouterStage.execute()
const candidates = this._resolveModel(ctx.model);
for (const candidate of candidates) {
  if (this._circuitBreakerState?.[candidate.provider] === 'open') {
    continue; // skip dead provider, try next fallback
  }
  // route to this candidate
  ctx.provider = candidate.provider;
  ctx.adapter = candidate.adapter;
  ctx.providerTimeout = candidate.timeoutMs;
  break;
}
```

### CostLoggerStage

- Last stage in pipeline (post-processing, runs after all stages complete)
- Computes cost from token counts using model pricing table
- **For streaming:** wraps `ctx.responseStream` for end-of-stream cost accounting

```js
async execute(ctx, next) {
  await next(); // wait for provider
  if (ctx.stream && ctx.responseStream) {
    // Wrap stream: count tokens on each chunk, log on stream end
    ctx.responseStream = this._wrapStream(ctx.responseStream, ctx);
  }
  if (!ctx.stream) {
    ctx.cost = { promptTokens, completionTokens, costUsd };
    this._log(ctx);
  }
}
```

- Writes structured log: `{ requestId, tenant, model, provider, promptTokens, completionTokens, costUsd, cached, durationMs }`
- **Edge case: Prompt content logging** — config flag `logPrompts: false` logs only token counts/metadata, never message content (PII safety)

---

## HTTP Server

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat completions (sync + streaming) |
| GET | `/health` | Liveness probe (always 200) |
| GET | `/readyz` | Readiness probe (checks provider health, cache backend) |
| GET | `/v1/models` | List available models (from config) |

### OpenAI-Compatible Request/Response

**Request:**
```json
{
  "model": "gemini-3.1-flash-lite",
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": false,
  "temperature": 0.7
}
```

**Response (non-streaming):**
```json
{
  "id": "chatcmpl_abc123",
  "object": "chat.completion",
  "model": "gemini-3.1-flash-lite",
  "choices": [{ "index": 0, "message": { "role": "assistant", "content": "..." }, "finish_reason": "stop" }],
  "usage": { "prompt_tokens": 10, "completion_tokens": 50, "total_tokens": 60 }
}
```

**Response (streaming):**
SSE with `data: { "choices": [{ "delta": { "content": "...", "role": "assistant" }, "finish_reason": null }] }` per chunk.
Final chunk has `finish_reason: "stop"` and includes `usage`.

### Edge cases handled by HTTP layer

**Graceful shutdown:**
```js
const server = app.listen(port);

process.on('SIGTERM', async () => {
  server.close(); // stop accepting new connections

  // Drain in-flight requests via Pipeline's inflight tracking
  const start = Date.now();
  const maxWait = 30_000;
  while (pipeline.inflightCount > 0 && (Date.now() - start) < maxWait) {
    await new Promise(r => setTimeout(r, 200));
  }

  if (pipeline.inflightCount > 0) {
    console.warn(`[gateway] ${pipeline.inflightCount} requests still in-flight after drain timeout`);
  }
  process.exit(0);
});
```
- **Edge case:** Deploy during active traffic → in-flight requests complete naturally or time out; new connections rejected immediately

**Request cancellation:**
- Middleware creates `AbortController` per request, assigns `ctx.abortSignal`
- `req.on('close', ...)` triggers abort controller
- ProviderStage passes `ctx.abortSignal` to adapter calls; streaming checks signal between chunks
- **Edge case:** Client disconnects mid-stream → gateway cancels provider API call → saves cost

**Rate limit headers:**
All responses include `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers from RateLimitStage's `ctx.responseHeaders`.

---

## Integration with Existing Architecture

### SDK usage

```js
const gw = createGateway({ config: require('./gateway.json') });

// Raw request — direct
const resp = await gw.chat({
  model: 'gemini-3.1-flash-lite',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Dry run — no API call
const estimate = await gw.chat({ model: 'gpt-4o', messages, dryRun: true });
// → { model, provider, estimatedCost, cacheStatus }
```

### Domain package integration (backward compat)

`@andy-toolforge/core`'s `LLMClient` becomes a thin wrapper:

```js
class LLMClient {
  constructor(config) {
    if (config.adapters) {
      this._gw = createGateway({ adapters: config.adapters, pipeline: 'minimal' });
    } else {
      this._gw = createGateway({ model: config.model, provider: config.provider, apiKey: config.apiKey });
    }
  }
  async chat(systemPrompt, userPrompt, jsonMode) {
    return this._gw.chat({ systemPrompt, userPrompt, jsonMode });
  }
}
```

Domain packages (footage-generation, content-research) continue working without changes.

### MCP Server integration

MCP tools construct a gateway instance instead of `LLMClient` directly. For simple use cases (existing MCP tools that use `this.llm`), the `llm` getter returns a backward-compatible wrapper.

---

## Error Handling Strategy

Standardized error types:
- `AuthenticationError` — invalid API key (401)
- `RateLimitError` — rate limit exceeded (429)
- `ModelNotFoundError` — unknown model (404)
- `ProviderError` — upstream provider returned error (502)
- `TimeoutError` — provider timed out (504)
- `PipelineError` — internal stage failure (500)

Each error includes `{ code, message, retryable, provider, model }` for structured handling.

---

## Testing Strategy

| Test area | Approach |
|-----------|----------|
| Each Stage | Unit test with mock PipelineContext |
| Pipeline orchestration | Unit test with mock stages (order, skip, error) |
| Router stage | Map known models, test collision resolution, fallback chain |
| HTTP server | Supertest: POST /v1/chat/completions, /health, /readyz |
| Streaming | HTTP streaming test: read SSE chunks |
| Circuit breaker | Inject failures, verify open→half-open→closed cycle; RouterStage skips OPEN providers |
| Cache isolation | Two tenants, same model+messages → different cache keys |
| Graceful shutdown | Mock in-flight request, send SIGTERM, verify drain loops until inflightCount=0 |
| Request cancellation | Client disconnects mid-stream → verify AbortController.abort() called |
| Dry run | dryRun: true → RouterStage returns route+cost estimate without calling next() |
| Key rotation | Pool of 2 keys, 1st returns 401 → falls to 2nd; rollover marks primary degraded |
| AbortSignal wiring | ProviderStage passes ctx.abortSignal to adapter.chat({ signal }) — verify cancellation |
| Per-provider timeout | RouterStage sets ctx.providerTimeout; ProviderStage enforces it |
| Streaming cost logging | CostLoggerStage wraps ctx.responseStream — verify cost logged on stream end |

---

## What's NOT in v1

- WebSocket streaming (only SSE)
- Provider-specific error normalization beyond status codes
- Multi-region provider routing
- Usage analytics dashboard
- REST management API (CRUD for models, tenants, keys)
- Redis cache backend (in-memory only)
