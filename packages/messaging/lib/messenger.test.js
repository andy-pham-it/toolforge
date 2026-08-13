'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { Messenger } = require('./messenger');
const { TelegramAdapter } = require('./telegram');
const { DiscordAdapter } = require('./discord');
const { ConsoleAdapter } = require('./console');

let originalFetch;

before(() => {
  originalFetch = global.fetch;
});

after(() => {
  if (originalFetch) global.fetch = originalFetch;
  else delete global.fetch;
});

function mockFetch(handler) {
  global.fetch = async (url, options) => handler(url, options);
}

describe('TelegramAdapter', () => {
  it('posts the correct request shape', async () => {
    const seen = {};
    mockFetch(async (url, options) => {
      seen.url = url;
      seen.method = options.method;
      seen.headers = options.headers;
      seen.body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true }) };
    });
    const adapter = new TelegramAdapter({ token: 'TOKEN', defaultChatId: '123' });
    const res = await adapter.send({ text: 'hello' });
    assert.equal(seen.url, 'https://api.telegram.org/botTOKEN/sendMessage');
    assert.equal(seen.method, 'POST');
    assert.equal(seen.headers['Content-Type'], 'application/json');
    assert.deepEqual(seen.body, { chat_id: '123', text: 'hello', parse_mode: 'Markdown' });
    assert.deepEqual(res, { ok: true });
  });

  it('throws when token is missing', () => {
    assert.throws(() => new TelegramAdapter({}), /token is required/);
  });

  it('throws when chatId or text is missing', async () => {
    const adapter = new TelegramAdapter({ token: 'TOKEN' });
    await assert.rejects(adapter.send({ text: 'hi' }), /chatId is required/);
    await assert.rejects(adapter.send({ chatId: '1' }), /text is required/);
  });

  it('throws on HTTP error with status', async () => {
    mockFetch(async () => ({ ok: false, status: 400, text: async () => 'bad request' }));
    const adapter = new TelegramAdapter({ token: 'TOKEN', defaultChatId: '1' });
    await assert.rejects(adapter.send({ text: 'hi' }), /HTTP 400/);
  });
});

describe('DiscordAdapter', () => {
  it('posts the correct request shape', async () => {
    const seen = {};
    mockFetch(async (url, options) => {
      seen.url = url;
      seen.headers = options.headers;
      seen.body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ id: 'm1' }) };
    });
    const adapter = new DiscordAdapter({ token: 'TOKEN', defaultChannelId: '123' });
    const res = await adapter.send({ text: 'hello' });
    assert.equal(seen.url, 'https://discord.com/api/v10/channels/123/messages');
    assert.equal(seen.headers.Authorization, 'Bot TOKEN');
    assert.equal(seen.body.content, 'hello');
    assert.equal(res.id, 'm1');
  });

  it('throws when token, channelId or text is missing', async () => {
    assert.throws(() => new DiscordAdapter({}), /token is required/);
    const adapter = new DiscordAdapter({ token: 'TOKEN' });
    await assert.rejects(adapter.send({ text: 'hi' }), /channelId is required/);
    await assert.rejects(adapter.send({ channelId: '1' }), /text is required/);
  });

  it('throws on HTTP error with status', async () => {
    mockFetch(async () => ({ ok: false, status: 403, text: async () => 'forbidden' }));
    const adapter = new DiscordAdapter({ token: 'TOKEN', defaultChannelId: '1' });
    await assert.rejects(adapter.send({ text: 'hi' }), /HTTP 403/);
  });
});

describe('ConsoleAdapter', () => {
  it('logs the prefixed line', async () => {
    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      const adapter = new ConsoleAdapter({ prefix: '[messaging]' });
      const res = await adapter.send({ text: 'hello' });
      assert.equal(res.ok, true);
      assert.equal(res.line, '[messaging] hello');
      assert.deepEqual(lines, ['[messaging] hello']);
    } finally {
      console.log = orig;
    }
  });

  it('throws when text is missing', async () => {
    const adapter = new ConsoleAdapter();
    await assert.rejects(adapter.send({}), /text is required/);
  });
});

describe('Messenger', () => {
  it('registers, looks up and dispatches to adapters', async () => {
    const calls = [];
    const fakeA = { send: async (p) => { calls.push(['a', p]); return 'okA'; } };
    const m = new Messenger({ a: fakeA });
    assert.equal(m.get('a'), fakeA);
    assert.equal(m.register('b', { send: async () => 'okB' }), m);
    assert.ok(m.get('b'));

    const res = await m.send('a', { text: 'hi' });
    assert.equal(res, 'okA');
    assert.deepEqual(calls, [['a', { text: 'hi' }]]);
  });

  it('throws on unknown adapter', async () => {
    const m = new Messenger({});
    await assert.rejects(m.send('x', { text: 'hi' }), /unknown adapter x/);
  });

  it('sendAll aggregates success and failure entries', async () => {
    const m = new Messenger({
      a: { send: async () => 'okA' },
      b: { send: async () => { throw new Error('boom'); } },
    });
    const all = await m.sendAll({ text: 'hi' });
    assert.deepEqual(all, [
      { name: 'a', ok: true, result: 'okA' },
      { name: 'b', ok: false, error: 'boom' },
    ]);
  });
});
