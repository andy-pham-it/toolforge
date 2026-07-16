const { describe, it } = require('node:test');
const assert = require('node:assert');
const LLMClient = require('./llm');

describe('LLMClient', async () => {
    describe('constructor', async () => {
        await it('should create a single adapter from provider config', () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'sk-abc', model: 'llama-3.3' });
            assert.equal(c.adapters.length, 1);
            assert.equal(c.adapters[0].provider, 'groq');
            assert.equal(c.adapters[0].baseUrl, 'https://api.groq.com/openai/v1');
            assert.equal(c.adapters[0].maxRetries, 3);
        });

        await it('should accept custom maxRetries in backward-compat mode', () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 5 });
            assert.equal(c.adapters.length, 1);
            assert.equal(c.adapters[0].maxRetries, 5);
        });

        await it('should accept explicit adapter list', () => {
            const OpenAIAdapter = require('./openai-adapter');
            const a1 = new OpenAIAdapter({ provider: 'gemini', apiKey: 'gk', model: 'gemini-pro' });
            const a2 = new OpenAIAdapter({ provider: 'groq', apiKey: 'gk', model: 'llama' });
            const c = new LLMClient({ adapters: [a1, a2] });
            assert.equal(c.adapters.length, 2);
            assert.equal(c.adapters[0].provider, 'gemini');
            assert.equal(c.adapters[1].provider, 'groq');
        });
    });

    describe('chat', async () => {
        // Helper: create a mock fetch that returns given responses sequentially
        function mockFetchSequence(responses) {
            let idx = 0;
            return () => {
                const r = responses[idx++];
                if (r instanceof Error) return Promise.reject(r);
                return Promise.resolve({
                    ok: r.ok,
                    status: r.status ?? 200,
                    text: () => Promise.resolve(r.text ?? ''),
                    json: () => Promise.resolve(r.json ?? { choices: [{ message: { content: r.content ?? '' } }] }),
                });
            };
        }

        await it('should return content on success', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            const result = await c.chat('sys', 'user', false, mockFetchSequence([
                { ok: true, content: 'Hello from LLM' },
            ]));
            assert.equal(result, 'Hello from LLM');
        });

        await it('should throw on 401 (non-retryable)', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'bad', model: 'x', maxRetries: 0 });
            await assert.rejects(
                () => c.chat('sys', 'user', false, mockFetchSequence([
                    { ok: false, status: 401, text: 'Invalid API Key' },
                ])),
                /LLM API Error \(401\)/
            );
        });

        await it('should retry on 429 then succeed', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 2, baseDelay: 10 });
            const result = await c.chat('sys', 'user', false, mockFetchSequence([
                { ok: false, status: 429, text: 'Rate limited' },
                { ok: true, content: 'Retry worked' },
            ]));
            assert.equal(result, 'Retry worked');
        });

        await it('should throw after exhausting retries on 429', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 1, baseDelay: 10 });
            await assert.rejects(
                () => c.chat('sys', 'user', false, mockFetchSequence([
                    { ok: false, status: 429, text: 'Always rate limited' },
                    { ok: false, status: 429, text: 'Always rate limited' },
                ])),
                /LLM API Error \(429\)/
            );
        });

        await it('should retry on network error then succeed', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 2, baseDelay: 10 });
            const result = await c.chat('sys', 'user', false, mockFetchSequence([
                new Error('fetch failed: ENOTFOUND'),
                { ok: true, content: 'Network retry worked' },
            ]));
            assert.equal(result, 'Network retry worked');
        });

        await it('should throw on network error after max retries', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 1, baseDelay: 10 });
            await assert.rejects(
                () => c.chat('sys', 'user', false, mockFetchSequence([
                    new Error('fetch failed: ENOTFOUND'),
                    new Error('fetch failed: ENOTFOUND'),
                ])),
                /fetch failed: ENOTFOUND/
            );
        });

        await it('should fallback to next adapter when first fails', async () => {
            const OpenAIAdapter = require('./openai-adapter');
            const failAdapter = new OpenAIAdapter({ provider: 'groq', apiKey: 'bad', model: 'x', maxRetries: 0 });
            const okAdapter = new OpenAIAdapter({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            const c = new LLMClient({ adapters: [failAdapter, okAdapter] });
            const result = await c.chat('sys', 'user', false, mockFetchSequence([
                { ok: false, status: 401, text: 'Unauthorized' },
                { ok: true, content: 'Fallback worked' },
            ]));
            assert.equal(result, 'Fallback worked');
        });

        await it('should throw when all adapters fail', async () => {
            const OpenAIAdapter = require('./openai-adapter');
            const fail1 = new OpenAIAdapter({ provider: 'groq', apiKey: 'bad1', model: 'x', maxRetries: 0 });
            const fail2 = new OpenAIAdapter({ provider: 'groq', apiKey: 'bad2', model: 'x', maxRetries: 0 });
            const c = new LLMClient({ adapters: [fail1, fail2] });
            await assert.rejects(
                () => c.chat('sys', 'user', false, mockFetchSequence([
                    { ok: false, status: 401, text: 'Unauthorized' },
                    { ok: false, status: 403, text: 'Forbidden' },
                ])),
                /LLM API Error \(403\)/
            );
        });
    });

    describe('chatJSON', async () => {
        function mockFetchSequence(responses) {
            let idx = 0;
            return () => {
                const r = responses[idx++];
                return Promise.resolve({
                    ok: r.ok ?? true,
                    status: r.status ?? 200,
                    text: () => Promise.resolve(r.text ?? ''),
                    json: () => Promise.resolve(r.json ?? { choices: [{ message: { content: r.content ?? '{}' } }] }),
                });
            };
        }

        await it('should parse valid JSON response', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            const result = await c.chatJSON('sys', 'user', mockFetchSequence([
                { ok: true, content: '{"key": "value", "num": 42}' },
            ]));
            assert.deepStrictEqual(result, { key: 'value', num: 42 });
        });

        await it('should strip markdown code fences', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            const result = await c.chatJSON('sys', 'user', mockFetchSequence([
                { ok: true, content: '```json\n{"a": 1}\n```' },
            ]));
            assert.deepStrictEqual(result, { a: 1 });
        });

        await it('should strip ``` fences without language tag', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            const result = await c.chatJSON('sys', 'user', mockFetchSequence([
                { ok: true, content: '```\n{"b": 2}\n```' },
            ]));
            assert.deepStrictEqual(result, { b: 2 });
        });

        await it('should throw on empty response', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            await assert.rejects(
                () => c.chatJSON('sys', 'user', mockFetchSequence([
                    { ok: true, content: '' },
                ])),
                /chatJSON: empty response/
            );
        });

        await it('should throw on invalid JSON', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            await assert.rejects(
                () => c.chatJSON('sys', 'user', mockFetchSequence([
                    { ok: true, content: 'not json at all' },
                ])),
                /chatJSON: failed to parse/
            );
        });

        await it('should work with whitespace-only fences', async () => {
            const c = new LLMClient({ provider: 'groq', apiKey: 'x', model: 'x', maxRetries: 0 });
            const result = await c.chatJSON('sys', 'user', mockFetchSequence([
                { ok: true, content: '```\n{"nested": {"arr": [1,2,3]}}\n```' },
            ]));
            assert.deepStrictEqual(result, { nested: { arr: [1, 2, 3] } });
        });
    });
});
