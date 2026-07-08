'use strict';

const { GoogleGenAI } = require('@google/genai');

const GEN_CONTENT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const INTERACTIONS_BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions';

class TTSGenerator {
    constructor(config = {}) {
        const apiKey = config.apiKey
            || process.env.GEMINI_API_KEY
            || process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            throw new Error(
                'TTSGenerator: API key is required. Set GEMINI_API_KEY or ' +
                'GOOGLE_API_KEY environment variable, or pass apiKey in constructor config.'
            );
        }

        this.model = config.tts?.model || 'gemini-3.1-flash-tts-preview';
        this.fallbackModel = config.tts?.fallback || 'gemini-2.5-flash-preview-tts';
        this.maxRetries = config.maxRetries ?? 2;
        this.baseDelay = config.baseDelay ?? 1000;

        this._generateFn = config._generateFn;
        this._sdk = null;

        if (apiKey && !this._generateFn) {
            this._sdk = new GoogleGenAI({ apiKey });
        }
    }

    _getGenerateFn() {
        if (this._generateFn) return this._generateFn;
        if (!this._sdk) throw new Error('TTSGenerator: no SDK and no _generateFn');
        return this._sdk.models.generateContent.bind(this._sdk.models);
    }

    async generate(segment) {
        if (!segment || !segment.text || typeof segment.text !== 'string' || segment.text.trim().length === 0) {
            throw new Error('TTSGenerator: segment.text is required and must be a non-empty string');
        }

        const models = [this.model];
        if (this.fallbackModel && this.fallbackModel !== this.model) {
            models.push(this.fallbackModel);
        }

        let lastError;
        const voice = segment.voice && segment.voice !== 'auto' ? segment.voice : null;

        for (const model of models) {
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    const { audio, format } = await this._generateViaSDK(segment.text, model, voice);
                    return {
                        id: segment.id,
                        text: segment.text,
                        audio,
                        voice: voice || 'auto',
                        duration: segment.estimatedDuration || null,
                        format,
                    };
                } catch (err) {
                    lastError = err;

                    if (err.message && (
                        err.message.includes('429') ||
                        err.message.includes('rate limit') ||
                        err.message.includes('quota')
                    )) {
                        const delay = this._backoff(attempt);
                        console.warn(`TTSGenerator: rate limited, retrying in ${Math.round(delay)}ms`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }

                    if (attempt < this.maxRetries) {
                        const delay = this._backoff(attempt);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                }
            }
        }

        throw lastError || new Error('TTSGenerator: max retries exceeded on all models');
    }

    async _generateViaSDK(text, model, voice) {
        const generateFn = this._getGenerateFn();

        const config = {
            responseModalities: ['AUDIO'],
        };
        if (voice) {
            config.speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            };
        }

        const response = await generateFn({
            model,
            contents: text,
            config,
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) throw new Error('SDK: no candidates/content/parts in response');

        for (const part of parts) {
            if (part.inlineData?.data) {
                let audioData = part.inlineData.data;
                if (audioData instanceof Uint8Array) {
                    audioData = Buffer.from(audioData);
                } else if (typeof audioData === 'string') {
                    audioData = Buffer.from(audioData, 'base64');
                }

                if (audioData.length > 0) {
                    const mimeType = part.inlineData.mimeType || 'audio/wav';
                    const format = mimeType.split('/').pop()?.split(';')[0] || 'wav';
                    if (format === 'l16' || mimeType.startsWith('audio/pcm') || mimeType.startsWith('audio/l16')) {
                        const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || '24000', 10);
                        const wavHeader = this._makeWavHeader(audioData.length, sampleRate);
                        return { audio: Buffer.concat([wavHeader, audioData]), format: 'wav' };
                    }
                    return { audio: audioData, format };
                }
            }
        }

        throw new Error('SDK: no audio inlineData in response parts');
    }

    _makeWavHeader(dataSize, sampleRate) {
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * 2, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);
        return header;
    }

    /**
     * Generate audio for multiple segments.
     * Runs SEQUENTIALLY (one at a time) with configurable delay between segments.
     * Failed segments include an error property instead of throwing.
     *
     * @param {Array} segments - Array of segment objects
     * @param {Object} [options]
     * @param {number} [options.segmentDelay=5000] - Delay (ms) between segment generations
     * @param {AbortSignal} [options.signal] - AbortSignal to cancel mid-batch
     * @returns {Promise<Array<{id, text, audio?, voice?, error?}>>}
     */
    async generateBatch(segments, options = {}) {
        if (!Array.isArray(segments) || segments.length === 0) {
            return [];
        }

        const segmentDelay = options.segmentDelay ?? 0;
        const signal = options.signal || null;
        const results = [];

        for (let i = 0; i < segments.length; i++) {
            if (signal?.aborted) break;

            const seg = segments[i];
            const result = await this.generate(seg).catch(err => ({
                id: seg.id,
                text: seg.text,
                voice: seg.voice || 'auto',
                error: err.message,
            }));
            results.push(result);

            // Sleep between segments (not after the last one)
            if (segmentDelay > 0 && i < segments.length - 1 && !signal?.aborted) {
                await new Promise(r => setTimeout(r, segmentDelay));
            }
        }

        return results;
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
