'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const LLMClient = require('./llm');

describe('LLMClient (Gateway wrapper)', () => {
    it('extends CoreLLMClient', () => {
        const client = new LLMClient({
            apiKey: 'sk-test',
            models: { test: { provider: 'mock', adapter: 'MockAdapter' } },
            createAdapter: () => ({
                chat: async () => ({ content: 'hello', usage: { promptTokens: 5, completionTokens: 3 } }),
            }),
        });
        assert.ok(client instanceof require('@andy-toolforge/core').LLMClient);
    });

    it('chat() routes through gateway and returns content', async () => {
        const client = new LLMClient({
            apiKey: 'sk-test',
            models: { m: { provider: 'mock', adapter: 'MockAdapter' } },
            createAdapter: () => ({
                chat: async () => ({ content: 'Hello world', usage: { promptTokens: 5, completionTokens: 3 } }),
            }),
        });
        const result = await client.chat('You are helpful', 'Say hi');
        assert.strictEqual(result, 'Hello world');
    });

    it('chatJSON() parses JSON response', async () => {
        const client = new LLMClient({
            apiKey: 'sk-test',
            models: { m: { provider: 'mock', adapter: 'MockAdapter' } },
            createAdapter: () => ({
                chat: async () => ({ content: '{"key":"value"}', usage: { promptTokens: 5, completionTokens: 3 } }),
            }),
        });
        const result = await client.chatJSON('You are JSON', 'Return JSON');
        assert.deepStrictEqual(result, { key: 'value' });
    });

    it('chatStream() returns async iterable from gateway', async () => {
        const client = new LLMClient({
            apiKey: 'sk-test',
            models: { m: { provider: 'mock', adapter: 'MockAdapter' } },
            createAdapter: () => ({
                chat: async () => ({ content: 'fallback', usage: {} }),
                chatStream: () => ({
                    [Symbol.asyncIterator]() {
                        let i = 0;
                        const chunks = [{ content: 'chunk1' }, { content: 'chunk2' }];
                        return {
                            next() {
                                if (i < chunks.length) return Promise.resolve({ value: chunks[i++], done: false });
                                return Promise.resolve({ done: true });
                            },
                        };
                    },
                }),
            }),
        });
        const stream = await client.chatStream('system', 'user');
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        assert.strictEqual(chunks.length, 2);
        assert.strictEqual(chunks[0].content, 'chunk1');
    });

    it('accepts pre-built gateway instance', async () => {
        const { createGateway } = require('./gateway');
        const gateway = createGateway({
            apiKey: 'sk-test',
            keys: { 'sk-test': { tenant: 'test' } },
            models: { m: { provider: 'mock', adapter: 'MockAdapter' } },
            createAdapter: () => ({
                chat: async () => ({ content: 'from prebuilt gateway', usage: {} }),
            }),
        });
        const client = new LLMClient({ gateway, apiKey: 'sk-test', defaultModel: 'm' });
        const result = await client.chat('system', 'user');
        assert.strictEqual(result, 'from prebuilt gateway');
    });

    it('uses default model from models config', async () => {
        const client = new LLMClient({
            apiKey: 'sk-test',
            models: { 'my-model': { provider: 'mock', adapter: 'MockAdapter' } },
            createAdapter: () => ({
                chat: async () => ({ content: 'default model works', usage: {} }),
            }),
        });
        const result = await client.chat('system', 'user');
        assert.strictEqual(result, 'default model works');
    });
});
