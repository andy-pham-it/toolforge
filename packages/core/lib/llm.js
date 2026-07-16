'use strict';

const OpenAIAdapter = require('./openai-adapter');

/**
 * Core LLM client with provider adapter chain.
 *
 * Supports two construction modes:
 * 1. (Backward-compatible) `new LLMClient({ provider, apiKey, model })`
 *    — creates a single OpenAIAdapter for that provider.
 * 2. (Adapter mode) `new LLMClient({ adapters: [adapter1, adapter2, ...] })`
 *    — uses the provided priority-ordered adapter list.
 *    On failure, tries the next adapter in the chain.
 *
 * Domain subclasses (footage-generation, content-research) extend this class
 * and call `this.chat()` / `this.chatJSON()` as before — nothing changes
 * from their perspective. The adapter chain is transparent.
 */
class LLMClient {
    /**
     * @param {object} config
     * @param {Array<import('./provider-adapter')>} [config.adapters] - Priority-ordered adapter list
     * @param {string} [config.provider] - Backward-compat: provider name
     * @param {string} [config.apiKey] - Backward-compat: API key
     * @param {string} [config.model] - Backward-compat: model name
     * @param {number} [config.maxRetries] - Backward-compat: per-adapter retries
     * @param {number} [config.baseDelay] - Backward-compat: per-adapter backoff
     */
    constructor(config = {}) {
        if (config.adapters) {
            // Adapter mode: caller provides the full chain
            this._adapters = config.adapters;
        } else {
            // Backward-compat mode: create single OpenAIAdapter
            this._adapters = [
                new OpenAIAdapter({
                    provider: config.provider || 'groq',
                    apiKey: config.apiKey,
                    model: config.model,
                    maxRetries: config.maxRetries,
                    baseDelay: config.baseDelay,
                }),
            ];
        }

        if (this._adapters.length === 0) {
            throw new Error('LLMClient requires at least one provider adapter');
        }
    }

    /**
     * Send a chat completion request, trying adapters in priority order.
     *
     * @param {string} systemPrompt
     * @param {string} userPrompt
     * @param {boolean} [jsonMode=false]
     * @param {function} [fetchFn] - Optional mock fetch for testing
     * @returns {Promise<string>} response content
     */
    async chat(systemPrompt, userPrompt, jsonMode = false, fetchFn) {
        let lastError;

        for (let i = 0; i < this._adapters.length; i++) {
            const adapter = this._adapters[i];
            try {
                const result = await adapter.chat({
                    systemPrompt,
                    userPrompt,
                    jsonMode,
                    fetchFn,
                });
                return result.content;
            } catch (err) {
                lastError = err;
                if (i < this._adapters.length - 1) {
                    console.warn(
                        `[LLMClient] ${adapter.name} failed: ${err.message}. ` +
                        `Falling back to next adapter (${i + 2}/${this._adapters.length})...`
                    );
                }
            }
        }

        throw lastError || new Error('LLMClient.chat() failed: all adapters exhausted');
    }

    /**
     * Call chat() with jsonMode=true, strip markdown code fences if present,
     * and parse the result as JSON.
     *
     * @param {string} systemPrompt
     * @param {string} userPrompt
     * @param {function} [fetchFn] - optional mock fetch for testing
     * @returns {Promise<object>} parsed JSON object
     * @throws {Error} if JSON parsing fails (includes raw response in message)
     */
    async chatJSON(systemPrompt, userPrompt, fetchFn) {
        const raw = await this.chat(systemPrompt, userPrompt, true, fetchFn);
        const cleaned = raw.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
        if (!cleaned) {
            throw new Error('chatJSON: empty response from LLM');
        }
        try {
            return JSON.parse(cleaned);
        } catch (err) {
            throw new Error(`chatJSON: failed to parse LLM response as JSON: ${err.message}\nRaw: ${raw.slice(0, 500)}`);
        }
    }

    /**
     * Access the adapter chain (for inspection / testing).
     * @returns {Array<import('./provider-adapter')>}
     */
    get adapters() {
        return this._adapters;
    }
}

module.exports = LLMClient;
