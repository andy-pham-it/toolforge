const { fetch } = globalThis;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class LLMClient {
    constructor(config) {
        this.provider = config.provider;
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.baseUrl = this._getBaseUrl(config.provider);
        this.maxRetries = config.maxRetries ?? 3;
        this.baseDelay = config.baseDelay ?? 2000;
    }

    _getBaseUrl(provider) {
        const urls = {
            groq: 'https://api.groq.com/openai/v1',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            openai: 'https://api.openai.com/v1',
        };
        return urls[provider] || urls.groq;
    }

    /**
     * Determine if a response status is retryable.
     * 429 = rate limit, 5xx = server error, 0+ network error.
     */
    _isRetryable(status) {
        return status === 429 || (status >= 500 && status < 600);
    }

    /**
     * Exponential backoff with full-jitter.
     * Returns sleep duration in ms.
     */
    _backoff(attempt) {
        const cap = 30000; // max 30s
        const exp = Math.min(cap, this.baseDelay * Math.pow(2, attempt));
        // full-jitter: random between 0 and exp
        return Math.random() * exp;
    }

    async chat(systemPrompt, userPrompt, jsonMode = false, fetchFn) {
        let lastError = null;
        const _fetch = fetchFn || globalThis.fetch;

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
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                        response_format: jsonMode ? { type: 'json_object' } : undefined,
                        temperature: 0.7,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0].message.content;
                }

                // Non-ok status
                const errText = await response.text();

                if (this._isRetryable(response.status) && attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(
                        `LLM API (${response.status}) attempt ${attempt + 1}/${this.maxRetries + 1}, ` +
                        `retrying in ${Math.round(delay)}ms...`
                    );
                    await sleep(delay);
                    lastError = new Error(`LLM API Error (${response.status}): ${errText}`);
                    continue;
                }

                throw new Error(`LLM API Error (${response.status}): ${errText}`);

            } catch (err) {
                // Catch network/parse errors too
                if (err.message && err.message.startsWith('LLM API Error')) {
                    throw err; // already a final error or exhausted retries above
                }
                // Network error (fetch failed, JSON parse, etc.)
                if (attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(
                        `LLM network error (attempt ${attempt + 1}/${this.maxRetries + 1}): ${err.message}, ` +
                        `retrying in ${Math.round(delay)}ms...`
                    );
                    await sleep(delay);
                    lastError = err;
                    continue;
                }
                throw err;
            }
        }

        throw lastError || new Error('LLM chat failed after max retries');
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
}

module.exports = LLMClient;
