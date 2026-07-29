# @andy-toolforge/llm-gateway — LLM Gateway Service

> Domain package wrapping llm-gateway-core into a full LLM gateway with
> CLI (`bin/cli.js`), HTTP server, and LLMClient that extends core's LLMClient.
> Provides pipeline orchestration, metrics collection, and smart provider routing.

## Structure

```
packages/llm-gateway/
  bin/
    cli.js            — CLI entry: gateway commands (9 commands)
  lib/
    index.js          — Entry: exports { Gateway, createGateway, LLMClient,
                          Pipeline, Stage, MetricsCollector, all stages }
    gateway.js        — Gateway + createGateway — Pipeline orchestrator factory
    llm.js            — LLMClient — Extends core LLMClient with pipeline integration
    pipeline.js       — Pipeline — Request executor with inflightCount/drain
    stage.js          — Stage — Base class (wraps llm-gateway-core Stage)
    metrics/
      collector.js    — MetricsCollector — Request metrics (latency, errors, tokens)
    stages/           — Stage implementations (mirrorllm-gateway-core with extra logic)
      auth.js
      rate-limit.js, provider.js, router.js, cache.js, key-rotator.js,
      circuit-breaker.js, cost-logger.js
    router/
      model-map.js, fallback-chain.js
    cache/
      memory-store.js
    http/
      server.js       — HTTP server (13 routes/handlers)
  skills/
    postinstall.js
    llm-gateway.md
  package.json        — deps: @andy-toolforge/core, @andy-toolforge/llm-gateway-core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `Gateway` | `lib/gateway.js` | Pipeline orchestrator with internal `_registerStages()`. Methods: `execute(request)`, `stream(request)`. |
| `createGateway(config)` | `lib/gateway.js` | Factory: `createGateway({ createAdapter, stages?, metrics? })` — requires `createAdapter` callback. Returns Gateway instance. |
| `LLMClient` | `lib/llm.js` | Extends core LLMClient with pipeline-based `chat()` and `chatStream()`. Falls back to core if no gateway configured. |
| `Pipeline` | `lib/pipeline.js` | Request executor with `execute()`, `inflightCount`, `drain()`. |
| `Stage` | `lib/stage.js` | Base class wrapping llm-gateway-core Stage. |
| `MetricsCollector` | `lib/metrics/collector.js` | Collect request metrics: latency, error counts, token usage, provider stats. |
| `ModelMap` | `lib/router/model-map.js` | Model name → provider resolution. |
| `FallbackChain` | `lib/router/fallback-chain.js` | Ordered provider fallback with retry. |
| `MemoryStore` | `lib/cache/memory-store.js` | In-memory cache store. |

### Stage exports (for custom pipeline assembly)

`AuthStage`, `RateLimitStage`, `CacheStage`, `RouterStage`, `KeyRotatorStage`, `ProviderStage`, `CircuitBreakerStage`, `CircuitBreakerState`, `CostLoggerStage` — all wrappers around llm-gateway-core counterparts with gateway-specific extensions.

## Conventions

- **Depends on** `@andy-toolforge/llm-gateway-core` for stage primitives; this package adds orchestration + CLI + HTTP.
- `LLMClient` here extends core's `LLMClient` — when a gateway is configured, all LLM calls route through the pipeline.
- The `createGateway` factory requires a `createAdapter` function that returns a `ProviderAdapter`-compatible object.
- CLI entry (`bin/cli.js`) provides commands for: chat, stream, config, metrics, health, models, keys, cache, and provider management.
- HTTP server in `lib/http/server.js` exposes REST endpoints for the same operations.
- Skill files prefixed with `llm-gateway-`.

## Testing

```bash
npm test -w @andy-toolforge/llm-gateway
```

## See also

- `packages/llm-gateway-core/` — Underlying pipeline framework (zero-deps, TypeScript)
- `packages/llm-gateway-core/types.d.ts` — Type definitions
- `packages/llm-gateway/skills/` — Skill prompt files
