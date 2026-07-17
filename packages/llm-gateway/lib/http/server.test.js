'use strict';
const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const HTTPServer = require('./server');
const { createGateway } = require('../gateway');

describe('HTTPServer', () => {
  /** @type {HTTPServer[]} */
  const servers = [];

  after(async () => {
    await Promise.all(servers.map(s => s.stop(100).catch(() => {})));
  });

  it('starts and responds to /health', async () => {
    const server = new HTTPServer(createGateway({ apiKey: 'sk-test' }), { port: 0 });
    servers.push(server);
    await server.start();
    const addr = server.address;
    const res = await fetch(`http://localhost:${addr.port}/health`);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  });

  it('POST /v1/chat/completions with model + messages', async () => {
    const server = new HTTPServer(createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'test' } },
      models: { 'test-model': { provider: 'mock', adapter: 'MockAdapter' } },
      createAdapter: () => ({
        chat: async () => ({ content: 'Hello!', usage: { promptTokens: 5, completionTokens: 3, costUsd: 0.001 } }),
      }),
    }), { port: 0 });
    servers.push(server);
    await server.start();
    const addr = server.address;
    const res = await fetch(`http://localhost:${addr.port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: JSON.stringify({ model: 'test-model', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const body = await res.json();
    assert.strictEqual(body.object, 'chat.completion');
    assert.strictEqual(body.choices[0].message.content, 'Hello!');
  });

  it('POST /v1/chat/completions returns 400 for missing model', async () => {
    const server = new HTTPServer(createGateway({ apiKey: 'sk-test' }), { port: 0 });
    servers.push(server);
    await server.start();
    const addr = server.address;
    const res = await fetch(`http://localhost:${addr.port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_REQUEST');
  });

  it('GET /metrics returns Prometheus text', async () => {
    const server = new HTTPServer(createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'test' } },
      models: { 'm1': { provider: 'mock', adapter: 'A' } },
      createAdapter: () => ({ chat: async () => ({ content: 'x', usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 } }) }),
    }), { port: 0 });
    servers.push(server);
    await server.start();
    const addr = server.address;
    await fetch(`http://localhost:${addr.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-test' },
      body: JSON.stringify({ model: 'm1', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const res = await fetch(`http://localhost:${addr.port}/metrics`);
    const text = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(text.includes('llm_requests_total'));
    assert.ok(text.includes('llm_request_duration_seconds'));
  });

  it('GET /admin/config returns config with masked keys', async () => {
    const server = new HTTPServer(createGateway({ apiKey: 'sk-test-secret', adminKey: 'admin' }), { port: 0, adminKey: 'admin' });
    servers.push(server);
    await server.start();
    const addr = server.address;
    const res = await fetch(`http://localhost:${addr.port}/admin/config`, {
      headers: { 'X-Admin-Key': 'admin' },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(body.apiKey.includes('****'));
  });

  it('GET /admin/config rejects without admin key', async () => {
    const server = new HTTPServer(createGateway({ apiKey: 'sk-test' }), { port: 0, adminKey: 'secret' });
    servers.push(server);
    await server.start();
    const addr = server.address;
    const res = await fetch(`http://localhost:${addr.port}/admin/config`);
    assert.strictEqual(res.status, 403);
  });

  it('PUT /admin/config reloads pipeline', async () => {
    const server = new HTTPServer(createGateway({
      apiKey: 'sk-test',
      keys: { 'sk-test': { tenant: 'test' } },
      models: { 'm1': { provider: 'mock', adapter: 'A' } },
      createAdapter: () => ({ chat: async () => ({ content: 'resp' }) }),
    }), { port: 0, adminKey: 'admin' });
    servers.push(server);
    await server.start();
    const addr = server.address;
    let modelsRes = await fetch(`http://localhost:${addr.port}/v1/models`);
    let modelsBody = await modelsRes.json();
    assert.ok(modelsBody.data.find(m => m.id === 'm1'));
    assert.ok(!modelsBody.data.find(m => m.id === 'm2'));
    const reloadRes = await fetch(`http://localhost:${addr.port}/admin/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'admin' },
      body: JSON.stringify({
        models: { m1: { provider: 'mock', adapter: 'A' }, m2: { provider: 'mock', adapter: 'A' } },
      }),
    });
    assert.strictEqual(reloadRes.status, 200);
    modelsRes = await fetch(`http://localhost:${addr.port}/v1/models`);
    modelsBody = await modelsRes.json();
    assert.ok(modelsBody.data.find(m => m.id === 'm2'));
  });

  it('GET /v1/models returns model list', async () => {
    const server = new HTTPServer(createGateway({
      apiKey: 'sk-test',
      models: { 'm1': { provider: 'test', adapter: 'A' } },
    }), { port: 0 });
    servers.push(server);
    await server.start();
    const addr = server.address;
    const res = await fetch(`http://localhost:${addr.port}/v1/models`);
    const body = await res.json();
    assert.strictEqual(body.object, 'list');
    assert.ok(body.data.length > 0);
  });
});
