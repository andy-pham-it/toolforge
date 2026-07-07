'use strict';

/**
 * @andy-toolforge/tts-generator — TTSGenerator
 *
 * Generates audio from text segments via the Gemini Interactions API.
 *
 * API reference: https://ai.google.dev/gemini-api/docs/interactions/speech-generation
 *
 * Request format (REST):
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   x-goog-api-key: ${API_KEY}
 *   {
 *     "model": "gemini-3.1-flash-tts-preview",
 *     "input": "Text to speak",
 *     "response_format": { "type": "audio" },
 *     "generation_config": {
 *       "speech_config": [{ "voice": "Kore" }]
 *     }
 *   }
 *
 * Response format:
 *   {
 *     "turns": [{
 *       "parts": [{
 *         "inlineData": { "mimeType": "audio/wav", "data": "base64..." }
 *       }]
 *     }]
 *   }
 */

const TTS_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions';

class TTSGenerator {
    /**
     * @param {Object} config
     * @param {string} config.apiKey - Gemini API key (required)
     * @param {Object} [config.tts]
     * @param {string} [config.tts.model='gemini-3.1-flash-tts-preview']
     * @param {string} [config.tts.fallback='gemini-2.5-flash-preview-tts']
     * @param {number} [config.maxRetries=2] - Retries per model before giving up
     * @param {number} [config.baseDelay=1000] - Exponential backoff base (ms)
     * @param {Function} [config._fetch] - For testing: mock fetch
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

        if (!this.apiKey) {
            throw new Error(
                'TTSGenerator: API key is required. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable, ' +
                'or pass apiKey in constructor config.'
            );
        }

        this.model = config.tts?.model || 'gemini-3.1-flash-tts-preview';
        this.fallbackModel = config.tts?.fallback || 'gemini-2.5-flash-preview-tts';
        this._fetch = config._fetch || globalThis.fetch;
        this.maxRetries = config.maxRetries ?? 2;
        this.baseDelay = config.baseDelay ?? 1000;
    }

    /**
     * Generate audio for a single segment.
     *
     * @param {Object} segment - SegmentPlan segment object
     * @param {number|string} segment.id
     * @param {string} segment.text - Text to synthesize (REQUIRED)
     * @param {string} [segment.voice='auto']
     * @param {string} [segment.pace='normal']
     * @param {string[]} [segment.audioTags]
     * @param {number} [segment.estimatedDuration]
     * @returns {Promise<{id: number|string, text: string, audio: Buffer, voice: string, duration: number|null, format: string}>}
     */
    async generate(segment) {
        if (!segment || !segment.text || typeof segment.text !== 'string' || segment.text.trim().length === 0) {
            throw new Error('TTSGenerator: segment.text is required and must be a non-empty string');
        }

        // Try primary model with retries, then fallback model with retries
        const models = [this.model];
        if (this.fallbackModel && this.fallbackModel !== this.model) {
            models.push(this.fallbackModel);
        }

        let lastError;

        for (const model of models) {
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    const body = this._buildRequestBody(segment, model);
                    const response = await this._fetch(
                        TTS_API_BASE,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-goog-api-key': this.apiKey,
                            },
                            body: JSON.stringify(body),
                        },
                    );

                    if (response.ok) {
                        const data = await response.json();
                        return this._parseResponse(data, segment);
                    }

                    const status = response.status;
                    const errText = await response.text().catch(() => '');

                    // 403: quota exhaustion on this model — try fallback
                    // 429: rate limited — retry with backoff on current model
                    // Other: hard error

                    if (status === 403) {
                        if (model === this.model) {
                            console.warn(
                                `TTSGenerator: quota exhausted on ${model} (403), ` +
                                `falling back to next model`
                            );
                            break; // break inner loop, outer loop picks fallback
                        }
                        // fallback also returned 403 — give up
                        throw new Error(
                            `Gemini TTS API error (403): quota exhausted on both ` +
                            `${this.model} and ${this.fallbackModel}. ${errText.slice(0, 200)}`
                        );
                    }

                    if (status === 429 && attempt < this.maxRetries) {
                        const delay = this._backoff(attempt);
                        console.warn(`TTSGenerator: rate limited (429), retrying in ${Math.round(delay)}ms`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }

                    // Permanent error — throw immediately
                    throw new Error(`Gemini TTS API error (${status}): ${errText.slice(0, 200)}`);
                } catch (err) {
                    lastError = err;
                    if (attempt < this.maxRetries) {
                        const delay = this._backoff(attempt);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }
        }

        throw lastError || new Error('TTSGenerator: max retries exceeded on all models');
    }

    /**
     * Generate audio for multiple segments.
     * Failed segments include an error property instead of throwing.
     *
     * @param {Array} segments - Array of segment objects
     * @param {Object} [options]
     * @param {number} [options.concurrency=3] - Max concurrent API calls
     * @returns {Promise<Array<{id, text, audio?, voice?, error?}>>}
     */
    async generateBatch(segments, options = {}) {
        if (!Array.isArray(segments) || segments.length === 0) {
            return [];
        }

        const concurrency = options.concurrency ?? 3;
        const results = [];

        for (let i = 0; i < segments.length; i += concurrency) {
            const chunk = segments.slice(i, i + concurrency);
            const chunkResults = await Promise.allSettled(
                chunk.map(seg =>
                    this.generate(seg).catch(err => ({
                        id: seg.id,
                        text: seg.text,
                        error: err.message,
                    }))
                ),
            );

            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    // Safety net: this should rarely fire since .catch handles failures
                    results.push({
                        id: result.reason?.segment?.id ?? null,
                        error: result.reason?.message || 'Unknown error',
                    });
                }
            }
        }

        return results;
    }

    /**
     * Build the API request body for a single segment.
     *
     * @param {Object} segment
     * @param {string} model - Model name for this request
     * @returns {Object}
     */
    _buildRequestBody(segment, model) {
        // Start with clean text as input
        let inputText = segment.text;

        // Embed audio tags as inline markers: [tag1] [tag2] text...
        if (segment.audioTags && segment.audioTags.length > 0) {
            const tagMarkers = segment.audioTags.map(t => `[${t}]`).join(' ');
            inputText = tagMarkers + ' ' + inputText;
        }

        // Pace control via natural language prefix
        if (segment.pace && segment.pace !== 'normal') {
            const prefix = segment.pace === 'slow'
                ? 'Speak slowly and deliberately: '
                : 'Speak quickly and energetically: ';
            inputText = prefix + inputText;
        }

        const body = {
            model,
            input: inputText,
            response_format: {
                type: 'audio',
            },
        };

        // Voice selection via speech_config array
        if (segment.voice && segment.voice !== 'auto') {
            body.generation_config = {
                speech_config: [
                    { voice: segment.voice },
                ],
            };
        }

        return body;
    }

    /**
     * Parse the API response and extract audio data.
     *
     * The Interactions API returns a JSON object containing turns, each turn
     * has parts with inlineData containing the base64-encoded audio.
     *
     * @param {Object} data - Parsed JSON response
     * @param {Object} segment - Original segment for metadata
     * @returns {{id, text, audio: Buffer, voice, duration, format}}
     */
    _parseResponse(data, segment) {
        // Try to find audio at expected path: data.turns[0].parts[0].inlineData
        try {
            const turns = data.turns || [];
            if (turns.length === 0) {
                throw new Error('No turns in response');
            }

            const parts = turns[0].parts || [];
            const audioPart = parts.find(p => p.inlineData && p.inlineData.data);

            if (!audioPart) {
                throw new Error('No inlineData audio found in response parts');
            }

            const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
            const format = mimeType.split('/').pop() || 'wav';
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

            if (audioBuffer.length === 0) {
                throw new Error('Decoded audio buffer is empty');
            }

            return {
                id: segment.id,
                text: segment.text,
                audio: audioBuffer,
                voice: segment.voice || 'auto',
                duration: segment.estimatedDuration || null,
                format,
            };
        } catch (err) {
            // Wrap with context for debugging
            if (err.message.startsWith('No') || err.message.startsWith('Decoded')) {
                throw err;
            }
            throw new Error(`TTSGenerator: failed to parse response — ${err.message}`);
        }
    }

    /**
     * Exponential backoff with jitter.
     * @param {number} attempt - 0-based attempt counter
     * @returns {number} Delay in milliseconds
     */
    _backoff(attempt) {
        const cap = 30000;
        const exp = Math.min(cap, this.baseDelay * Math.pow(2, attempt));
        return Math.random() * exp;
    }
}

module.exports = TTSGenerator;
