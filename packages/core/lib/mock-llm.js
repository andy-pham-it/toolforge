'use strict';

/**
 * MockLLMClient — test double for LLMClient.
 *
 * Use in domain-package tests that need a fake LLM instead of a real
 * API key / network call. Returns canned responses and records every
 * chat() invocation for assertions.
 *
 * @example
 * const { MockLLMClient } = require('@andy-toolforge/core');
 * const llm = new MockLLMClient({ responses: ['hello'] });
 * const reply = await llm.chat([{ role: 'user', content: 'hi' }]);
 * assert.strictEqual(reply, 'hello');
 * assert.strictEqual(llm.calls.length, 1);
 */
class MockLLMClient {
    constructor({ responses } = {}) {
        this.responses = responses;
        this.calls = [];
    }

    /**
     * Clear the recorded call history (and restart the per-call response index).
     */
    reset() {
        this.calls = [];
    }

    /**
     * Return the next canned response and record the invocation.
     * @param {Array<{role: string, content: string}>} messages
     * @param {{ json?: boolean, responseFormat?: { json?: boolean } }} [opts]
     * @returns {Promise<string|object>}
     */
    async chat(messages, opts = {}) {
        const index = this.calls.length;
        this.calls.push({ messages, opts });

        let response;
        if (typeof this.responses === 'string') {
            response = this.responses;
        } else if (Array.isArray(this.responses)) {
            if (index >= this.responses.length) {
                throw new Error(`MockLLMClient: no response configured for call ${index + 1}`);
            }
            response = this.responses[index];
        } else if (typeof this.responses === 'object' && this.responses !== null) {
            response = this.responses;
        } else {
            throw new Error(`MockLLMClient: no response configured for call ${index + 1}`);
        }

        const wantsJson =
            opts.json === true || (opts.responseFormat && opts.responseFormat.json === true);
        if (wantsJson) {
            if (typeof response === 'object') return response;
            try {
                return JSON.parse(response);
            } catch (err) {
                throw new MockLLMError(
                    `MockLLMClient: invalid JSON response for call ${index + 1}: ${err.message}`
                );
            }
        }
        return response;
    }
}

class MockLLMError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MockLLMError';
    }
}

MockLLMClient.MockLLMError = MockLLMError;

module.exports = MockLLMClient;