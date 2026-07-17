'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const MemoryStore = require('../cache/memory-store');
const CacheStage = require('./cache');

describe('CacheStage', () => {
  it('returns cached response on hit', async () => {
    const store = new MemoryStore();
    const stage = new CacheStage(store);
    const ctx = { tenant: 't1', model: 'm1', messages: [{ role: 'user', content: 'hi' }] };
    const key = stage._cacheKey(ctx);
    store.set(key, { content: 'cached-response' });

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

  it('tenant isolation — different tenants get different cache', async () => {
    const store = new MemoryStore();
    const stage = new CacheStage(store);
    const ctx1 = { tenant: 'a', model: 'm1', messages: [{ role: 'user', content: 'hello' }] };
    const ctx2 = { tenant: 'b', model: 'm1', messages: [{ role: 'user', content: 'hello' }] };

    // Store via ctx1
    ctx1.response = { content: 'from-a' };
    await stage.execute(ctx1, async () => {});

    // ctx2 should miss
    let called2 = false;
    ctx2.response = { content: 'from-b' };
    await stage.execute(ctx2, async () => { called2 = true; });
    assert.ok(called2);
  });
});
