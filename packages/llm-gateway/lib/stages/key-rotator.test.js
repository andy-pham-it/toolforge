'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const KeyRotatorStage = require('./key-rotator');

describe('KeyRotatorStage', () => {
  it('uses primary key from pool', async () => {
    const stage = new KeyRotatorStage({ keyPools: { gemini: ['key1', 'key2'] } });
    const ctx = { provider: 'gemini', apiKey: '' };
    await stage.execute(ctx, async () => {});
    assert.strictEqual(ctx.apiKey, 'key1');
  });

  it('falls to second key on 401', async () => {
    const stage = new KeyRotatorStage({ keyPools: { gemini: ['key1', 'key2'] } });
    const ctx = { provider: 'gemini', apiKey: '' };
    let callCount = 0;
    await stage.execute(ctx, async () => {
      callCount++;
      if (callCount === 1) {
        ctx.error = { statusCode: 401 };
      }
    });
    assert.strictEqual(callCount, 2);
    assert.strictEqual(ctx.apiKey, 'key2');
  });

  it('passes through with single key', async () => {
    const stage = new KeyRotatorStage({ keyPools: { gemini: ['key1'] } });
    const ctx = { provider: 'gemini', apiKey: '' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.strictEqual(ctx.apiKey, 'key1');
  });
});
