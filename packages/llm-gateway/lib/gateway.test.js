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

  it('getConfig masks API keys', () => {
    const gw = createGateway({ apiKey: 'sk-test-secret-key-12345', keys: { 'sk-admin-key': { tenant: 'admin' } } });
    const cfg = gw.getConfig();
    assert.ok(cfg.apiKey.includes('****'));
    assert.ok(!cfg.apiKey.includes('sk-test-secret-key-12345'));
    assert.ok(Object.keys(cfg.keys)[0].includes('****'));
  });

  it('reloadConfig rebuilds pipeline', async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'old' } },
      models: { 'm1': { provider: 'mock', adapter: 'A' } },
      createAdapter: () => ({ chat: async () => ({ content: 'old' }) }),
    });
    await gw.reloadConfig({
      keys: { 'sk-new': { tenant: 'new' } },
      models: { 'm2': { provider: 'mock', adapter: 'B' } },
      createAdapter: () => ({ chat: async () => ({ content: 'reloaded' }) }),
    });
    const result = await gw.chat({
      model: 'm2',
      messages: [{ role: 'user', content: 'hi' }],
      apiKey: 'sk-new',
    });
    assert.strictEqual(result.content, 'reloaded');
  });

  it('records metrics after chat', async () => {
    const gw = createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'metrics-test' } },
      models: { 'm1': { provider: 'mock', adapter: 'A' } },
      createAdapter: () => ({
        chat: async () => ({ content: 'ok', usage: { promptTokens: 5, completionTokens: 3, costUsd: 0.001 } }),
      }),
    });
    await gw.chat({ model: 'm1', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-test' });
    const out = gw.metrics.formatPrometheus();
    assert.ok(out.includes('llm_requests_total'));
    assert.ok(out.includes('model="m1"'));
    assert.ok(out.includes('status="success"'));
    assert.ok(out.includes('llm_tokens_total'));
    assert.ok(out.includes('llm_cost_usd_total'));
    assert.ok(out.includes('llm_request_duration_seconds'));
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
