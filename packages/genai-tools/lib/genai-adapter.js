'use strict';

const { GoogleGenAI } = require('@google/genai');
const { ProviderAdapter } = require('@andy-toolforge/core');

/**
 * GenAIAdapter — wraps @google/genai SDK as a ProviderAdapter.
 *
 * Conforms to the ProviderAdapter interface so it can be used in
 * CoreLLMClient's adapter chain alongside OpenAIAdapter.
 *
 * Usage:
 *   const { LLMClient, OpenAIAdapter } = require('@andy-toolforge/core');
 *   const { GenAIAdapter } = require('@andy-toolforge/genai-tools');
 *
 *   const llm = new LLMClient({
 *     adapters: [
 *       new GenAIAdapter({ apiKey, model: 'gemini-3.1-flash-lite' }),
 *       new OpenAIAdapter({ provider: 'groq', apiKey: groqKey }),
 *     ],
 *   });
 */
class GenAIAdapter extends ProviderAdapter {
    /**
     * @param {object} config
     * @param {string} [config.apiKey] — Gemini API key
     * @param {object} [config.client] — Pre-configured GenAIClient instance (for DI/testing)
     * @param {string} [config.model='gemini-3.1-flash-lite']
     * @param {number} [config.maxRetries=3]
     * @param {number} [config.baseDelay=2000]
     */
    constructor(config = {}) {
        super(config);
        this.model = config.model || 'gemini-3.1-flash-lite';

        if (config.client) {
            this._client = config.client;
        } else {
            const apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
            if (!apiKey) {
                throw new Error('GenAIAdapter: GEMINI_API_KEY or GOOGLE_API_KEY must be set');
            }
            this._client = new GoogleGenAI({ apiKey });
        }
    }

    /**
     * @param {object} options
     * @param {string} [options.systemPrompt]
     * @param {string} [options.userPrompt]
     * @param {Array<{role:string,content:string}>} [options.messages]
     * @param {boolean} [options.jsonMode=false]
     * @returns {Promise<{content:string, model?:string}>}
     */
    async chat(options = {}) {
        const { systemPrompt, userPrompt, messages, jsonMode } = options;

        // Build the prompt: GenAIClient's simple interface takes a single prompt string.
        // If we have explicit messages, join them. Otherwise combine system + user.
        let prompt;
        if (messages) {
            prompt = messages.map(m => {
                const prefix = m.role === 'system' ? 'System: ' : m.role === 'user' ? 'User: ' : 'Assistant: ';
                return `${prefix}${m.content}`;
            }).join('\n\n');
        } else {
            prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        }

        const config = {};
        if (jsonMode) {
            config.responseMimeType = 'application/json';
        }

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this._client.models.generateContent({
                    model: this.model,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config,
                });

                const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                return { content: text, model: this.model };
            } catch (err) {
                if (this._isRetryableError(err) && attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(
                        `[GenAIAdapter] (attempt ${attempt + 1}/${this.maxRetries + 1}): ` +
                        `${err.message}, retrying in ${Math.round(delay)}ms...`
                    );
                    await this._sleep(delay);
                    continue;
                }
                throw err;
            }
        }

        throw new Error('GenAIAdapter chat failed after max retries');
    }

    _isRetryableError(err) {
        const msg = (err.message || '').toLowerCase();
        const code = err.status || err.statusCode || 0;
        return (
            code === 429 || code === 500 || code === 502 || code === 503 ||
            msg.includes('rate limit') ||
            msg.includes('rate_limit') ||
            msg.includes('quota') ||
            msg.includes('429') ||
            msg.includes('503') ||
            msg.includes('resource exhausted') ||
            msg.includes('too many requests')
        );
    }

    get name() {
        return `GenAIAdapter/${this.model}`;
    }
}

module.exports = { GenAIAdapter };
