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
│   │   ├── circuit-breaker.js # CircuitBreakerStage — provider health tracking
│   │   └── dry-run.js        # DryRunStage — simulation mode (cost/route only)
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
  constructor(stages = []) { this._stages = stages; }
  use(stage) { this._stages.push(stage); return this; }
  async execute(ctx) {
    let i = 0;
    const next = async () => {
      if (i >= this._stages.length) return;
      const stage = this._stages[i++];
      await stage.execute(ctx, next);
    };
    if (ctx.stream) {
      return this._executeStream(ctx, next);
    }
    await next();
    if (ctx.error) throw ctx.error;
    return ctx.response;
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
- Modify `ctx` after `next()` returns (teardown)
- Skip `next()` entirely (short-circuit: cache hit, rate limited, dry run)
- Set `ctx.error` and skip `next()` (fail fast)

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

**Edge case: Streaming** — handled via special path:

```js
async execute(ctx, next) {
  if (ctx.stream) {
    ctx.responseStream = adapter.chatStream({...});
    // No next() call — stream goes directly to HTTP SSE
  } else {
    await next(); // or do sync call
  }
}
```

### CircuitBreakerStage

- Tracks per-provider health: `{ [provider]: { failures, lastFailure, state: 'closed'|'open'|'half-open' } }`
- **closed**: normal operation
- **open**: after N failures in M minutes → reject immediately without calling adapter
- **half-open**: after cooldown period, allow 1 probe request; success → close, failure → open again
- Configurable: `{ threshold: 5, cooldownMs: 30000, halfOpenMaxRequests: 1 }`

### CostLoggerStage

- Post-processing stage (runs after ProviderStage on the way back)
- Computes cost from token counts using model pricing table
- Writes structured log: `{ requestId, tenant, model, provider, promptTokens, completionTokens, costUsd, cached, durationMs }`
- **Edge case: Prompt content logging** — config flag `logPrompts: false` logs only token counts/metadata, never message content (PII safety)

### DryRunStage

- If `ctx.dryRun === true`, resolves route + cost but skips ProviderStage entirely
- Returns: `{ model, provider, estimatedCost, cacheStatus }`
- Implements `execute()` by calling RouterStage's logic inline, then skipping `next()`

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
  server.close();                      // stop accepting new connections
  await drainInFlight(30_000);         // wait up to 30s for in-flight requests
  process.exit(0);
});
```

**Request cancellation:**
- Middleware attaches `req.on('close', ...)` → sets `ctx.cancelled = true`
- ProviderStage checks `ctx.cancelled` between chunks; if true, aborts upstream fetch via `AbortController`
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
| Circuit breaker | Inject failures, verify open→half-open→closed cycle |
| Cache isolation | Two tenants, same model+messages → different cache keys |
| Graceful shutdown | Mock in-flight, send SIGTERM, verify drain |
| Request cancellation | Client disconnects mid-stream → verify AbortController called |
| Dry run | dryRun: true → no API call, returns cost estimate |
| Key rotation | Pool of 2 keys, 1st returns 401 → falls to 2nd |

---

## What's NOT in v1

- WebSocket streaming (only SSE)
- Provider-specific error normalization beyond status codes
- Multi-region provider routing
- Usage analytics dashboard
- REST management API (CRUD for models, tenants, keys)
- Redis cache backend (in-memory only)
