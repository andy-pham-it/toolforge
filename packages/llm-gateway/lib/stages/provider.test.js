'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const ProviderStage = require('./provider');

describe('ProviderStage', () => {
  it('calls adapter.chat and sets ctx.response', async () => {
    const stage = new ProviderStage();
    const ctx = {
      model: 'test',
      messages: [],
      apiKey: 'sk-test',
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
      model: 'test',
      messages: [],
      apiKey: 'sk-test',
      _adapterFactory: () => ({ chat: async () => { throw new Error('API Error'); } }),
    };
    await stage.execute(ctx, async () => {});
    assert.ok(ctx.error);
    assert.strictEqual(ctx.error._fallbackTried, false);
  });

  it('sets ctx.responseStream when streaming with chatStream', async () => {
    const stage = new ProviderStage();
    const ctx = {
      stream: true,
      model: 'test',
      messages: [],
      apiKey: 'sk-test',
      _adapterFactory: () => ({
        chat: async () => ({ content: 'sync' }),
        chatStream: async function* () {
          yield { content: 'chunk1', finish_reason: null };
          yield { content: 'chunk2', finish_reason: 'stop' };
        },
      }),
    };
    let nextCalled = false;
    await stage.execute(ctx, async () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.ok(ctx.responseStream);
    assert.strictEqual(typeof ctx.responseStream[Symbol.asyncIterator], 'function');
  });

  it('errors when no adapter factory set', async () => {
    const stage = new ProviderStage();
    const ctx = { model: 'test', messages: [], apiKey: 'sk-test' };
    await stage.execute(ctx, async () => {});
    assert.strictEqual(ctx.error.code, 'NO_ADAPTER');
  });
});
