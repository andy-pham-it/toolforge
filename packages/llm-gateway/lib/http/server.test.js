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
