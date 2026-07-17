'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { createGateway } = require('./gateway');

function mockAdapter() {
  let callCount = 0;
  return {
    chat: async () => {
      callCount++;
      return { content: 'hello', usage: { promptTokens: 5, completionTokens: 10, costUsd: 0.0001 } };
    },
    callCount: () => callCount,
  };
}

describe('Full pipeline (e2e)', () => {
  it('sync request flows through all stages', async () => {
    const adapter = mockAdapter();
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'test-tenant' } },
      rateLimits: { 'test-tenant': { capacity: 100, refillRate: 10 } },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => adapter,
    });
    const result = await gw.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.ok(result);
    assert.strictEqual(result.content, 'hello');
    assert.ok(result.usage);
    assert.strictEqual(adapter.callCount(), 1);
  });

  it('cache stores and returns on second identical call', async () => {
    let callCount = 0;
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'cache-test' } },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({
        chat: async () => {
          callCount++;
          return { content: 'cached', usage: { promptTokens: 2, completionTokens: 3, costUsd: 0.0001 } };
        },
      }),
    });
    await gw.chat({ model: 'test', messages: [{ role: 'user', content: 'same' }] });
    await gw.chat({ model: 'test', messages: [{ role: 'user', content: 'same' }] });
    assert.strictEqual(callCount, 1);
  });

  it('auth rejects invalid key', async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-valid': { tenant: 'test' } },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({ chat: async () => ({ content: '' }) }),
    });
    await assert.rejects(
      () => gw.chat({ model: 'test', messages: [{ role: 'user', content: 'hi' }] }),
      { code: 'AUTH_FAILED' },
    );
  });

  it('rate limiter blocks after capacity exhausted', { timeout: 20000 }, async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'rate-test' } },
      rateLimits: { 'rate-test': { capacity: 2, refillRate: 0.1 } },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({ chat: async () => ({ content: '', usage: { promptTokens: 1, completionTokens: 1, costUsd: 0.0001 } }) }),
    });
    await gw.chat({ model: 'test', messages: [{ role: 'user', content: 'a' }] });
    await gw.chat({ model: 'test', messages: [{ role: 'user', content: 'b' }] });
    await assert.rejects(
      () => gw.chat({ model: 'test', messages: [{ role: 'user', content: 'c' }] }),
      { code: 'RATE_LIMITED' },
    );
  });

  it('circuit breaker opens after repeated failures', { timeout: 10000 }, async () => {
    let fail = true;
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'cb-test' } },
      circuitBreaker: { threshold: 3, cooldownMs: 5000, halfOpenMaxRequests: 1 },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => ({
        chat: async () => {
          if (fail) throw Object.assign(new Error('Provider error'), { code: 'PROVIDER_ERROR' });
          return { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, costUsd: 0.0001 } };
        },
      }),
    });
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => gw.chat({ model: 'test', messages: [{ role: 'user', content: 'x' }] }));
    }
    await assert.rejects(
      () => gw.chat({ model: 'test', messages: [{ role: 'user', content: 'y' }] }),
      { code: 'ALL_CIRCUITS_OPEN' },
    );
  });

  it('health returns pipeline status', async () => {
    const adapter = mockAdapter();
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'health-test' } },
      models: { test: { provider: 'gemini', adapter: 'GenAIAdapter' } },
      createAdapter: () => adapter,
    });
    const health = gw.health;
    assert.ok(health.status, 'ok');
    assert.ok(Array.isArray(health.stages));
    assert.ok(Array.isArray(health.models));
  });
});
