'use strict';

/**
 * Abstract base class for LLM provider adapters.
 *
 * Each adapter wraps one LLM provider/SDK and exposes a normalized
 * `chat()` method. The CoreLLMClient iterates adapters in priority
 * order, falling through to the next on failure.
 *
 * @abstract
 */
class ProviderAdapter {
    /**
     * @param {object} config
     * @param {string} [config.apiKey] - API key for the provider
     * @param {string} [config.model] - Default model name
     * @param {number} [config.maxRetries=3] - Max retries per adapter
     * @param {number} [config.baseDelay=2000] - Base backoff delay in ms
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.maxRetries = config.maxRetries ?? 3;
        this.baseDelay = config.baseDelay ?? 2000;
    }

    /**
     * Send a chat completion request.
     *
     * @param {object} options
     * @param {string} options.systemPrompt - System instruction
     * @param {string} [options.userPrompt] - Single user message (mutually exclusive with messages)
     * @param {Array<{role:string,content:string}>} [options.messages] - Full message history (mutually exclusive with userPrompt)
     * @param {boolean} [options.jsonMode=false] - Request JSON response format
     * @param {function} [options.fetchFn] - Optional custom fetch for testing
     * @returns {Promise<{content:string, model?:string, usage?:{promptTokens?:number,completionTokens?:number}}>}
     * @abstract
     */
    async chat(options) {
        throw new Error('ProviderAdapter.chat() must be overridden by subclass');
    }

    /**
     * Determine if a response status is retryable.
     * Override in subclass for provider-specific codes.
     */
    _isRetryable(status) {
        return status === 429 || (status >= 500 && status < 600);
    }

    /**
     * Exponential backoff with full-jitter.
     */
    _backoff(attempt) {
        const cap = 30000;
        const exp = Math.min(cap, this.baseDelay * Math.pow(2, attempt));
        return Math.random() * exp;
    }

    /**
     * Sleep helper.
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * @returns {string} Human-readable adapter name (for logging)
     */
    get name() {
        return this.constructor.name || 'UnknownAdapter';
    }
}

module.exports = ProviderAdapter;
