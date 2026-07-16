'use strict';

const ProviderAdapter = require('./provider-adapter');

/**
 * OpenAI-compatible provider adapter.
 *
 * Supports any provider that exposes an OpenAI-compatible /chat/completions API:
 * - Groq (api.groq.com)
 * - Gemini via OpenAI-compatible endpoint (generativelanguage.googleapis.com)
 * - OpenAI (api.openai.com)
 *
 * This adapter handles retries with exponential backoff internally before
 * the CoreLLMClient tries the next adapter in the chain.
 */
class OpenAIAdapter extends ProviderAdapter {
    /**
     * @param {object} config
     * @param {string} config.provider - Provider key: 'groq' | 'gemini' | 'openai'
     * @param {string} config.apiKey
     * @param {string} [config.model]
     * @param {number} [config.maxRetries=3]
     * @param {number} [config.baseDelay=2000]
     */
    constructor(config = {}) {
        super(config);
        this.provider = config.provider || 'groq';
        this.baseUrl = this._getBaseUrl(this.provider);
        // If no model set, pick a sensible default per provider
        if (!config.model) {
            const defaults = {
                groq: 'llama-3.3-70b-versatile',
                gemini: 'gemini-3.1-flash-lite',
                openai: 'gpt-4o-mini',
            };
            this.model = defaults[this.provider] || defaults.groq;
        }
    }

    _getBaseUrl(provider) {
        const urls = {
            groq: 'https://api.groq.com/openai/v1',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
            openai: 'https://api.openai.com/v1',
        };
        return urls[provider] || urls.groq;
    }

    /**
     * @param {object} options
     * @param {string} options.systemPrompt
     * @param {string} [options.userPrompt]
     * @param {Array<{role:string,content:string}>} [options.messages]
     * @param {boolean} [options.jsonMode=false]
     * @param {function} [options.fetchFn]
     * @returns {Promise<{content:string, model?:string}>}
     */
    async chat(options = {}) {
        const { systemPrompt, userPrompt, messages, jsonMode, fetchFn } = options;
        const lastError = null;
        const _fetch = fetchFn || globalThis.fetch;

        // Build messages array: if explicit messages provided use them,
        // otherwise construct from systemPrompt + userPrompt
        const chatMessages = messages || [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await _fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: chatMessages,
                        response_format: jsonMode ? { type: 'json_object' } : undefined,
                        temperature: 0.7,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    return {
                        content: data.choices[0].message.content,
                        model: data.model || this.model,
                    };
                }

                // Non-ok status
                const errText = await response.text();
                const err = new Error(`LLM API Error (${response.status}): ${errText}`);

                if (this._isRetryable(response.status) && attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(
                        `[OpenAIAdapter/${this.provider}] (${response.status}) ` +
                        `attempt ${attempt + 1}/${this.maxRetries + 1}, ` +
                        `retrying in ${Math.round(delay)}ms...`
                    );
                    await this._sleep(delay);
                    continue;
                }

                throw err;

            } catch (err) {
                // Network/parse errors
                if (err.message && err.message.startsWith('LLM API Error')) {
                    throw err;
                }
                if (attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(
                        `[OpenAIAdapter/${this.provider}] network error ` +
                        `(attempt ${attempt + 1}/${this.maxRetries + 1}): ${err.message}, ` +
                        `retrying in ${Math.round(delay)}ms...`
                    );
                    await this._sleep(delay);
                    continue;
                }
                throw err;
            }
        }

        throw new Error(`OpenAIAdapter/${this.provider} chat failed after max retries`);
    }

    get name() {
        return `OpenAIAdapter/${this.provider}`;
    }
}

module.exports = OpenAIAdapter;
