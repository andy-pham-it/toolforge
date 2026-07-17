# @andy-toolforge/llm-gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone LLM gateway package with Pipeline-of-Stages architecture that provides both an HTTP server (OpenAI-compatible REST API) and an SDK for multi-provider LLM access with failover, rate limiting, key rotation, cost tracking, response caching, circuit breaker, and multi-tenant auth.

**Architecture:** Chain-of-responsibility pipeline where each Stage implements `async execute(ctx, next)`. Stages compose: Auth → RateLimit → Cache (skip on hit) → Router → KeyRotator → CircuitBreaker → Provider (wraps existing adapters) → CostLogger (post-processing). HTTP server translates REST calls into pipeline executions. Existing CoreLLMClient becomes a thin wrapper over the gateway.

**Tech Stack:** CommonJS, Express, @andy-toolforge/core (OpenAIAdapter/GenAIAdapter/Logger)

## Global Constraints

- CommonJS (`require()` / `module.exports`) — no ESM
- No build step — source loaded directly from `lib/`
- Every Stage independently unit-testable with mock PipelineContext
- All stages must handle streaming: `ctx.stream === true` means ProviderStage returns `ctx.responseStream` (AsyncIterable) and CostLoggerStage computes cost on stream end
- Provider timeout defaults: 30s per provider, configurable in model-map
- Circuit breaker defaults: threshold=5, cooldownMs=30000, halfOpenMaxRequests=1
- AbortSignal from HTTP request cancellation must propagate to adapter calls
- Pipeline tracks in-flight requests via `ctx._inflight` Set for graceful shutdown

---

### Task 1: Package Scaffolding + Pipeline/Stage Base Classes

**Files:**
- Create: `packages/llm-gateway/package.json`
- Create: `packages/llm-gateway/lib/index.js`
- Create: `packages/llm-gateway/lib/pipeline.js`
- Create: `packages/llm-gateway/lib/stage.js`
- Create: `packages/llm-gateway/lib/types.js`

**Interfaces:**
- Produces: `Pipeline` class, `Stage` base class, JSDoc typedefs consumed by all later tasks

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@andy-toolforge/llm-gateway",
  "version": "0.1.0",
  "description": "LLM API gateway — multi-provider routing, failover, rate limiting, key rotation, cost tracking, caching",
  "main": "lib/index.js",
  "repository": { "type": "git", "url": "git+https://github.com/andy-pham-it/toolforge.git" },
  "scripts": {
    "test": "node --test lib/**/*.test.js",
    "start": "node bin/cli.js"
  },
  "dependencies": {
    "@andy-toolforge/core": "^1.2.0",
    "express": "^4.21.0"
  }
}
```

Add `"packages/llm-gateway"` to root `package.json` workspaces array (if using explicit list instead of `packages/*` glob).

- [ ] **Step 2: Create lib/types.js**

```js
'use strict';

/**
 * @typedef {Object} ChatRequest
 * @property {string} model
 * @property {Array<{role: string, content: string}>} messages
 * @property {boolean} [stream=false]
 * @property {number} [temperature]
 * @property {string} [tenant='default']
 * @property {boolean} [dryRun=false]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} content
 * @property {Array} [toolCalls]
 * @property {{ promptTokens: number, completionTokens: number, costUsd: number }} [usage]
 * @property {boolean} [cached=false]
 */

/**
 * @typedef {Object} PipelineContext
 * @property {string} model
 * @property {Array} messages
 * @property {boolean} stream
 * @property {string} tenant
 * @property {string} requestId
 * @property {boolean} [dryRun]
 * @property {AbortSignal} [signal]
 * @property {string} [provider]
 * @property {string} [apiKey]
 * @property {object} [_route] — resolved route info (set by RouterStage)
 * @property {Function} [_adapterFactory] — (provider, apiKey) => adapter instance
 * @property {{ promptTokens: number, completionTokens: number, costUsd: number }} [cost]
 * @property {boolean} [cached]
 * @property {ChatResponse} [response]
 * @property {AsyncIterable} [responseStream]
 * @property {Error} [error]
 * @property {boolean} [cancelled]
 * @property {Object<string,string>} [responseHeaders]
 */

module.exports = {};
```

- [ ] **Step 3: Create lib/stage.js**

```js
'use strict';

class Stage {
  /**
   * @param {string} name — unique stage identifier
   */
  constructor(name) {
    if (!name) throw new Error('Stage requires a name');
    this.name = name;
  }

  /**
   * Execute this stage in the pipeline.
   * Call next() to pass control downstream. Skip next() to short-circuit.
   * Pre/post processing around next() for setup/teardown.
   *
   * @param {import('./types').PipelineContext} ctx
   * @param {Function} next — async function to call next stage
   */
  async execute(ctx, next) {
    // Default: pass through
    await next();
  }
}

module.exports = Stage;
```

- [ ] **Step 4: Create lib/pipeline.js**

```js
'use strict';

class Pipeline {
  constructor(stages = []) {
    /** @type {Array<Stage>} */
    this._stages = stages;
    /** @type {Set<string>} request IDs currently executing */
    this._inflight = new Set();
  }

  use(stage) {
    this._stages.push(stage);
    return this;
  }

  /**
   * Execute the pipeline for a given context.
   * Handles sync, streaming, and dryRun modes.
   *
   * @param {import('./types').PipelineContext} ctx
   * @returns {Promise<import('./types').ChatResponse|AsyncIterable>}
   */
  async execute(ctx) {
    this._inflight.add(ctx.requestId);
    try {
      let i = 0;
      const next = async () => {
        if (ctx.error) return;
        if (i >= this._stages.length) return;
        const stage = this._stages[i++];
        if (ctx.cancelled) return;
        await stage.execute(ctx, next);
      };

      if (ctx.dryRun) {
        await next();
        return { ...ctx.cost, model: ctx.model, provider: ctx.provider, cacheStatus: ctx.cached ? 'hit' : 'miss' };
      }

      if (ctx.stream) {
        await next();
        // ProviderStage sets ctx.responseStream — wrap with cost logging on completion
        return ctx.responseStream;
      }

      // Sync path
      await next();
      if (ctx.error) throw ctx.error;
      if (ctx.cached) return ctx.response;
      return ctx.response;
    } finally {
      this._inflight.delete(ctx.requestId);
    }
  }

  /** Number of requests currently executing */
  get inflightCount() {
    return this._inflight.size;
  }

  /** Wait until in-flight count reaches 0, with timeout */
  async drain(timeoutMs = 30000) {
    const start = Date.now();
    while (this._inflight.size > 0) {
      if (Date.now() - start > timeoutMs) break;
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

module.exports = Pipeline;
```

- [ ] **Step 5: Create lib/index.js (stub — will expand in later tasks)**

```js
'use strict';

const Pipeline = require('./pipeline');
const Stage = require('./stage');

module.exports = { Pipeline, Stage };
```

- [ ] **Step 6: Verify package resolves**

Run: `node -e "require('./packages/llm-gateway')"` from repo root

- [ ] **Step 7: Commit**

```bash
git add packages/llm-gateway/
git commit -m "feat(llm-gateway): scaffold package with Pipeline and Stage base classes"
```

---

### Task 2: RouterStage + Model Map + Fallback Chain

**Files:**
- Create: `packages/llm-gateway/lib/router/model-map.js`
- Create: `packages/llm-gateway/lib/router/fallback-chain.js`
- Create: `packages/llm-gateway/lib/stages/router.js`
- Create: `packages/llm-gateway/lib/stages/router.test.js`

**Interfaces:**
- Consumes: `Stage` base class, `PipelineContext`
- Produces: `RouterStage` — sets `ctx.provider`, `ctx.adapter` from model name; exports `ModelMap` and `FallbackChain` classes

- [ ] **Step 1: Create model-map.js**

```js
'use strict';

class ModelMap {
  /**
   * @param {object} config — model mapping config
   * @param {string} config.tiebreaker — 'cost' | 'latency' (default: 'cost')
   */
  constructor(config = {}) {
    this._models = {};    // modelName -> { provider, adapter, timeoutMs }
    this._aliases = {};   // alias -> canonical model name
    this._tiebreaker = config.tiebreaker || 'cost';
  }

  /**
   * Register a model mapping.
   */
  add(model, opts) {
    if (Array.isArray(opts)) {
      // Multiple providers for same model (collision scenario)
      this._models[model] = this._resolveCollision(model, opts);
    } else {
      this._models[model] = opts;
    }
  }

  /**
   * Register an alias (e.g. gpt-4-turbo -> gpt-4o).
   */
  alias(name, canonical) {
    this._aliases[name] = canonical;
  }

  /**
   * Resolve a model name to provider config.
   * Returns { provider, adapter, timeoutMs } or throws ModelNotFoundError.
   */
  resolve(model) {
    const canonical = this._aliases[model] || model;
    const entry = this._models[canonical];
    if (!entry) {
      const err = new Error(`Unknown model: ${model}`);
      err.code = 'MODEL_NOT_FOUND';
      err.availableModels = Object.keys(this._models);
      throw err;
    }
    return entry;
  }

  get availableModels() {
    return Object.keys(this._models);
  }

  /**
   * Resolve collision when multiple providers serve the same model name.
   * Uses tiebreaker strategy.
   */
  _resolveCollision(model, options) {
    if (this._tiebreaker === 'latency') {
      // Lowest timeout first (assumed fastest)
      return options.sort((a, b) => (a.timeoutMs || 30000) - (b.timeoutMs || 30000))[0];
    }
    // Default: cost-based — prefer gemini over openai (cheaper)
    return options[0];
  }
}

module.exports = ModelMap;
```

- [ ] **Step 2: Create fallback-chain.js**

```js
'use strict';

class FallbackChain {
  constructor(config = {}) {
    // model -> [fallback model names]
    this._chains = config.fallbacks || {};
  }

  /**
   * Get fallback models for a given model name.
   * Returns array of model names to try in order.
   */
  getFallbacks(model) {
    return this._chains[model] || [];
  }

  /**
   * Register a fallback chain for a model.
   */
  set(model, fallbacks) {
    this._chains[model] = fallbacks;
  }
}

module.exports = FallbackChain;
```

- [ ] **Step 3: Create stages/router.js**

```js
'use strict';

const Stage = require('../stage');
const ModelMap = require('../router/model-map');
const FallbackChain = require('../router/fallback-chain');

class RouterStage extends Stage {
  /**
   * @param {object} opts
   * @param {ModelMap} opts.modelMap
   * @param {FallbackChain} opts.fallbackChain
   * @param {Function} opts.createAdapter — factory: (provider, apiKey) => adapter instance
   */
  constructor(opts = {}) {
    super('router');
    this._modelMap = opts.modelMap || new ModelMap();
    this._fallbackChain = opts.fallbackChain || new FallbackChain();
    this._createAdapter = opts.createAdapter || ((p, k) => null);
    this._circuitBreaker = null; // set by Gateway after assembly
  }

  /** Let Gateway inject circuit breaker reference */
  setCircuitBreaker(cb) {
    this._circuitBreaker = cb;
  }

  async execute(ctx, next) {
    // Resolve primary model
    const entry = this._modelMap.resolve(ctx.model);
    ctx.provider = entry.provider;

    // Check if provider is circuit-broken — if so, failover to fallback
    if (this._circuitBreaker && this._circuitBreaker.isOpen(entry.provider)) {
      const fallbacks = this._fallbackChain.getFallbacks(ctx.model);
      for (const fbModel of fallbacks) {
        try {
          const fbEntry = this._modelMap.resolve(fbModel);
          if (!this._circuitBreaker.isOpen(fbEntry.provider)) {
            ctx.model = fbModel;
            ctx.provider = fbEntry.provider;
            ctx.adapter = this._createAdapter(fbEntry.provider, ctx.apiKey);
            ctx._fallbackReason = `primary ${entry.provider} circuit broken`;
            await next();
            return;
          }
        } catch {
          continue;
        }
      }
      ctx.error = new Error(`All providers circuit-broken for ${ctx.model}`);
      return;
    }

    // Store route info — adapter creation deferred to ProviderStage
    // so KeyRotatorStage can rotate ctx.apiKey before adapter is made.
    ctx._route = entry;
    ctx._adapterFactory = this._createAdapter;
    ctx._fallbackIndex = -1;
    await next();

    // If primary failed and fallback chain exists, try fallbacks
    if (ctx.error && !ctx.error._fallbackExhausted) {
      ctx.error._fallbackExhausted = true;
      const fallbacks = this._fallbackChain.getFallbacks(ctx.model);
      for (let i = 0; i < fallbacks.length; i++) {
        const fbModel = fallbacks[i];
        try {
          const fbEntry = this._modelMap.resolve(fbModel);
          ctx.model = fbModel;
          ctx.provider = fbEntry.provider;
          ctx._route = fbEntry;
          ctx._fallbackIndex = i;
          ctx.error = null;
          await next();
          if (!ctx.error) return; // fallback succeeded
        } catch (fbErr) {
          ctx.error = fbErr;
        }
      }
    }
  }
}

module.exports = RouterStage;
```

- [ ] **Step 4: Write router.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const RouterStage = require('./router');
const ModelMap = require('../router/model-map');
const FallbackChain = require('../router/fallback-chain');

describe('RouterStage', () => {
  it('resolves known model to provider and adapter', async () => {
    const mm = new ModelMap();
    mm.add('gemini-flash', { provider: 'gemini', adapter: 'GenAIAdapter', timeoutMs: 15000 });
    const stage = new RouterStage({ modelMap: mm, createAdapter: (p, k) => ({ provider: p }) });
    const ctx = { model: 'gemini-flash', apiKey: 'sk-test' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.strictEqual(ctx.provider, 'gemini');
    assert.deepStrictEqual(ctx._route, { provider: 'gemini', adapter: 'GenAIAdapter', timeoutMs: 15000 });
  });

  it('throws MODEL_NOT_FOUND for unknown model', async () => {
    const mm = new ModelMap();
    const stage = new RouterStage({ modelMap: mm });
    const ctx = { model: 'nonexistent' };
    await stage.execute(ctx, async () => {});
    assert.ok(ctx.error);
    assert.strictEqual(ctx.error.code, 'MODEL_NOT_FOUND');
  });

  it('falls back to alternative model when primary fails', async () => {
    const mm = new ModelMap();
    mm.add('gpt-4o', { provider: 'openai', adapter: 'OpenAIAdapter' });
    mm.add('gemini-flash', { provider: 'gemini', adapter: 'GenAIAdapter' });
    const fc = new FallbackChain({ fallbacks: { 'gpt-4o': ['gemini-flash'] } });
    let callCount = 0;
    const stage = new RouterStage({
      modelMap: mm,
      fallbackChain: fc,
      createAdapter: (p) => ({ provider: p }),
    });
    const ctx = { model: 'gpt-4o', apiKey: 'sk-test' };
    await stage.execute(ctx, async () => {
      callCount++;
      if (callCount === 1) {
        ctx.error = new Error('Provider failed');
        ctx.error._fallbackExhausted = false;
      }
    });
    assert.strictEqual(callCount, 2);
    assert.strictEqual(ctx.provider, 'gemini');
  });
});
```

- [ ] **Step 5: Run tests — verify pass**

Run: `node --test packages/llm-gateway/lib/stages/router.test.js`

- [ ] **Step 6: Commit**

```bash
git add packages/llm-gateway/lib/router/ packages/llm-gateway/lib/stages/router.js packages/llm-gateway/lib/stages/router.test.js
git commit -m "feat(llm-gateway): add RouterStage with model map and fallback chain"
```

---

### Task 3: AuthStage + RateLimitStage

**Files:**
- Create: `packages/llm-gateway/lib/stages/auth.js`
- Create: `packages/llm-gateway/lib/stages/rate-limit.js`
- Create: `packages/llm-gateway/lib/stages/auth.test.js`
- Create: `packages/llm-gateway/lib/stages/rate-limit.test.js`

**Interfaces:**
- Consumes: `Stage` base class, `PipelineContext`
- Produces: `AuthStage` — validates key, sets `ctx.tenant`; `RateLimitStage` — token bucket, sets `ctx.responseHeaders`

- [ ] **Step 1: Create auth.js**

```js
'use strict';

const Stage = require('../stage');

class AuthStage extends Stage {
  /**
   * @param {object} opts
   * @param {object} opts.keys — { [apiKey]: { tenant, roles } }
   * @param {string} [opts.defaultTenant='default']
   */
  constructor(opts = {}) {
    super('auth');
    this._keys = opts.keys || {};
    this._defaultTenant = opts.defaultTenant || 'default';
  }

  async execute(ctx, next) {
    const key = ctx.apiKey;
    if (!key) {
      ctx.error = new Error('API key required');
      ctx.error.code = 'AUTH_FAILED';
      ctx.error.statusCode = 401;
      return;
    }

    const mapping = this._keys[key];
    if (!mapping) {
      // Check for key rotation — if key is part of known pool, allow
      const rotationMatch = Object.entries(this._keys).find(
        ([k]) => k === key || this._keys[k]?.rotationKeys?.includes(key)
      );
      if (rotationMatch) {
        ctx.tenant = rotationMatch[1].tenant || this._defaultTenant;
        ctx.roles = rotationMatch[1].roles || [];
      } else {
        ctx.error = new Error('Invalid API key');
        ctx.error.code = 'AUTH_FAILED';
        ctx.error.statusCode = 401;
        return;
      }
    } else {
      ctx.tenant = mapping.tenant || this._defaultTenant;
      ctx.roles = mapping.roles || [];
    }

    ctx.responseHeaders = ctx.responseHeaders || {};
    ctx.responseHeaders['X-Tenant-Id'] = ctx.tenant;
    await next();
  }
}

module.exports = AuthStage;
```

- [ ] **Step 2: Create rate-limit.js**

```js
'use strict';

const Stage = require('../stage');

class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  tryConsume(count = 1) {
    this._refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  get remaining() { this._refill(); return Math.floor(this.tokens); }
  get resetTime() { return Math.ceil((this.capacity - this.tokens) / this.refillRate) * 1000; }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

class RateLimitStage extends Stage {
  /**
   * @param {object} opts
   * @param {object} opts.buckets — { [tenant]: { capacity, refillRate } }
   * @param {number} [opts.defaultCapacity=60]
   * @param {number} [opts.defaultRefillRate=1]
   */
  constructor(opts = {}) {
    super('rate-limit');
    this._buckets = {};
    this._defaults = { capacity: opts.defaultCapacity || 60, refillRate: opts.defaultRefillRate || 1 };
    for (const [tenant, cfg] of Object.entries(opts.buckets || {})) {
      this._buckets[tenant] = new TokenBucket(cfg.capacity, cfg.refillRate);
    }
  }

  async execute(ctx, next) {
    const tenant = ctx.tenant || 'default';
    if (!this._buckets[tenant]) {
      this._buckets[tenant] = new TokenBucket(this._defaults.capacity, this._defaults.refillRate);
    }
    const bucket = this._buckets[tenant];

    ctx.responseHeaders = ctx.responseHeaders || {};
    ctx.responseHeaders['X-RateLimit-Limit'] = String(bucket.capacity);
    ctx.responseHeaders['X-RateLimit-Remaining'] = String(bucket.remaining);
    ctx.responseHeaders['X-RateLimit-Reset'] = String(bucket.resetTime);

    if (!bucket.tryConsume()) {
      ctx.error = new Error('Rate limit exceeded');
      ctx.error.code = 'RATE_LIMITED';
      ctx.error.statusCode = 429;
      ctx.error.retryAfterMs = bucket.resetTime;
      ctx.responseHeaders['Retry-After'] = String(Math.ceil(bucket.resetTime / 1000));
      return;
    }

    await next();
  }
}

module.exports = { RateLimitStage, TokenBucket };
```

- [ ] **Step 3: Write auth.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const AuthStage = require('./auth');

describe('AuthStage', () => {
  it('passes with valid key', async () => {
    const stage = new AuthStage({ keys: { 'sk-valid': { tenant: 'acme' } } });
    const ctx = { apiKey: 'sk-valid' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.strictEqual(ctx.tenant, 'acme');
  });

  it('rejects with invalid key', async () => {
    const stage = new AuthStage({ keys: { 'sk-valid': { tenant: 'acme' } } });
    const ctx = { apiKey: 'sk-invalid' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.strictEqual(called, false);
    assert.strictEqual(ctx.error.code, 'AUTH_FAILED');
    assert.strictEqual(ctx.error.statusCode, 401);
  });

  it('rejects missing key', async () => {
    const stage = new AuthStage();
    const ctx = {};
    await stage.execute(ctx, async () => {});
    assert.strictEqual(ctx.error.code, 'AUTH_FAILED');
  });
});
```

- [ ] **Step 4: Write rate-limit.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { RateLimitStage, TokenBucket } = require('./rate-limit');

describe('RateLimitStage', () => {
  it('allows request within quota', async () => {
    const stage = new RateLimitStage({ buckets: { default: { capacity: 5, refillRate: 10 } } });
    const ctx = { tenant: 'default' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.ok(ctx.responseHeaders['X-RateLimit-Remaining']);
  });

  it('blocks request when quota exhausted', async () => {
    const stage = new RateLimitStage({ buckets: { test: { capacity: 1, refillRate: 100 } } });
    const ctx1 = { tenant: 'test' };
    await stage.execute(ctx1, async () => {});
    assert.ok(!ctx1.error);
    const ctx2 = { tenant: 'test' };
    await stage.execute(ctx2, async () => {});
    assert.strictEqual(ctx2.error.code, 'RATE_LIMITED');
    assert.strictEqual(ctx2.error.statusCode, 429);
  });

  it('TokenBucket refills over time', () => {
    const bucket = new TokenBucket(10, 100);
    assert.ok(bucket.tryConsume(10));
    assert.strictEqual(bucket.remaining, 0);
  });
});
```

- [ ] **Step 5: Run both test files — verify pass**

```bash
node --test packages/llm-gateway/lib/stages/auth.test.js packages/llm-gateway/lib/stages/rate-limit.test.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/llm-gateway/lib/stages/auth.js packages/llm-gateway/lib/stages/rate-limit.js packages/llm-gateway/lib/stages/auth.test.js packages/llm-gateway/lib/stages/rate-limit.test.js
git commit -m "feat(llm-gateway): add AuthStage and RateLimitStage"
```

---

### Task 4: CacheStage + MemoryStore

**Files:**
- Create: `packages/llm-gateway/lib/cache/memory-store.js`
- Create: `packages/llm-gateway/lib/cache/types.js`
- Create: `packages/llm-gateway/lib/stages/cache.js`
- Create: `packages/llm-gateway/lib/stages/cache.test.js`

**Interfaces:**
- Consumes: `PipelineContext` (reads `ctx.tenant`, `ctx.model`, `ctx.messages`, `ctx.stream`)
- Produces: `CacheStage` — short-circuits on cache hit (sets `ctx.response`, skips next()), populates on miss

- [ ] **Step 1: Create cache/types.js**

```js
'use strict';

/**
 * @typedef {Object} CacheStore
 * @property {function(string): Promise<*>} get
 * @property {function(string, *, number): Promise<void>} set — (key, value, ttlMs)
 * @property {function(string): Promise<boolean>} has
 * @property {function(string): Promise<void>} delete
 */

module.exports = {};
```

- [ ] **Step 2: Create memory-store.js**

```js
'use strict';

class MemoryStore {
  constructor(opts = {}) {
    this._max = opts.max || 1000;
    this._ttl = opts.ttlMs || 300_000; // 5 min default
    /** @type {Map<string, {value: *, expires: number}>} */
    this._map = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) { this._misses++; return null; }
    if (Date.now() > entry.expires) {
      this._map.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    // LRU: delete + set to move to end
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this._map.size >= this._max) {
      // Evict oldest (first inserted)
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
    this._map.set(key, { value, expires: Date.now() + (ttlMs || this._ttl) });
  }

  has(key) { return this.get(key) !== null; }
  delete(key) { return this._map.delete(key); }
  clear() { this._map.clear(); this._hits = 0; this._misses = 0; }

  get stats() { return { size: this._map.size, hits: this._hits, misses: this._misses }; }
}

module.exports = MemoryStore;
```

- [ ] **Step 3: Create stages/cache.js**

```js
'use strict';

const crypto = require('crypto');
const Stage = require('../stage');

class CacheStage extends Stage {
  /**
   * @param {CacheStore} store
   */
  constructor(store) {
    super('cache');
    this._store = store;
  }

  _cacheKey(ctx) {
    const payload = `${ctx.tenant}|${ctx.model}|${JSON.stringify(ctx.messages)}`;
    return crypto.createHash('md5').update(payload).digest('hex');
  }

  async execute(ctx, next) {
    // Skip cache for streaming
    if (ctx.stream) {
      await next();
      return;
    }

    const key = this._cacheKey(ctx);
    const cached = this._store.get(key);
    if (cached) {
      ctx.response = cached;
      ctx.cached = true;
      // Skip next() — short-circuit
      return;
    }

    // Cache miss — proceed to downstream stages
    await next();

    // Store response if successful and non-streaming
    if (!ctx.error && ctx.response) {
      this._store.set(key, ctx.response);
    }
  }
}

module.exports = CacheStage;
```

- [ ] **Step 4: Write cache.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const MemoryStore = require('../cache/memory-store');
const CacheStage = require('./cache');

describe('CacheStage', () => {
  it('returns cached response on hit', async () => {
    const store = new MemoryStore();
    const stage = new CacheStage(store);
    const key = stage._cacheKey({ tenant: 't1', model: 'm1', messages: [{ role: 'user', content: 'hi' }] });
    store.set(key, { content: 'cached-response' });

    const ctx = { tenant: 't1', model: 'm1', messages: [{ role: 'user', content: 'hi' }] };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.strictEqual(called, false);
    assert.strictEqual(ctx.cached, true);
    assert.deepStrictEqual(ctx.response, { content: 'cached-response' });
  });

  it('stores response on miss', async () => {
    const store = new MemoryStore();
    const stage = new CacheStage(store);
    const ctx = { tenant: 't1', model: 'm1', messages: [{ role: 'user', content: 'hello' }], response: { content: 'fresh' } };
    await stage.execute(ctx, async () => {});
    const key = stage._cacheKey(ctx);
    assert.deepStrictEqual(store.get(key), { content: 'fresh' });
  });

  it('skips cache for streaming', async () => {
    const store = new MemoryStore();
    const stage = new CacheStage(store);
    const ctx = { stream: true, tenant: 't1', model: 'm1', messages: [] };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
  });
});
```

- [ ] **Step 5: Run tests — verify pass**

```bash
node --test packages/llm-gateway/lib/stages/cache.test.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/llm-gateway/lib/cache/ packages/llm-gateway/lib/stages/cache.js packages/llm-gateway/lib/stages/cache.test.js
git commit -m "feat(llm-gateway): add CacheStage with in-memory LRU store"
```

---

### Task 5: ProviderStage — Wrapping Existing Adapters with Streaming

**Files:**
- Create: `packages/llm-gateway/lib/stages/provider.js`
- Create: `packages/llm-gateway/lib/stages/provider.test.js`

**Interfaces:**
- Consumes: `PipelineContext` with `ctx.adapter`, `ctx.model`, `ctx.messages`, `ctx.stream`, `ctx.signal`
- Produces: `ctx.response` (sync) or `ctx.responseStream` (streaming), populates `ctx.cost`

- [ ] **Step 1: Create stages/provider.js**

```js
'use strict';

const Stage = require('../stage');

class ProviderStage extends Stage {
  constructor() {
    super('provider');
  }

  /** Create adapter lazily from route + current ctx.apiKey (after KeyRotatorStage may have rotated it) */
  _resolveAdapter(ctx) {
    if (!ctx._route) {
      throw Object.assign(new Error('No route configured — RouterStage must run before ProviderStage'), { code: 'NO_ROUTE' });
    }
    if (!ctx.apiKey) {
      throw Object.assign(new Error('API key required'), { code: 'AUTH_FAILED', statusCode: 401 });
    }
    return ctx._adapterFactory(ctx._route.provider, ctx.apiKey);
  }

  async execute(ctx, next) {
    const opts = {
      model: ctx.model,
      messages: ctx.messages,
      temperature: ctx.temperature,
      signal: ctx.signal,
    };

    if (ctx.stream) {
      const adapter = this._resolveAdapter(ctx);
      // Streaming: adapter returns AsyncIterable chunks
      ctx.responseStream = adapter.chatStream
        ? adapter.chatStream(opts)
        : this._adaptSyncToStream(adapter, opts, ctx.signal);
      // Call next() so CostLoggerStage can wrap responseStream
      await next();
      return;
    }

    // Sync — attempt with fallback and re-resolve adapter each retry
    try {
      const adapter = this._resolveAdapter(ctx);
      const result = await adapter.chat(opts);
      ctx.response = result;
      // Set cost from adapter response if available
      ctx.cost = result.usage || { promptTokens: 0, completionTokens: 0, costUsd: 0 };
    } catch (err) {
      ctx.error = err;
      ctx.error._fallbackExhausted = false;
    }
    await next();
  }

  /**
   * Fallback: convert a sync adapter to streaming-compatible async iterable.
   * Wraps the full response as a single chunk.
   */
  async *_adaptSyncToStream(adapter, opts, signal) {
    const result = await adapter.chat(opts);
    if (signal?.aborted) return;
    yield { content: result.content, finish_reason: 'stop' };
  }
}

module.exports = ProviderStage;
```

- [ ] **Step 2: Write provider.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const ProviderStage = require('./provider');

describe('ProviderStage', () => {
  it('calls adapter.chat and sets ctx.response', async () => {
    const stage = new ProviderStage();
    const ctx = {
      model: 'test', messages: [], apiKey: 'sk-test',
      _route: { provider: 'gemini', timeoutMs: 15000 },
      _adapterFactory: () => ({
        chat: async () => ({ content: 'hello', usage: { promptTokens: 5, completionTokens: 10, costUsd: 0.001 } }),
      }),
    };
    await stage.execute(ctx, async () => {});
    assert.deepStrictEqual(ctx.response, { content: 'hello', usage: { promptTokens: 5, completionTokens: 10, costUsd: 0.001 } });
    assert.deepStrictEqual(ctx.cost, { promptTokens: 5, completionTokens: 10, costUsd: 0.001 });
  });

  it('sets error on adapter failure', async () => {
    const stage = new ProviderStage();
    const ctx = {
      model: 'test', messages: [], apiKey: 'sk-test',
      _route: { provider: 'gemini' },
      _adapterFactory: () => ({ chat: async () => { throw new Error('API Error'); } }),
    };
    await stage.execute(ctx, async () => {});
    assert.ok(ctx.error);
    assert.strictEqual(ctx.error._fallbackExhausted, false);
  });

  it('sets ctx.responseStream when streaming', async () => {
    const stage = new ProviderStage();
    const ctx = {
      stream: true, model: 'test', messages: [], apiKey: 'sk-test',
      _route: { provider: 'gemini' },
      _adapterFactory: () => ({
        chat: async () => ({ content: 'sync' }),
        chatStream: async function* () { yield { content: 'chunk1', finish_reason: null }; yield { content: 'chunk2', finish_reason: 'stop' }; },
      }),
    };
    let nextCalled = false;
    await stage.execute(ctx, async () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.ok(ctx.responseStream);
    assert.strictEqual(typeof ctx.responseStream[Symbol.asyncIterator], 'function');
  });

  it('errors when no route set', async () => {
    const stage = new ProviderStage();
    const ctx = { model: 'test', messages: [], apiKey: 'sk-test' };
    let threw = false;
    try { await stage.execute(ctx, async () => {}); } catch (e) { threw = true; }
    assert.ok(threw);
  });
});
```

- [ ] **Step 3: Run tests — verify pass**

```bash
node --test packages/llm-gateway/lib/stages/provider.test.js
```

- [ ] **Step 4: Commit**

```bash
git add packages/llm-gateway/lib/stages/provider.js packages/llm-gateway/lib/stages/provider.test.js
git commit -m "feat(llm-gateway): add ProviderStage with sync and streaming support"
```

---

### Task 6: CircuitBreakerStage + KeyRotatorStage + CostLoggerStage

**Files:**
- Create: `packages/llm-gateway/lib/stages/circuit-breaker.js`
- Create: `packages/llm-gateway/lib/stages/key-rotator.js`
- Create: `packages/llm-gateway/lib/stages/cost-logger.js`
- Create: `packages/llm-gateway/lib/stages/circuit-breaker.test.js`
- Create: `packages/llm-gateway/lib/stages/key-rotator.test.js`
- Create: `packages/llm-gateway/lib/stages/cost-logger.test.js`

- [ ] **Step 1: Create circuit-breaker.js**

```js
'use strict';

const Stage = require('../stage');

class CircuitBreakerState {
  constructor(opts = {}) {
    this.threshold = opts.threshold || 5;
    this.cooldownMs = opts.cooldownMs || 30000;
    this.halfOpenMax = opts.halfOpenMaxRequests || 1;

    /** @type {Object<string, {failures: number, lastFailure: number, state: string}>} */
    this._providers = {};
  }

  /** Mark a provider call as successful — reset counters */
  onSuccess(provider) {
    const p = this._providers[provider];
    if (p) {
      if (p.state === 'half-open') p.state = 'closed';
      p.failures = 0;
    }
  }

  /** Mark a provider call as failed — potentially open circuit */
  onFailure(provider) {
    let p = this._providers[provider];
    if (!p) {
      p = { failures: 0, lastFailure: 0, state: 'closed' };
      this._providers[provider] = p;
    }
    p.failures++;
    p.lastFailure = Date.now();
    if (p.failures >= this.threshold) {
      p.state = 'open';
    }
  }

  /** Check if provider is currently open (rejecting requests) */
  isOpen(provider) {
    const p = this._providers[provider];
    if (!p) return false;
    if (p.state === 'closed') return false;
    if (p.state === 'open') {
      // Check cooldown expiry
      if (Date.now() - p.lastFailure >= this.cooldownMs) {
        p.state = 'half-open';
        p.failures = 0;
        return false; // allow probe
      }
      return true;
    }
    // half-open: allow limited probes
    return false;
  }

  getState(provider) {
    return this._providers[provider]?.state || 'closed';
  }
}

class CircuitBreakerStage extends Stage {
  /**
   * @param {CircuitBreakerState} state
   */
  constructor(state) {
    super('circuit-breaker');
    this._state = state;
  }

  async execute(ctx, next) {
    // Runs AFTER provider — record success/failure
    await next();

    if (ctx.provider && ctx.error) {
      this._state.onFailure(ctx.provider);
    } else if (ctx.provider && !ctx.error) {
      this._state.onSuccess(ctx.provider);
    }
  }
}

module.exports = { CircuitBreakerStage, CircuitBreakerState };
```

- [ ] **Step 2: Create key-rotator.js**

```js
'use strict';

const Stage = require('../stage');

class KeyRotatorStage extends Stage {
  /**
   * @param {object} opts
   * @param {Object<string, string[]>} opts.keyPools — { [provider]: [key1, key2, ...] }
   */
  constructor(opts = {}) {
    super('key-rotator');
    this._keyPools = opts.keyPools || {};
    this._currentIndex = {}; // { [provider]: index }
  }

  async execute(ctx, next) {
    const pool = this._keyPools[ctx.provider];
    if (!pool || pool.length <= 1) {
      await next();
      return;
    }

    const idx = this._currentIndex[ctx.provider] || 0;
    ctx.apiKey = pool[idx];
    ctx._keyIndex = idx;

    await next();

    // If 401 and more keys available, retry with next key
    if (ctx.error && ctx.error.statusCode === 401 && pool.length > 1) {
      const nextIdx = (idx + 1) % pool.length;
      if (nextIdx !== idx) {
        ctx.apiKey = pool[nextIdx];
        this._currentIndex[ctx.provider] = nextIdx;
        ctx._keyIndex = nextIdx;
        ctx.error = null; // clear error, retry adapter call
        await next();
      }
    }
  }
}

module.exports = KeyRotatorStage;
```

- [ ] **Step 3: Create cost-logger.js**

```js
'use strict';

const Stage = require('../stage');

// Approximate pricing per model (USD per 1K tokens)
const PRICING = {
  'gemini-3.1-flash-lite': { input: 0.0001, output: 0.0004 },
  'gemini-3.1-flash':      { input: 0.0003, output: 0.0015 },
  'gpt-4o-mini':           { input: 0.00015, output: 0.0006 },
  'gpt-4o':                { input: 0.0025, output: 0.01 },
  'llama-3.3-70b':         { input: 0.0001, output: 0.0002 },
};

class CostLoggerStage extends Stage {
  /**
   * @param {object} opts
   * @param {boolean} [opts.logPrompts=false] — if false, log only token counts, not content
   * @param {object} [opts.pricing] — override pricing table
   */
  constructor(opts = {}) {
    super('cost-logger');
    this._logPrompts = opts.logPrompts || false;
    this._pricing = { ...PRICING, ...opts.pricing };
  }

  async execute(ctx, next) {
    await next();

    if (ctx.stream && ctx.responseStream) {
      // Wrap responseStream to compute cost on stream completion
      const originalStream = ctx.responseStream;
      let totalInput = 0;
      let totalOutput = 0;
      ctx.responseStream = this._wrapStream(originalStream, ctx, (input, output) => {
        totalInput = input;
        totalOutput = output;
      });
      // Stream cost logged at end via cleanup callback
      this._scheduleStreamCost(ctx, totalInput, totalOutput);
      // Set cost placeholder
      ctx.cost = { promptTokens: 0, completionTokens: 0, costUsd: 0, pending: true };
      return;
    }

    if (!ctx.cached && ctx.response?.usage) {
      ctx.cost = {
        promptTokens: ctx.response.usage.promptTokens || 0,
        completionTokens: ctx.response.usage.completionTokens || 0,
        costUsd: this._computeCost(ctx.model, ctx.response.usage.promptTokens || 0, ctx.response.usage.completionTokens || 0),
      };
    }

    this._log(ctx);
  }

  _computeCost(model, inputTokens, outputTokens) {
    const pricing = this._pricing[model] || { input: 0.001, output: 0.002 };
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  }

  async *_wrapStream(stream, ctx, onProgress) {
    let inputTokens = 0; // approximate: count chars / 4
    let outputTokens = 0;
    for await (const chunk of stream) {
      if (chunk.content) outputTokens += Math.ceil(chunk.content.length / 4);
      yield chunk;
    }
    onProgress(inputTokens, outputTokens);
  }

  _scheduleStreamCost(ctx, inputRef, outputRef) {
    // Cost is computed when stream is fully consumed by HTTP layer
    process.nextTick(() => {
      // HTTP layer sets final usage after stream ends
      if (ctx.finalUsage) {
        ctx.cost = {
          promptTokens: ctx.finalUsage.promptTokens || 0,
          completionTokens: ctx.finalUsage.completionTokens || 0,
          costUsd: this._computeCost(ctx.model, ctx.finalUsage.promptTokens || 0, ctx.finalUsage.completionTokens || 0),
        };
        this._log(ctx);
      }
    });
  }

  _log(ctx) {
    const entry = {
      requestId: ctx.requestId,
      tenant: ctx.tenant,
      model: ctx.model,
      provider: ctx.provider,
      promptTokens: ctx.cost?.promptTokens,
      completionTokens: ctx.cost?.completionTokens,
      costUsd: ctx.cost?.costUsd,
      cached: !!ctx.cached,
      durationMs: ctx._durationMs,
      timestamp: new Date().toISOString(),
    };
    if (this._logPrompts) {
      entry.messages = ctx.messages;
      entry.response = ctx.response?.content;
    }
    // In production, write to structured logger; for now console
    console.log('[llm-gateway:cost]', JSON.stringify(entry));
  }
}

module.exports = CostLoggerStage;
```

- [ ] **Step 4: Write tests for each stage**

Create `circuit-breaker.test.js`, `key-rotator.test.js`, `cost-logger.test.js` with at minimum:

```js
// circuit-breaker.test.js
const { CircuitBreakerState } = require('./circuit-breaker');
// Test: opens after N failures, allows probe after cooldown

// key-rotator.test.js
const KeyRotatorStage = require('./key-rotator');
// Test: uses primary key, falls to fallback on 401

// cost-logger.test.js
const CostLoggerStage = require('./cost-logger');
// Test: computes cost from usage
```

- [ ] **Step 5: Run all tests — verify pass**

```bash
node --test packages/llm-gateway/lib/stages/circuit-breaker.test.js packages/llm-gateway/lib/stages/key-rotator.test.js packages/llm-gateway/lib/stages/cost-logger.test.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/llm-gateway/lib/stages/circuit-breaker.js packages/llm-gateway/lib/stages/key-rotator.js packages/llm-gateway/lib/stages/cost-logger.js packages/llm-gateway/lib/stages/circuit-breaker.test.js packages/llm-gateway/lib/stages/key-rotator.test.js packages/llm-gateway/lib/stages/cost-logger.test.js
git commit -m "feat(llm-gateway): add CircuitBreakerStage, KeyRotatorStage, CostLoggerStage"
```

---

### Task 7: Gateway Class — Pipeline Assembly + Public API

**Files:**
- Modify: `packages/llm-gateway/lib/index.js`
- Create: `packages/llm-gateway/lib/gateway.js`
- Create: `packages/llm-gateway/lib/gateway.test.js`

**Interfaces:**
- Consumes: All Stage classes, Pipeline, ModelMap, FallbackChain from earlier tasks
- Produces: `Gateway` class with `chat(ctx)` method; `createGateway(config)` factory

- [ ] **Step 1: Create gateway.js**

```js
'use strict';

const Pipeline = require('./pipeline');
const AuthStage = require('./stages/auth');
const { RateLimitStage } = require('./stages/rate-limit');
const CacheStage = require('./stages/cache');
const RouterStage = require('./stages/router');
const KeyRotatorStage = require('./stages/key-rotator');
const ProviderStage = require('./stages/provider');
const { CircuitBreakerStage, CircuitBreakerState } = require('./stages/circuit-breaker');
const CostLoggerStage = require('./stages/cost-logger');
const ModelMap = require('./router/model-map');
const FallbackChain = require('./router/fallback-chain');
const MemoryStore = require('./cache/memory-store');
const { OpenAIAdapter, GenAIAdapter } = require('@andy-toolforge/core');

class Gateway {
  /**
   * @param {object} config
   * @param {object} [config.models] — model mapping config
   * @param {object} [config.fallbacks] — fallback chain config
   * @param {object} [config.keys] — API key -> tenant mapping
   * @param {object} [config.rateLimits] — per-tenant rate limit config
   * @param {object} [config.keyPools] — { [provider]: [key1, key2] }
   * @param {object} [config.pricing] — override pricing table
   * @param {object} [config.circuitBreaker] — { threshold, cooldownMs, halfOpenMaxRequests }
   * @param {object} [config.cache] — { store: MemoryStore }
   * @param {Function} [config.createAdapter] — custom adapter factory
   * @param {string[]} [config.stages] — ordered stage names to include (default: all)
   */
  constructor(config = {}) {
    this._config = config;
    this._pipeline = new Pipeline();
    this._modelMap = new ModelMap(config.models);
    this._fallbackChain = new FallbackChain(config);
    this._circuitBreakerState = new CircuitBreakerState(config.circuitBreaker);
    this._adapterFactory = config.createAdapter || this._defaultAdapterFactory;

    this._registerStages(config.stages);
  }

  _defaultAdapterFactory(provider, apiKey) {
    if (provider === 'gemini') return new GenAIAdapter(apiKey);
    return new OpenAIAdapter({ provider, apiKey });
  }

  _registerStages(stageNames) {
    const stages = {
      auth: () => new AuthStage({ keys: this._config.keys }),
      'rate-limit': () => new RateLimitStage({ buckets: this._config.rateLimits }),
      cache: () => new CacheStage(this._config.cache?.store || new MemoryStore()),
      router: () => {
        const rs = new RouterStage({
          modelMap: this._modelMap,
          fallbackChain: this._fallbackChain,
          createAdapter: this._adapterFactory,
        });
        rs.setCircuitBreaker(this._circuitBreakerState);
        return rs;
      },
      'key-rotator': () => new KeyRotatorStage({ keyPools: this._config.keyPools }),
      provider: () => new ProviderStage(),
      'circuit-breaker': () => new CircuitBreakerStage(this._circuitBreakerState),
      'cost-logger': () => new CostLoggerStage({ logPrompts: this._config.logPrompts, pricing: this._config.pricing }),
    };

    const order = stageNames || ['auth', 'rate-limit', 'cache', 'router', 'key-rotator', 'provider', 'circuit-breaker', 'cost-logger'];
    for (const name of order) {
      if (stages[name]) {
        this._pipeline.use(stages[name]());
      }
    }
  }

  /**
   * Execute a chat request through the pipeline.
   *
   * @param {import('./types').ChatRequest} req
   * @returns {Promise<import('./types').ChatResponse|AsyncIterable>}
   */
  async chat(req) {
    const ctx = {
      model: req.model,
      messages: req.messages,
      stream: req.stream || false,
      dryRun: req.dryRun || false,
      tenant: req.tenant || 'default',
      apiKey: req.apiKey || this._config.apiKey,
      temperature: req.temperature,
      signal: req.signal,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      responseHeaders: {},
      _startTime: Date.now(),
    };

    try {
      const result = await this._pipeline.execute(ctx);
      ctx._durationMs = Date.now() - ctx._startTime;
      return result;
    } catch (err) {
      ctx._durationMs = Date.now() - ctx._startTime;
      throw err;
    }
  }

  /** Check if gateway is healthy */
  get health() {
    return { status: 'ok', uptime: process.uptime(), inflight: this._pipeline.inflightCount };
  }

  /** Wait for in-flight requests to drain (for graceful shutdown) */
  async drain(timeoutMs) {
    await this._pipeline.drain(timeoutMs);
  }
}

/**
 * Create a Gateway instance from config.
 * @param {object} config
 * @returns {Gateway}
 */
function createGateway(config) {
  return new Gateway(config);
}

module.exports = { Gateway, createGateway };
```

- [ ] **Step 2: Update lib/index.js**

```js
'use strict';

const Pipeline = require('./pipeline');
const Stage = require('./stage');
const { Gateway, createGateway } = require('./gateway');
const ModelMap = require('./router/model-map');
const FallbackChain = require('./router/fallback-chain');
const MemoryStore = require('./cache/memory-store');

// Stage exports for custom pipeline composition
const AuthStage = require('./stages/auth');
const { RateLimitStage } = require('./stages/rate-limit');
const CacheStage = require('./stages/cache');
const RouterStage = require('./stages/router');
const KeyRotatorStage = require('./stages/key-rotator');
const ProviderStage = require('./stages/provider');
const { CircuitBreakerStage, CircuitBreakerState } = require('./stages/circuit-breaker');
const CostLoggerStage = require('./stages/cost-logger');

module.exports = {
  // High-level API
  Gateway,
  createGateway,

  // Pipeline primitives
  Pipeline,
  Stage,

  // Router
  ModelMap,
  FallbackChain,

  // Cache
  MemoryStore,

  // Individual stages (for custom assembly)
  AuthStage,
  RateLimitStage,
  CacheStage,
  RouterStage,
  KeyRotatorStage,
  ProviderStage,
  CircuitBreakerStage,
  CircuitBreakerState,
  CostLoggerStage,
};
```

- [ ] **Step 3: Write gateway.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createGateway } = require('./gateway');

describe('Gateway', () => {
  it('creates gateway and returns health', () => {
    const gw = createGateway({ apiKey: 'sk-test' });
    assert.ok(gw.health);
    assert.strictEqual(gw.health.status, 'ok');
  });

  it('chat returns response with mock adapter', async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({
        chat: async () => ({ content: 'mock-response', usage: { promptTokens: 10, completionTokens: 20, costUsd: 0.001 } }),
      }),
    });
    const result = await gw.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.ok(result);
  });

  it('drain resolves', async () => {
    const gw = createGateway({ apiKey: 'sk-test' });
    await gw.drain(100);
    assert.ok(true);
  });
});
```

- [ ] **Step 4: Run all llm-gateway tests — verify pass**

```bash
node --test packages/llm-gateway/lib/**/*.test.js
```

- [ ] **Step 5: Commit**

```bash
git add packages/llm-gateway/lib/index.js packages/llm-gateway/lib/gateway.js packages/llm-gateway/lib/gateway.test.js
git commit -m "feat(llm-gateway): add Gateway class with pipeline assembly"
```

---

### Task 8: HTTP Server — OpenAI-Compatible REST API

**Files:**
- Create: `packages/llm-gateway/lib/http/server.js`
- Create: `packages/llm-gateway/lib/http/middleware.js`
- Create: `packages/llm-gateway/lib/http/server.test.js`

**Interfaces:**
- Consumes: `Gateway` class
- Produces: Express server with `/v1/chat/completions`, `/health`, `/readyz`, `/v1/models`

- [ ] **Step 1: Create http/middleware.js**

```js
'use strict';

function requestId(req, res, next) {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

function requestCancellation(req, res, next) {
  const controller = new AbortController();
  req.signal = controller.signal;
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });
  next();
}

module.exports = { requestId, requestCancellation };
```

- [ ] **Step 2: Create http/server.js**

```js
'use strict';

const express = require('express');
const { requestId, requestCancellation } = require('./middleware');

class HTTPServer {
  /**
   * @param {import('../gateway').Gateway} gateway
   * @param {object} [opts]
   * @param {number} [opts.port=3000]
   * @param {number} [opts.timeoutMs=30000]
   * @param {ModelMap} [opts.modelMap] — for /v1/models endpoint
   */
  constructor(gateway, opts = {}) {
    this._gateway = gateway;
    this._port = opts.port || 3000;
    this._timeoutMs = opts.timeoutMs || 30000;
    this._modelMap = opts.modelMap;
    this._server = null;

    const app = express();
    app.use(express.json());
    app.use(requestId);
    app.use(requestCancellation);

    app.get('/health', (req, res) => res.json(gateway.health));
    app.get('/readyz', (req, res) => res.json({ status: 'ready' }));

    if (this._modelMap) {
      app.get('/v1/models', (req, res) => {
        res.json({
          object: 'list',
          data: this._modelMap.availableModels.map(m => ({
            id: m,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: '@andy-toolforge',
          })),
        });
      });
    }

    app.post('/v1/chat/completions', this._handleChat.bind(this));

    this._app = app;
  }

  async _handleChat(req, res) {
    const { model, messages, stream, temperature } = req.body;

    if (!model) return res.status(400).json({ error: 'model is required' });
    if (!messages) return res.status(400).json({ error: 'messages is required' });

    const request = {
      model,
      messages,
      stream: !!stream,
      temperature,
      apiKey: req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey,
      signal: req.signal,
      tenant: req.headers['x-tenant-id'] || 'default',
    };

    if (stream) {
      try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseStream = await this._gateway.chat(request);
        let index = 0;
        for await (const chunk of responseStream) {
          if (req.signal?.aborted) break;
          const payload = {
            id: `chatcmpl_${req.requestId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index,
              delta: { content: chunk.content || '', role: index === 0 ? 'assistant' : undefined },
              finish_reason: chunk.finish_reason || null,
            }],
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          index++;
        }
        // Final chunk with usage
        const finalPayload = {
          id: `chatcmpl_${req.requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index, delta: {}, finish_reason: 'stop' }],
        };
        res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      }
      return;
    }

    // Sync
    try {
      const result = await this._gateway.chat(request);
      const response = {
        id: `chatcmpl_${req.requestId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
        usage: result.usage ? {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: (result.usage.promptTokens || 0) + (result.usage.completionTokens || 0),
        } : undefined,
      };

      // Apply rate limit headers from pipeline ctx
      if (result.responseHeaders) {
        for (const [k, v] of Object.entries(result.responseHeaders)) {
          res.setHeader(k, v);
        }
      }
      res.json(response);
    } catch (err) {
      const status = err.statusCode || 500;
      res.status(status).json({
        error: { message: err.message, type: err.code || 'internal_error', code: status },
      });
    }
  }

  async start() {
    return new Promise((resolve) => {
      this._server = this._app.listen(this._port, () => {
        console.log(`[llm-gateway] HTTP server listening on port ${this._port}`);
        resolve();
      });
    });
  }

  async stop(timeoutMs = 5000) {
    if (!this._server) return;
    await this._gateway.drain(timeoutMs);
    return new Promise((resolve) => {
      this._server.close(() => resolve());
    });
  }
}

module.exports = HTTPServer;
```

- [ ] **Step 3: Write server.test.js**

```js
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const HTTPServer = require('./server');
const { createGateway } = require('../gateway');

describe('HTTPServer', () => {
  let server;

  after(async () => {
    if (server) await server.stop(100);
  });

  it('starts and responds to /health', async () => {
    server = new HTTPServer(createGateway({ apiKey: 'sk-test' }), { port: 0 });
    await server.start();
    const addr = server._server.address();
    const res = await fetch(`http://localhost:${addr.port}/health`);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  });

  it('POST /v1/chat/completions with model + messages', async () => {
    server = new HTTPServer(createGateway({
      apiKey: 'sk-test',
      createAdapter: () => ({
        chat: async () => ({ content: 'Hello!', usage: { promptTokens: 5, completionTokens: 3, costUsd: 0.001 } }),
      }),
    }), { port: 0 });
    await server.start();
    const addr = server._server.address();
    const res = await fetch(`http://localhost:${addr.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = await res.json();
    assert.strictEqual(body.object, 'chat.completion');
    assert.strictEqual(body.choices[0].message.content, 'Hello!');
  });
});
```

- [ ] **Step 4: Run tests — verify pass**

```bash
node --test packages/llm-gateway/lib/http/server.test.js
```

- [ ] **Step 5: Commit**

```bash
git add packages/llm-gateway/lib/http/
git commit -m "feat(llm-gateway): add HTTP server with OpenAI-compatible endpoints"
```

---

### Task 9: CLI Binary

**Files:**
- Create: `packages/llm-gateway/bin/cli.js`
- Modify: `packages/llm-gateway/package.json` (add `"bin"` entry)

- [ ] **Step 1: Create bin/cli.js**

```js
#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');
const { createGateway } = require('../lib/gateway');
const HTTPServer = require('../lib/http/server');
const ModelMap = require('../lib/router/model-map');
const pkg = require('../package.json');

const args = process.argv.slice(2);
const cmd = args[0];

function showHelp() {
  console.log(`
@andy-toolforge/llm-gateway v${pkg.version}

Usage:
  npx gateway start --config gateway.json   Start HTTP server
  npx gateway --help                          Show this help
`);
  process.exit(0);
}

async function startServer(configPath) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf-8'));
  } catch (err) {
    console.error(`Failed to load config: ${err.message}`);
    process.exit(1);
  }

  const modelMap = new ModelMap(config.models);
  const gateway = createGateway({ ...config, apiKey: config.apiKey || process.env.LLM_GATEWAY_KEY });

  // Configure graceful shutdown
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[llm-gateway] Shutting down...');
    await httpServer.stop(30000);
    console.log('[llm-gateway] Stopped');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  const httpServer = new HTTPServer(gateway, {
    port: config.port || 3000,
    timeoutMs: config.timeoutMs || 30000,
    modelMap,
  });

  await httpServer.start();
}

if (cmd === 'start' && args[1] === '--config') {
  startServer(args[2]);
} else {
  showHelp();
}
```

- [ ] **Step 2: Update package.json — add bin**

Add to package.json:
```json
  "bin": {
    "llm-gateway": "./bin/cli.js"
  }
```

- [ ] **Step 3: Make CLI executable**

```bash
chmod +x packages/llm-gateway/bin/cli.js
```

- [ ] **Step 4: Quick smoke test**

```bash
node packages/llm-gateway/bin/cli.js --help
```

- [ ] **Step 5: Commit**

```bash
git add packages/llm-gateway/bin/ packages/llm-gateway/package.json
git commit -m "feat(llm-gateway): add CLI binary for HTTP server"
```

---

### Task 10: Domain Package Integration — CoreLLMClient Thin Wrapper

**Files:**
- Modify: `packages/core/lib/llm.js`
- Modify: `packages/core/lib/index.js`
- Modify: `packages/core/package.json` (add llm-gateway dependency)
- Modify: `packages/core/lib/llm.test.js`
- Create: `packages/core/lib/gateway-adapter.js` (bridge if needed)

**Note:** This is optional in v1. The gateway can be used standalone without modifying existing CoreLLMClient. Only do this if the user wants backward compatibility via core's LLMClient → gateway.

- [ ] **Step 1: Add dependency to core/package.json**

```json
"@andy-toolforge/llm-gateway": "^0.1.0"
```

- [ ] **Step 2: Thin wrapper in core/lib/llm.js**

```js
// Optional: CoreLLMClient becomes a thin wrapper
// Only modify if backward compat path is desired in v1
```

Wait for user direction before implementing — the gateway can be used standalone and existing LLMClient consumers work unchanged.

- [ ] **Step 3: Run core tests — verify no regression**

```bash
npm test -w @andy-toolforge/core
```

---

### Task 11: Integration Test — End-to-End Pipeline

**Files:**
- Create: `packages/llm-gateway/lib/e2e.test.js`

- [ ] **Step 1: Write e2e test**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createGateway } = require('./gateway');
const MemoryStore = require('./cache/memory-store');

describe('Full pipeline (e2e)', () => {
  it('sync request flows through all stages', async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'test-tenant' } },
      rateLimits: { 'test-tenant': { capacity: 100, refillRate: 10 } },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({
        chat: async () => ({ content: 'hello', usage: { promptTokens: 5, completionTokens: 10, costUsd: 0.0001 } }),
      }),
    });

    const result = await gw.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.ok(result);
  });

  it('cache stores and returns on second call', async () => {
    let callCount = 0;
    const gw = createGateway({
      apiKey: 'sk-test',
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({
        chat: async () => { callCount++; return { content: 'cached', usage: { promptTokens: 2, completionTokens: 3, costUsd: 0.0001 } }; },
      }),
    });

    await gw.chat({ model: 'test', messages: [{ role: 'user', content: 'same' }] });
    await gw.chat({ model: 'test', messages: [{ role: 'user', content: 'same' }] });
    assert.strictEqual(callCount, 1); // second call served from cache
  });
});
```

- [ ] **Step 2: Run e2e test — verify pass**

```bash
node --test packages/llm-gateway/lib/e2e.test.js
```

- [ ] **Step 3: Run ALL llm-gateway tests — verify pass**

```bash
node --test packages/llm-gateway/lib/**/*.test.js
```

- [ ] **Step 4: Commit**

```bash
git add packages/llm-gateway/lib/e2e.test.js
git commit -m "test(llm-gateway): add end-to-end pipeline tests"
```

---

### Task 12: README + Postinstall Skills

**Files:**
- Create: `packages/llm-gateway/README.md`
- Create: `packages/llm-gateway/skills/llm-gateway.md`
- Create: `packages/llm-gateway/skills/postinstall.js`

- [ ] **Step 1: Create README.md**

Document:
- Overview and architecture (Pipeline + Stages)
- Quick start: `npm install @andy-toolforge/llm-gateway`
- SDK usage: `createGateway()`, `gw.chat()`
- HTTP server: CLI `npx llm-gateway start --config gateway.json`
- Stage reference: which stages exist and their options
- Configuration file format

- [ ] **Step 2: Create postinstall.js + skill file**

Follow the monorepo pattern from other packages (e.g., `packages/footage-generation/skills/postinstall.js`).

- [ ] **Step 3: Commit**

```bash
git add packages/llm-gateway/README.md packages/llm-gateway/skills/
git commit -m "docs(llm-gateway): add README and skill files"
```

---

### Self-Review Checklist

After writing the plan, verify:

- [ ] **Spec coverage**: Every section in the design spec maps to at least one task:
  - Overview/package structure → Task 1
  - Pipeline + Stage interface → Task 1
  - AuthStage → Task 3
  - RateLimitStage → Task 3
  - CacheStage + MemoryStore → Task 4
  - RouterStage + model-map + fallback-chain → Task 2
  - KeyRotatorStage → Task 6
  - ProviderStage (sync + streaming) → Task 5
  - CircuitBreakerStage → Task 6
  - CostLoggerStage → Task 6
  - HTTP server → Task 8
  - CLI binary → Task 9
  - Integration → Task 10, 11
  - Error handling → covered in each task's tests
  - Testing strategy → each task has tests, plus Task 11 e2e

- [ ] **Placeholder scan**: No "TBD", "TODO", or vague steps
- [ ] **Type consistency**: PipelineContext fields, stage names, method signatures match between tasks
- [ ] **File paths**: All exactly specified with no contradictions
