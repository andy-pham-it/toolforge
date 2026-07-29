# @andy-toolforge/llm-gateway-core — LLM Gateway Core Pipeline

> **TypeScript-compiled package** (unusual — most toolforge packages are plain CJS).
> Zero external dependencies, browser-compatible pipeline framework for LLM request
> processing. Provides a composable stage-based pipeline with auth, rate-limiting,
> caching, routing, key rotation, provider dispatch, circuit breaking, and cost logging.

## Structure

```
packages/llm-gateway-core/
  lib/
    index.js          — Entry: exports { createPipeline, Pipeline, Stage, all stages,
                          MemoryStore, ModelMap, FallbackChain }
    create-pipeline.js — createPipeline(stages[]) — Factory: returns configured Pipeline
    pipeline.js       — Pipeline — Stage executor (sync/stream/dryRun modes)
    stage.js          — Stage — Base class for all stages
    stages/
      auth.js         — AuthStage — API key / token validation
      rate-limit.js   — RateLimitStage + TokenBucket — Rate limiter
      cache.js        — CacheStage — Response caching
      router.js       — RouterStage — Model routing
      key-rotator.js  — KeyRotatorStage — API key rotation
      provider.js     — ProviderStage — LLM provider dispatch
      circuit-breaker.js — CircuitBreakerStage + CircuitBreakerState
      cost-logger.js  — CostLoggerStage — Usage/cost tracking
    cache/
      memory-store.js — MemoryStore — In-memory cache store
    router/
      model-map.js    — ModelMap — Model name → provider mapping
      fallback-chain.js — FallbackChain — Ordered fallback provider chain
  types.d.ts          — Full TypeScript type definitions
  tsconfig.json       — TypeScript compilation config
  package.json        — deps: (none) Zero-dependency
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `createPipeline(stages[])` | `lib/create-pipeline.js` | Factory: returns configured Pipeline instance |
| `Pipeline` | `lib/pipeline.js` | Stage executor — methods: `execute(ctx)`, `executeStream(ctx)`, `dryRun(ctx)` |
| `Stage` | `lib/stage.js` | Base class — override `execute(context, next)` |
| `AuthStage` | `lib/stages/auth.js` | API key / token validation |
| `RateLimitStage` | `lib/stages/rate-limit.js` | Token bucket rate limiter |
| `TokenBucket` | `lib/stages/rate-limit.js` | Token bucket algorithm |
| `CacheStage` | `lib/stages/cache.js` | Response caching layer |
| `RouterStage` | `lib/stages/router.js` | Route requests to model/provider |
| `KeyRotatorStage` | `lib/stages/key-rotator.js` | Rotate API keys on failure |
| `ProviderStage` | `lib/stages/provider.js` | Dispatch to LLM provider |
| `CircuitBreakerStage` | `lib/stages/circuit-breaker.js` | Circuit breaker pattern |
| `CircuitBreakerState` | `lib/stages/circuit-breaker.js` | Circuit breaker state machine |
| `CostLoggerStage` | `lib/stages/cost-logger.js` | Log usage and cost data |
| `MemoryStore` | `lib/cache/memory-store.js` | In-memory key-value cache |
| `ModelMap` | `lib/router/model-map.js` | Model → provider name resolution |
| `FallbackChain` | `lib/router/fallback-chain.js` | Ordered provider fallback |

### TypeScript types (types.d.ts)

| Type | Description |
|------|-------------|
| `ChatRequest` | `{ messages, model?, provider?, stream?, maxTokens?, temperature?, ... }` |
| `ChatResponse` | `{ content, model, provider, usage?, latency?, ... }` |
| `PipelineContext` | `{ request, response?, state, metadata, ... }` |

## Conventions

- **TypeScript-compiled** — `tsconfig.json` + `build:types` script. Compiled JS in `lib/`, types in `.d.ts` files.
- **Zero-dependency** — no npm dependencies beyond dev tooling. Browser-compatible.
- Pipeline stages are composable and order-independent — the Pipeline executor calls them sequentially.
- `Stage` base class uses `async execute(context, next)` pattern — call `next(context)` to continue chain.
- Unlike most toolforge packages, this is NOT a domain package — it's a shared infra library.
- Type definitions are authoritative — consult `types.d.ts` for complete interfaces.

## Testing

```bash
npm test -w @andy-toolforge/llm-gateway-core
```

## See also

- `packages/llm-gateway/` — Higher-level gateway with CLI, HTTP server, LLMClient integration
- `packages/llm-gateway-core/types.d.ts` — Complete TypeScript type definitions
