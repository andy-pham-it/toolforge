'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const RouterStage = require('./router');
const ModelMap = require('../router/model-map');
const FallbackChain = require('../router/fallback-chain');

describe('RouterStage', () => {
  it('resolves known model to provider and adapter factory', async () => {
    const mm = new ModelMap();
    mm.add('gemini-flash', { provider: 'gemini', adapter: 'GenAIAdapter', timeoutMs: 15000 });
    const stage = new RouterStage({ modelMap: mm, createAdapter: (p, k) => ({ provider: p, key: k }) });
    const ctx = { model: 'gemini-flash', apiKey: 'sk-test' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.strictEqual(ctx.provider, 'gemini');
    assert.strictEqual(ctx._route.provider, 'gemini');
    assert.ok(ctx._adapterFactory);
    const adapter = ctx._adapterFactory('sk-test');
    assert.deepStrictEqual(adapter, { provider: 'gemini', key: 'sk-test' });
  });

  it('sets error for unknown model', async () => {
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
        ctx.error._fallbackTried = false;
      }
    });
    assert.strictEqual(callCount, 2);
    assert.strictEqual(ctx.provider, 'gemini');
    assert.strictEqual(ctx._fallbackIndex, 1);
  });
});
