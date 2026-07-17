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
      keys: { 'sk-test': { tenant: 'test' } },
      models: { 'test-model': { provider: 'mock', adapter: 'MockAdapter' } },
      createAdapter: () => ({
        chat: async () => ({ content: 'mock-response', usage: { promptTokens: 10, completionTokens: 20, costUsd: 0.001 } }),
      }),
    });
    const result = await gw.chat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.ok(result);
    assert.strictEqual(result.content, 'mock-response');
  });

  it('drain resolves', async () => {
    const gw = createGateway({ apiKey: 'sk-test' });
    await gw.drain(100);
    assert.ok(true);
  });

  it('modelMap is accessible', () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      models: {
        'gemini-flash': { provider: 'gemini', adapter: 'GenAIAdapter' },
      },
    });
    assert.ok(gw.modelMap.availableModels.includes('gemini-flash'));
  });

  it('supports custom stage order', async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      stages: ['router', 'provider'], // minimal pipeline
      models: { 'test': { provider: 'mock', adapter: 'MockAdapter' } },
      createAdapter: () => ({
        chat: async () => ({ content: 'minimal', usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } }),
      }),
    });
    const result = await gw.chat({
      model: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.strictEqual(result.content, 'minimal');
  });
});
