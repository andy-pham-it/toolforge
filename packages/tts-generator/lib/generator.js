'use strict';

const TTS_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions';

class TTSGenerator {
    /**
     * @param {Object} config
     * @param {string} config.apiKey - Gemini API key
     * @param {Object} [config.tts]
     * @param {string} [config.tts.model='gemini-3.1-flash-tts-preview']
     * @param {string} [config.tts.fallback='gemini-2.5-flash-preview-tts']
     * @param {Function} [config._fetch] - For testing: mock fetch
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        this.model = config.tts?.model || 'gemini-3.1-flash-tts-preview';
        this.fallbackModel = config.tts?.fallback || 'gemini-2.5-flash-preview-tts';
        this._fetch = config._fetch || globalThis.fetch;
        this.maxRetries = config.maxRetries ?? 3;
        this.baseDelay = config.baseDelay ?? 1000;
    }

    /**
     * Generate audio for a single segment.
     * @param {Object} segment - SegmentPlan segment object
     * @returns {Promise<{id: number, text: string, audio: Buffer, voice: string, duration: number|null, format: string}>}
     */
    async generate(segment) {
        const body = this._buildRequestBody(segment);
        let lastError;
        let usedFallback = false;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this._fetch(
                    `${TTS_API_BASE}?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    },
                );

                if (response.ok) {
                    const data = await response.json();
                    return this._parseResponse(data, segment);
                }

                const status = response.status;

                // Quota exhausted — fallback to 2.5 Flash
                if (status === 403 && !usedFallback) {
                    console.warn(`TTSGenerator: quota exhausted on ${this.model}, falling back to ${this.fallbackModel}`);
                    body.model = this.fallbackModel;
                    usedFallback = true;
                    attempt = -1; // restart retry with fallback model
                    continue;
                }

                if (status === 429 && attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(`TTSGenerator: rate limited (429), retrying in ${Math.round(delay)}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                const errText = await response.text();
                throw new Error(`Gemini TTS API error (${status}): ${errText.slice(0, 200)}`);
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        throw lastError || new Error('TTSGenerator: max retries exceeded');
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
        const concurrency = options.concurrency ?? 3;
        const results = [];

        // Process in chunks to avoid overwhelming the API
        for (let i = 0; i < segments.length; i += concurrency) {
            const chunk = segments.slice(i, i + concurrency);
            const chunkResults = await Promise.allSettled(
                chunk.map(seg => this.generate(seg).catch(err => ({
                    id: seg.id,
                    text: seg.text,
                    error: err.message,
                }))),
            );

            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({ error: result.reason?.message || 'Unknown error' });
                }
            }
        }

        return results;
    }

    _buildRequestBody(segment) {
        const body = {
            model: this.model,
            input: { text: segment.text },
            config: {
                generation_config: {
                    response_modalities: ['audio'],
                },
            },
        };

        if (segment.voice && segment.voice !== 'auto') {
            body.config.voice_config = { voice_name: segment.voice };
        }

        if (segment.audioTags && segment.audioTags.length > 0) {
            body.config.speech_config = {
                '': segment.audioTags.map(tag => ({ tag })),
            };
        }

        if (segment.pace && segment.pace !== 'normal') {
            if (!body.config.speech_config) {
                body.config.speech_config = { '': [] };
            }
            body.config.speech_config[''].push({ tag: segment.pace === 'slow' ? 'slow' : 'fast' });
        }

        return body;
    }

    _parseResponse(data, segment) {
        if (!data.turns || data.turns.length === 0) {
            throw new Error('Gemini TTS: empty response (no turns)');
        }

        const parts = data.turns[0].parts || [];
        const audioPart = parts.find(p => p.inlineData && p.inlineData.data);

        if (!audioPart) {
            throw new Error('Gemini TTS: no audio data in response');
        }

        const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
        const format = mimeType.split('/').pop() || 'wav';
        const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

        return {
            id: segment.id,
            text: segment.text,
            audio: audioBuffer,
            voice: segment.voice || 'auto',
            duration: segment.estimatedDuration || null,
            format,
        };
    }

    _backoff(attempt) {
        const cap = 30000;
        const exp = Math.min(cap, this.baseDelay * Math.pow(2, attempt));
        return Math.random() * exp;
    }
}

module.exports = TTSGenerator;
