# @andy-toolforge/core — Infrastructure Foundation

> Shared generic services consumed by all domain packages. Never contains domain-specific logic.

## Structure

```
packages/core/
  lib/
    index.js      — Entry: exports { LLMClient, BrowserManager, Logger, JobQueue }
    llm.js        — LLMClient  Generic chat() with provider routing (puppeteer-based)
    browser.js    — BrowserManager  Puppeteer browser lifecycle (launch/close)
    logger.js     — Logger  Structured logging with levels (DEBUG|INFO|WARN|ERROR)
    queue.js      — JobQueue  Async FIFO queue with enqueue/process/onDone
    llm.test.js   — Unit tests via node --test
  package.json    — deps: puppeteer, uuid
```

## Key Classes

| Class | File | Purpose |
|-------|------|---------|
| `LLMClient` | `lib/llm.js` | Provider-routed chat completion. Constructor takes model/provider options. |
| `BrowserManager` | `lib/browser.js` | Manages Puppeteer browser instance. `launch()` / `close()`. Singleton-safe. |
| `Logger` | `lib/logger.js` | Level-based structured logger. `info()`, `warn()`, `error()`, `debug()`. |
| `JobQueue` | `lib/queue.js` | In-memory FIFO queue. `enqueue(job)`, `process(handler)`, `onDone(cb)`. |

## Conventions (core-specific)

- **Zero domain code** — no `analyzeScript`, `generateXxx`, or domain-specific methods. Those live in domain packages' LLMClient subclasses.
- **All I/O abstracted** — browser, logger, queue boundaries are injected, never hardcoded at module level.
- **New core service** → add class in `lib/` → export from `lib/index.js`. Tests go alongside (`*.test.js`).
- **No dependency on other @andy-toolforge packages** — core is the root of the dependency tree.

## Testing

```bash
npm test -w @andy-toolforge/core
```

Uses Node built-in `node --test`. One file per module: `llm.test.js` for `llm.js`.
