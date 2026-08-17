'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const core = require('./index');

test('core exports the full public API surface', () => {
    const exports = Object.keys(core).sort();
    assert.deepStrictEqual(exports, [
        'BrowserManager',
        'JobQueue',
        'LLMClient',
        'Logger',
        'MCPErrorTracker',
        'MockLLMClient',
        'OpenAIAdapter',
        'ProviderAdapter',
        'installSkills',
    ]);
});

test('MCPErrorTracker is a constructor', () => {
    assert.strictEqual(typeof core.MCPErrorTracker, 'function');
    const tracker = new core.MCPErrorTracker();
    assert.strictEqual(typeof tracker.wrap, 'function');
    assert.strictEqual(typeof tracker.getStats, 'function');
});

test('MockLLMClient is a constructor', () => {
    assert.strictEqual(typeof core.MockLLMClient, 'function');
    const llm = new core.MockLLMClient({ responses: ['ok'] });
    assert.strictEqual(typeof llm.chat, 'function');
});