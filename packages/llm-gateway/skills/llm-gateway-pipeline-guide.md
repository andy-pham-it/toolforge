# LLM Gateway Pipeline Guide

Build stage/pipeline chains with `createPipeline` from `@andy-toolforge/llm-gateway-core`.

## createPipeline(config)

REQUIRED: `config.createAdapter(provider, apiKey)` — factory returning an adapter instance with `chat()` (optionally `chatStream()`). Throws if missing.

Optional config:

- `models` — ModelMap (model id -> provider/params)
- `fallbacks` — FallbackChain (model fallback order)
- `keys` — apiKey -> tenant mapping
- `rateLimits` — per-tenant rate limits
- `keyPools` — `{ [provider]: [key1, key2] }` (key rotation)
- `pricing` — override pricing table
- `circuitBreaker` — `{ threshold, cooldownMs, halfOpenMaxRequests }`
- `cache` — `{ store: MemoryStore }`
- `stages` — ordered stage names array
- `logPrompts` — PII risk flag

Default stage order: `auth -> rate-limit -> cache -> router -> key-rotator -> circuit-breaker -> provider -> cost-logger`.

## API

```javascript
const { createPipeline } = require('@andy-toolforge/llm-gateway-core');

const pipeline = createPipeline({
    createAdapter: (provider, apiKey) => ({
        chat: async (messages, opts) => ({ content: '...' }),
    }),
    models: {
        'gemini-2.5-flash': { provider: 'gemini', model: 'gemini-2.5-flash' },
    },
});

// Chat (sync)
const res = await pipeline.chat({
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: 'Hi' }],
});
// res.content

// Chat (stream)
const stream = pipeline.chatStream({ model: 'gemini-2.5-flash', messages: [...] });
for await (const chunk of stream) { /* ... */ }

// Health
const health = pipeline.health();
// { status: 'ok', inflight, models, stages }
```

## Pipeline

- `use(stage)` — append a stage, returns `this`
- `execute(ctx)` — run the chain; `dryRun` -> cost summary; `stream` -> responseStream; sync -> response or throw
- `inflightCount` — in-flight requests
- `drain(timeoutMs = 30000)` — wait for in-flight requests to finish

## Stage

```javascript
const { Stage } = require('@andy-toolforge/llm-gateway-core');

class MyStage extends Stage {
    constructor() {
        super('my-stage'); // name required
    }
    async execute(ctx, next) {
        // pre-processing (setup)
        await next(); // pass downstream — SKIP next() to short-circuit
        // post-processing (teardown)
    }
}
```

Context fields: `{ model, messages, stream, dryRun, tenant, apiKey, temperature, signal, requestId, responseHeaders, _startTime }`.

## Related

- `llm-gateway-adapter-guide` — write custom adapters for any LLM provider
- `llm-gateway-hub` — CLI reference & config options