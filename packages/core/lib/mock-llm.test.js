'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const MockLLMClient = require('./mock-llm');

test('MockLLMClient: returns string response for every call', async () => {
    const llm = new MockLLMClient({ responses: 'fixed reply' });
    assert.strictEqual(await llm.chat([{ role: 'user', content: 'a' }]), 'fixed reply');
    assert.strictEqual(await llm.chat([{ role: 'user', content: 'b' }]), 'fixed reply');
});

test('MockLLMClient: array responses are returned per call in order', async () => {
    const llm = new MockLLMClient({ responses: ['first', 'second'] });
    assert.strictEqual(await llm.chat([]), 'first');
    assert.strictEqual(await llm.chat([]), 'second');
});

test('MockLLMClient: records calls with messages and opts', async () => {
    const llm = new MockLLMClient({ responses: 'ok' });
    const messages = [{ role: 'user', content: 'hi' }];
    await llm.chat(messages, { json: false });
    assert.strictEqual(llm.calls.length, 1);
    assert.deepStrictEqual(llm.calls[0].messages, messages);
    assert.deepStrictEqual(llm.calls[0].opts, { json: false });
});

test('MockLLMClient: JSON mode returns parsed object', async () => {
    const llm = new MockLLMClient({ responses: '{"ok":true}' });
    const result = await llm.chat([], { json: true });
    assert.deepStrictEqual(result, { ok: true });
});

test('MockLLMClient: JSON mode returns object response as-is', async () => {
    const llm = new MockLLMClient({ responses: { ok: true } });
    const result = await llm.chat([], { responseFormat: { json: true } });
    assert.deepStrictEqual(result, { ok: true });
});

test('MockLLMClient: throws when array responses exhausted', async () => {
    const llm = new MockLLMClient({ responses: ['only'] });
    await llm.chat([]);
    await assert.rejects(() => llm.chat([]), /no response configured for call 2/);
});

test('MockLLMClient: throws when no responses configured', async () => {
    const llm = new MockLLMClient();
    await assert.rejects(() => llm.chat([]), /no response configured for call 1/);
});

test('MockLLMClient: reset() clears call history and restarts response index', async () => {
    const llm = new MockLLMClient({ responses: ['first', 'second'] });
    assert.strictEqual(await llm.chat([]), 'first');
    assert.strictEqual(llm.calls.length, 1);
    llm.reset();
    assert.strictEqual(llm.calls.length, 0);
    assert.strictEqual(await llm.chat([]), 'first'); // index restarted
});

test('MockLLMClient: invalid JSON response throws MockLLMError', async () => {
    const llm = new MockLLMClient({ responses: '{not json' });
    await assert.rejects(
        () => llm.chat([], { json: true }),
        (err) => err instanceof MockLLMClient.MockLLMError && /invalid JSON response for call 1/.test(err.message)
    );
});