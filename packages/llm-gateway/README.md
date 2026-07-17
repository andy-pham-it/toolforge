# @andy-toolforge/llm-gateway

[![npm](https://img.shields.io/npm/v/@andy-toolforge/llm-gateway)](https://npmjs.com/package/@andy-toolforge/llm-gateway)
[![License](https://img.shields.io/npm/l/@andy-toolforge/llm-gateway)](https://github.com/andy-pham-it/toolforge)

**LLM API Gateway** — multi-provider routing, failover, rate limiting, auth, caching, circuit breaker, key rotation, cost tracking. Pipeline-of-Stages architecture.

```
Request → [Auth → RateLimit → Cache → Router → Fallback → CircuitBreaker → Provider → CostLogger] → Response
```

## Installation

```bash
npm install @andy-toolforge/llm-gateway
```

## Quick Start

```javascript
const { createGateway } = require('@andy-toolforge/llm-gateway');

const gw = createGateway({
  apiKey: 'sk-your-key',
  keys: { 'sk-your-key': { tenant: 'my-app' } },
  models: {
    'gemini-pro': { provider: 'gemini', adapter: 'GenAIAdapter' },
    'gpt-4': { provider: 'openai', adapter: 'OpenAIAdapter' },
  },
});

// Sync
const result = await gw.chat({
  model: 'gemini-pro',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(result.content);

// Streaming
for await (const chunk of gw.chatStream({
  model: 'gemini-pro',
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  process.stdout.write(chunk.content);
}
```

## Features

| Feature | Stage | Config |
|---------|-------|--------|
| API Key Auth | AuthStage | `keys: { 'sk-xxx': { tenant } }` |
| Rate Limiting | RateLimitStage | `rateLimits: { tenant: { capacity, refillRate } }` |
| Response Caching | CacheStage | `cache: { ttlMs }` |
| Model Routing | RouterStage | `models: { name: { provider, adapter } }` |
| Failover | FallbackChain | Defined in model config |
| Circuit Breaker | CircuitBreakerStage | `circuitBreaker: { threshold, cooldownMs }` |
| Key Rotation | KeyRotatorStage | `keyRotator: { keys: [...], rotationIntervalMs }` |
| Cost Logging | CostLoggerStage | Automatic per-request cost |
| Provider Adapter | ProviderStage | `createAdapter(provider, model)` factory |

## Architecture

### Pipeline-of-Stages

Every request flows through a chain of stages, each with a single responsibility. Stage order is fixed:

```
Request
  │
  ├─ ① AuthStage        — validate API key, extract tenant
  ├─ ② RateLimitStage   — enforce per-tenant token bucket
  ├─ ③ CacheStage       — return cached response if available
  ├─ ④ RouterStage      — resolve model → provider + adapter; activate fallback chain
  ├─ ⑤ FallbackChain    — try primary provider, fall through to alternatives on failure
  ├─ ⑥ CircuitBreakerStage — track failures; open circuit if threshold exceeded
  ├─ ⑦ ProviderStage    — call the LLM provider (sync or streaming)
  └─ ⑧ CostLoggerStage  — log usage + compute cost
  │
Response
```

### Request / Response Object

Each stage transforms a shared `request` object and/or the `response`:

```
Request: { model, messages, stream?, requestId, tenant?, signal? }
Response: { content, usage: { promptTokens, completionTokens, costUsd }, cached? }
```

Stages before ProviderStage (Auth → Cache) operate on the request object. ProviderStage calls the actual LLM and produces the response. Stages after (CostLogger) decorate the response. The `next()` call passes control to the next stage; a stage can short-circuit (Cache hit, Circuit open, Rate limited) and return early.

### Streaming Path

When `request.stream = true`, ProviderStage returns an `AsyncIterable<{ content, done, usage? }>`. CacheStage bypasses caching for streaming requests (unless the entire response is buffered). The HTTP server delivers streaming via SSE (Server-Sent Events).

### Gateway Class

The `Gateway` class assembles the pipeline from config and exposes three methods:

| Method | Description |
|--------|-------------|
| `gateway.chat(req)` | Sync completion — returns `Response` |
| `gateway.chatStream(req)` | Streaming — returns `AsyncIterable` |
| `gateway.health()` | Pipeline status — returns `{ status, models, stages }` |

## HTTP Server

```bash
# CLI
npx llm-gateway --port 4000 --api-key sk-admin

# Or programmatically
const { HTTPServer, createGateway } = require('@andy-toolforge/llm-gateway');
const server = new HTTPServer(gateway, { port: 4000 });
await server.start();
```

### Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Pipeline status + model list |
| `GET` | `/v1/models` | Available models |
| `POST` | `/v1/chat/completions` | Chat completion (OpenAI-compatible) |
| `POST` | `/v1/chat/completions` | With `stream: true` → SSE streaming |

## Adapters

Create custom adapters for any provider:

```javascript
const gw = createGateway({
  models: { 'custom-model': { provider: 'custom', adapter: 'MyAdapter' } },
  createAdapter: (provider, model) => {
    if (provider === 'custom') return {
      chat: async (messages, opts) => ({
        content: 'response text',
        usage: { promptTokens: 5, completionTokens: 10, costUsd: 0.0001 },
      }),
    };
  },
});
```

## Configuration Reference

### Gateway Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | string | yes | Admin API key |
| `keys` | object | yes | `{ key: { tenant } }` — API key → tenant mapping |
| `models` | object | yes | `{ name: { provider, adapter } }` — model definitions |
| `rateLimits` | object | no | `{ tenant: { capacity, refillRate } }` |
| `cache` | object | no | `{ ttlMs }` — cache TTL |
| `circuitBreaker` | object | no | `{ threshold, cooldownMs, halfOpenMaxRequests }` |
| `keyRotator` | object | no | `{ keys: [...], rotationIntervalMs }` |
| `createAdapter` | function | no | Factory `(provider, model) => adapter` |
| `costConfig` | object | no | `{ perMillionTokens: { input, output } }` |

### HTTP Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | `3000` | Listen port (0 = random) |
| `host` | string | `'localhost'` | Bind address |

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — Core LLM client and shared utilities
- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp) — MCP server toolkit
