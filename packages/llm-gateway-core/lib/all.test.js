'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const Pipeline = require('./pipeline');
const Stage = require('./stage');
const AuthStage = require('./stages/auth');
const { RateLimitStage, TokenBucket } = require('./stages/rate-limit');
const CacheStage = require('./stages/cache');
const RouterStage = require('./stages/router');
const KeyRotatorStage = require('./stages/key-rotator');
const ProviderStage = require('./stages/provider');
const { CircuitBreakerStage, CircuitBreakerState } = require('./stages/circuit-breaker');
const CostLoggerStage = require('./stages/cost-logger');
const MemoryStore = require('./cache/memory-store');
const ModelMap = require('./router/model-map');
const FallbackChain = require('./router/fallback-chain');
const createPipeline = require('./create-pipeline');

// Stage base

describe('Stage', () => {
  it('sets name from constructor', () => {
    const s = new (class extends Stage {
      constructor() { super('test'); }
    })();
    assert.strictEqual(s.name, 'test');
  });

  it('passes through by default', async () => {
    let called = false;
    const s = new (class extends Stage {
      constructor() { super('pt'); }
    })();
    const next = async () => { called = true; };
    await s.execute({}, next);
    assert.strictEqual(called, true);
  });
});

// Pipeline

describe('Pipeline', () => {
  it('executes stages in order', async () => {
    const p = new Pipeline();
    const order = [];
    class A extends Stage {
      constructor() { super('a'); }
      async execute(ctx, next) { order.push('a'); await next(); }
    }
    class B extends Stage {
      constructor() { super('b'); }
      async execute(ctx, next) { order.push('b'); await next(); }
    }
    p.use(new A()).use(new B());
    const ctx = { requestId: 'r1' };
    await p.execute(ctx);
    assert.deepStrictEqual(order, ['a', 'b']);
  });

  it('reports inflight count', () => {
    const p = new Pipeline();
    assert.strictEqual(p.inflightCount, 0);
  });

  it('stops on error', async () => {
    const p = new Pipeline();
    class F extends Stage {
      constructor() { super('f'); }
      async execute(ctx) { ctx.error = new Error('fail'); }
    }
    class R extends Stage {
      constructor() { super('r'); }
      async execute() { throw new Error('nope'); }
    }
    p.use(new F()).use(new R());
    const ctx = { requestId: 'r2' };
    await assert.rejects(() => p.execute(ctx), /fail/);
  });

  it('drain resolves when idle', async () => {
    const p = new Pipeline();
    await p.drain(100);
    assert.strictEqual(p.inflightCount, 0);
  });
});

// AuthStage

describe('AuthStage', () => {
  it('passes valid key', async () => {
    const s = new AuthStage({ keys: { 'sk-abc': { tenant: 'acme' } } });
    const ctx = { apiKey: 'sk-abc' };
    let called = false;
    await s.execute(ctx, async () => { called = true; });
    assert.strictEqual(ctx.tenant, 'acme');
    assert.strictEqual(called, true);
  });

  it('rejects invalid key', async () => {
    const s = new AuthStage({ keys: { 'sk-abc': { tenant: 'acme' } } });
    const ctx = { apiKey: 'sk-bad' };
    await s.execute(ctx, async () => {});
    assert.strictEqual(ctx.error.code, 'AUTH_FAILED');
  });

  it('rejects missing key', async () => {
    const s = new AuthStage({ keys: { 'sk-abc': { tenant: 'acme' } } });
    const ctx = {};
    await s.execute(ctx, async () => {});
    assert.strictEqual(ctx.error.code, 'AUTH_FAILED');
  });
});

// RateLimitStage

describe('RateLimitStage', () => {
  it('passes within limit', async () => {
    const s = new RateLimitStage({
      buckets: { default: { capacity: 10, refillRate: 10 } },
    });
    const ctx = { tenant: 'default' };
    let called = false;
    await s.execute(ctx, async () => { called = true; });
    assert.strictEqual(called, true);
  });

  it('rejects over limit', async () => {
    const s = new RateLimitStage({
      buckets: { default: { capacity: 1, refillRate: 0 } },
    });
    const ctx1 = { tenant: 'default' };
    await s.execute(ctx1, async () => {});
    const ctx2 = { tenant: 'default' };
    await s.execute(ctx2, async () => {});
    assert.strictEqual(ctx2.error.code, 'RATE_LIMITED');
  });
});

describe('TokenBucket', () => {
  it('allows when tokens available', () => {
    const tb = new TokenBucket(5, 5, 1000);
    assert.ok(tb.tryConsume());
  });

  it('blocks when exhausted', () => {
    const tb = new TokenBucket(1, 0, 60000);
    assert.ok(tb.tryConsume());
    assert.strictEqual(tb.tryConsume(), false);
  });
});

// CacheStage

describe('CacheStage', () => {
  it('returns cached response on hit', async () => {
    const store = new MemoryStore();
    const s = new CacheStage(store);
    const ctx = { tenant: 'd', model: 'm1', messages: [{ role: 'user', content: 'hi' }] };
    const key = await s._cacheKey(ctx);
    store.set(key, { content: 'cached', usage: { pt: 1 } });
    let called = false;
    await s.execute(ctx, async () => { called = true; });
    assert.strictEqual(ctx.response.content, 'cached');
    assert.strictEqual(ctx.cached, true);
    assert.strictEqual(called, false);
  });

  it('passes through on miss', async () => {
    const s = new CacheStage(new MemoryStore());
    let called = false;
    await s.execute({ tenant: 'd', model: 'm1', messages: [{ role: 'user', content: 'hi' }] }, async () => { called = true; });
    assert.strictEqual(called, true);
  });
});

// RouterStage

describe('RouterStage', () => {
  it('resolves model and sets provider', async () => {
    const mm = new ModelMap({ models: { 'gpt-4': { provider: 'openai' } } });
    const s = new RouterStage({ modelMap: mm, createAdapter: () => ({}) });
    const ctx = { model: 'gpt-4' };
    let called = false;
    await s.execute(ctx, async () => { called = true; });
    assert.strictEqual(ctx.provider, 'openai');
    assert.strictEqual(called, true);
  });

  it('errors on unknown model', async () => {
    const s = new RouterStage({ modelMap: new ModelMap({}) });
    const ctx = { model: 'x' };
    await s.execute(ctx, async () => {});
    assert.ok(ctx.error);
  });
});

// KeyRotatorStage

describe('KeyRotatorStage', () => {
  it('selects first key', async () => {
    const s = new KeyRotatorStage({ keyPools: { o: ['k1', 'k2'] } });
    const ctx = { provider: 'o' };
    await s.execute(ctx, async () => {});
    assert.strictEqual(ctx.apiKey, 'k1');
  });

  it('rotates on second call', async () => {
    const s = new KeyRotatorStage({ keyPools: { o: ['k1', 'k2'] } });
    const ctx1 = { provider: 'o' };
    // First call (no error) — gets key1
    await s.execute(ctx1, async () => {});
    assert.strictEqual(ctx1.apiKey, 'k1');
    // Second call with 401 error triggers rotation to key2
    const ctx2 = { provider: 'o' };
    let called2 = false;
    await s.execute(ctx2, async () => {
      if (!called2) {
        called2 = true;
        ctx2.error = new Error('unauthorized');
        ctx2.error.statusCode = 401;
      }
    });
    assert.strictEqual(ctx2.apiKey, 'k2');
  });
});

// ProviderStage

describe('ProviderStage', () => {
  it('calls adapter chat', async () => {
    const s = new ProviderStage();
    const ctx = {
      model: 'm1', messages: [{ role: 'user', content: 'hi' }], apiKey: 'k',
      _adapterFactory: () => ({ chat: async () => ({ content: 'hello', usage: { pt: 1 } }) }),
    };
    await s.execute(ctx, async () => {});
    assert.strictEqual(ctx.response.content, 'hello');
  });

  it('calls adapter chatStream', async () => {
    const s = new ProviderStage();
    async function* gen() { yield { content: 'c1' }; yield { content: 'c2' }; }
    const ctx = {
      model: 'm1', messages: [], stream: true, apiKey: 'k',
      _adapterFactory: () => ({ chatStream: () => gen() }),
    };
    await s.execute(ctx, async () => {});
    const chunks = [];
    for await (const c of ctx.responseStream) chunks.push(c);
    assert.strictEqual(chunks.length, 2);
  });
});

// CircuitBreakerState

describe('CircuitBreakerState', () => {
  it('starts closed', () => {
    const cb = new CircuitBreakerState();
    assert.strictEqual(cb.getState('t'), 'closed');
  });

  it('opens after threshold', () => {
    const cb = new CircuitBreakerState({ threshold: 2, cooldownMs: 60000 });
    cb.onFailure('t');
    cb.onFailure('t');
    assert.strictEqual(cb.getState('t'), 'open');
  });

  it('returns all states', () => {
    const cb = new CircuitBreakerState({ threshold: 1, cooldownMs: 60000 });
    cb.onFailure('p1');
    const all = cb.getAllStates();
    assert.strictEqual(all.p1, 'open');
  });
});

describe('CircuitBreakerStage', () => {
  it('passes through when closed', async () => {
    const s = new CircuitBreakerStage(new CircuitBreakerState());
    let called = false;
    await s.execute({ provider: 'o' }, async () => { called = true; });
    assert.strictEqual(called, true);
  });

  it('records failures on error', async () => {
    const cb = new CircuitBreakerState({ threshold: 1, cooldownMs: 60000 });
    const s = new CircuitBreakerStage(cb);
    await s.execute({ provider: 'o', error: new Error('fail') }, async () => {});
    assert.strictEqual(cb.getState('o'), 'open');
  });
});

// CostLoggerStage

describe('CostLoggerStage', () => {
  it('logs cost without error', async () => {
    let logged = null;
    const s = new CostLoggerStage({ pricing: { m: { prompt: 0.001, completion: 0.002 } } });
    s._log = (e) => { logged = e; };
    await s.execute({ model: 'x', provider: 'm', response: { usage: { promptTokens: 5, completionTokens: 3 } } }, async () => {});
    assert.ok(logged);
    assert.strictEqual(logged.provider, 'm');
  });
});

// MemoryStore

describe('MemoryStore', () => {
  it('stores and retrieves', () => {
    const s = new MemoryStore();
    s.set('k', { data: 42 }, 60000);
    assert.deepStrictEqual(s.get('k'), { data: 42 });
  });

  it('returns null for missing', () => {
    assert.strictEqual(new MemoryStore().get('x'), null);
  });

  it('expires entries', async () => {
    const s = new MemoryStore();
    s.set('k', 1, 10);
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(s.get('k'), null);
  });

  it('clears all', () => {
    const s = new MemoryStore();
    s.set('a', 1, 60000);
    s.set('b', 2, 60000);
    s.clear();
    assert.strictEqual(s.get('a'), null);
    assert.strictEqual(s.get('b'), null);
  });
});

// ModelMap

describe('ModelMap', () => {
  it('resolves a model', () => {
    const mm = new ModelMap({ models: { 'gpt-4': { provider: 'openai' } } });
    assert.strictEqual(mm.resolve('gpt-4').provider, 'openai');
  });

  it('throws on unknown model', () => {
    assert.throws(() => new ModelMap({}).resolve('x'), /Unknown model/);
  });

  it('lists available models', () => {
    const mm = new ModelMap({ models: { a: { provider: 'p1' }, b: { provider: 'p2' } } });
    assert.deepStrictEqual(mm.availableModels, ['a', 'b']);
  });
});

// FallbackChain

describe('FallbackChain', () => {
  it('returns fallbacks for a model', () => {
    const fc = new FallbackChain({ fallbacks: { 'gpt-4': ['gpt-3.5'] } });
    assert.deepStrictEqual(fc.getFallbacks('gpt-4'), ['gpt-3.5']);
  });

  it('returns empty for unknown model', () => {
    assert.deepStrictEqual(new FallbackChain({}).getFallbacks('x'), []);
  });
});

// createPipeline

describe('createPipeline', () => {
  it('throws without createAdapter', () => {
    assert.throws(() => createPipeline({}), /createAdapter/);
  });

  it('returns chat, chatStream, health', () => {
    const p = createPipeline({
      createAdapter: () => ({ chat: async () => ({}) }),
      models: { m1: { provider: 'mock' } },
    });
    assert.strictEqual(typeof p.chat, 'function');
    assert.strictEqual(typeof p.chatStream, 'function');
    assert.strictEqual(typeof p.health, 'function');
  });

  it('executes full pipeline', async () => {
    const p = createPipeline({
      createAdapter: () => ({ chat: async () => ({ content: 'Hello!', usage: { pt: 5, ct: 3 } }) }),
      models: { m1: { provider: 'mock' } },
      keys: { 'sk-test': { tenant: 'test' } },
    });
    const res = await p.chat({ model: 'm1', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-test' });
    assert.strictEqual(res.content, 'Hello!');
    assert.ok(res.usage);
  });

  it('reports health', () => {
    const p = createPipeline({
      createAdapter: () => ({ chat: async () => ({}) }),
      models: { m1: { provider: 'mock' } },
    });
    const h = p.health();
    assert.strictEqual(h.status, 'ok');
    assert.ok(h.models.includes('m1'));
  });
});
