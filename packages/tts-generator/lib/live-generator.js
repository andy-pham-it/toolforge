'use strict';

/**
 * @andy-toolforge/tts-generator — LiveTTSGenerator
 *
 * Generates audio from text via the Gemini Live API using @google/genai SDK.
 *
 * Unlike the REST-based TTSGenerator (generateContent), this class uses the
 * Live (WebSocket) API via the official SDK for bidirectional streaming with
 * native audio models (gemini-live-2.5-flash-native-audio etc.).
 *
 * Models:
 *   gemini-2.5-flash-native-audio-latest — Live 2.5 Flash with native audio dialog (recommended)
 *   gemini-3.1-flash-live-preview        — Live 3.1 Flash preview
 *   gemini-3.5-live-translate-preview    — Live 3.5 Translate preview
 *
 * API reference: https://ai.google.dev/gemini-api/docs/live-api
 *
 * Protocol (handled internally by @google/genai SDK):
 *   1. connect() → SDK sends BidiGenerateContentSetup (model, config)
 *   2. onmessage: setupComplete → sendClientContent() with text
 *   3. onmessage: serverContent with audio parts (base64) → collect
 *   4. onmessage: turnComplete → close() session → resolve with audio
 *
 * Audio format: The Live API returns raw PCM 16-bit signed, 24kHz, mono,
 *   little-endian (mime type "audio/pcm;rate=24000"). This class converts
 *   it to WAV with a proper RIFF header so consumers can play it directly.
 */

const { GoogleGenAI } = require('@google/genai');

// ---------------------------------------------------------------------------
// Live API models
// ---------------------------------------------------------------------------

const LIVE_MODELS = {
    /** Live 2.5 Flash with native audio I/O (latest alias) */
    NATIVE_AUDIO: 'gemini-2.5-flash-native-audio-latest',
    /** Live 3.1 Flash preview */
    FLASH_LIVE: 'gemini-3.1-flash-live-preview',
    /** Live 3.5 Translate preview */
    LIVE_TRANSLATE: 'gemini-3.5-live-translate-preview',
};

const LIVE_MODEL_NAMES = Object.values(LIVE_MODELS);

// ---------------------------------------------------------------------------
// PCM → WAV conversion
//
// The Gemini Live API returns raw PCM audio (16-bit signed, 24kHz, mono,
// little-endian). We add a standard 44-byte RIFF/WAV header so the buffer
// is playable in any audio player.
// ---------------------------------------------------------------------------

/**
 * Detect whether a mime type string indicates raw PCM audio.
 *
 * Live API returns "audio/pcm;rate=24000". Other possible values:
 * "audio/L16", "audio/L8", "audio/raw".
 *
 * @param {string} mimeType
 * @returns {boolean}
 */
function _isPcm(mimeType) {
    if (!mimeType) return false;
    const base = mimeType.split(';')[0].trim().toLowerCase();
    return base === 'audio/pcm' || base === 'audio/l16' || base === 'audio/l8' || base === 'audio/raw';
}

/**
 * Parse sample rate from a mime type string like "audio/pcm;rate=24000".
 * Returns 24000 (the Live API default) if not specified.
 *
 * @param {string} mimeType
 * @returns {number}
 */
function _parseSampleRate(mimeType) {
    if (!mimeType) return 24000;
    const match = mimeType.match(/rate=(\d+)/i);
    return match ? parseInt(match[1], 10) : 24000;
}

/**
 * Wrap raw PCM data in a standard 44-byte RIFF/WAV header.
 *
 * WAV structure:
 *   - RIFF chunk: "RIFF" + fileSize + "WAVE"
 *   - fmt  chunk: "fmt " + 16 + PCM(1) + channels(1) + sampleRate + byteRate
 *                 + blockAlign + bitsPerSample(16)
 *   - data chunk: "data" + dataSize + raw PCM samples
 *
 * @param {Buffer} pcmData   - Raw PCM samples (16-bit signed, little-endian)
 * @param {number} [sampleRate=24000]
 * @param {number} [numChannels=1]
 * @param {number} [bitsPerSample=16]
 * @returns {Buffer} Complete WAV file
 */
function _pcmToWav(pcmData, sampleRate, numChannels, bitsPerSample) {
    sampleRate = sampleRate || 24000;
    numChannels = numChannels || 1;
    bitsPerSample = bitsPerSample || 16;

    if (!pcmData || pcmData.length === 0) {
        return Buffer.alloc(44); // Empty WAV header only
    }

    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const headerSize = 44;

    const h = Buffer.alloc(headerSize);

    // RIFF chunk descriptor
    h.write('RIFF', 0, 'ascii');                 // ChunkID
    h.writeUInt32LE(headerSize + dataSize - 8, 4); // ChunkSize
    h.write('WAVE', 8, 'ascii');                  // Format

    // fmt sub-chunk (PCM)
    h.write('fmt ', 12, 'ascii');                 // Subchunk1ID
    h.writeUInt32LE(16, 16);                      // Subchunk1Size (PCM)
    h.writeUInt16LE(1, 20);                       // AudioFormat (1 = PCM)
    h.writeUInt16LE(numChannels, 22);              // NumChannels
    h.writeUInt32LE(sampleRate, 24);               // SampleRate
    h.writeUInt32LE(byteRate, 28);                 // ByteRate
    h.writeUInt16LE(blockAlign, 32);               // BlockAlign
    h.writeUInt16LE(bitsPerSample, 34);            // BitsPerSample

    // data sub-chunk
    h.write('data', 36, 'ascii');                  // Subchunk2ID
    h.writeUInt32LE(dataSize, 40);                 // Subchunk2Size

    return Buffer.concat([h, pcmData]);
}

/**
 * Convert audio buffer to WAV if it's raw PCM.
 * Leaves already-containerized formats unchanged.
 *
 * @param {Buffer} audioBuffer
 * @param {string} mimeType - Source mime type (e.g. "audio/pcm;rate=24000")
 * @returns {{ audio: Buffer, format: string }}
 */
function _ensureWav(audioBuffer, mimeType) {
    if (_isPcm(mimeType)) {
        const sampleRate = _parseSampleRate(mimeType);
        return {
            audio: _pcmToWav(audioBuffer, sampleRate),
            format: 'wav',
        };
    }
    // Already in a container format — extract from mime
    const format = mimeType
        ? mimeType.split('/').pop().split(';')[0]
        : 'wav';
    return { audio: audioBuffer, format };
}

// ---------------------------------------------------------------------------
// LiveTTSGenerator
// ---------------------------------------------------------------------------

class LiveTTSGenerator {
    /**
     * @param {Object} config
     * @param {string} [config.apiKey] - Gemini API key (default: env vars)
     * @param {Object} [config.live]
     * @param {string[]} [config.live.models] - Ordered model chain for fallback.
     *   Default: [gemini-live-2.5-flash-native-audio, gemini-3.1-flash-live-preview,
     *            gemini-3.5-live-translate-preview].
     * @param {number} [config.live.modelTimeout=120000] - Max ms per-model
     *   (SDK connection negotiation + audio generation).
     * @param {number} [config.maxRetries=2] - Retries per model on transient errors
     * @param {number} [config.baseDelay=1000] - Exponential backoff base (ms)
     * @param {Function} [config.live._GoogleGenAI] - For testing: mock GoogleGenAI constructor.
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey
            || process.env.GEMINI_API_KEY
            || process.env.GOOGLE_API_KEY;

        if (!this.apiKey) {
            throw new Error(
                'LiveTTSGenerator: API key is required. Set GEMINI_API_KEY or ' +
                'GOOGLE_API_KEY environment variable, or pass apiKey in constructor config.'
            );
        }

        const liveConfig = config.live || {};
        this.models = liveConfig.models || [
            LIVE_MODELS.NATIVE_AUDIO,
            LIVE_MODELS.FLASH_LIVE,
            LIVE_MODELS.LIVE_TRANSLATE,
        ];
        this.modelTimeout = liveConfig.modelTimeout ?? 120000;
        this.maxRetries = config.maxRetries ?? 2;
        this.baseDelay = config.baseDelay ?? 1000;
        this._GoogleGenAI = liveConfig._GoogleGenAI;
    }

    /**
     * Generate audio for a single segment via Live API (SDK).
     *
     * Tries each model in the chain. If all fail, throws the last error.
     *
     * @param {Object} segment - Segment from TTSPlanner
     * @param {number|string} segment.id
     * @param {string} segment.text - Text to synthesize
     * @param {string} [segment.voice='auto'] - Voice name or 'auto' for default
     * @returns {Promise<{id, text, audio: Buffer, voice, format: string}>}
     */
    async generate(segment) {
        if (!segment || !segment.text || typeof segment.text !== 'string' || segment.text.trim().length === 0) {
            throw new Error('LiveTTSGenerator: segment.text is required and must be a non-empty string');
        }

        const voice = segment.voice && segment.voice !== 'auto' ? segment.voice : null;
        let lastError;

        for (const model of this.models) {
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    return await this._generateWithModel(segment, model, voice);
                } catch (err) {
                    lastError = err;
                    if (attempt < this.maxRetries) {
                        const delay = this._backoff(attempt);
                        console.warn(
                            `LiveTTSGenerator: ${model} attempt ${attempt + 1}/${this.maxRetries + 1} failed — ` +
                            `${err.message}, retrying in ${Math.round(delay)}ms`
                        );
                        await new Promise(r => setTimeout(r, delay));
                    } else {
                        console.warn(
                            `LiveTTSGenerator: ${model} failed after ${this.maxRetries + 1} attempts — ` +
                            `${err.message}, trying next model`
                        );
                    }
                }
            }
        }

        throw lastError || new Error('LiveTTSGenerator: all models failed');
    }

    /**
     * Exponential backoff with full jitter, matching TTSGenerator pattern.
     *
     * @param {number} attempt - Zero-based attempt index
     * @returns {number} Delay in milliseconds
     */
    _backoff(attempt) {
        const cap = 30000; // 30s cap
        const exp = Math.min(cap, this.baseDelay * (2 ** attempt));
        return Math.random() * exp;
    }

    /**
     * Generate audio for multiple segments.
     * Failed segments include an `error` property instead of throwing.
     *
     * @param {Array} segments - Array of segment objects
     * @param {Object} [options]
     * @param {number} [options.concurrency=1] - Max concurrent connections
     * @returns {Promise<Array<{id, text, audio?, voice?, error?}>>}
     */
    async generateBatch(segments, options = {}) {
        if (!Array.isArray(segments) || segments.length === 0) {
            return [];
        }

        const concurrency = options.concurrency ?? 1;
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
                    results.push({
                        id: result.reason?.segment?.id ?? null,
                        error: result.reason?.message || 'Unknown error',
                    });
                }
            }
        }

        return results;
    }

    // -----------------------------------------------------------------------
    // Internal — @google/genai SDK Live API connect & streaming
    // -----------------------------------------------------------------------

    /**
     * Generate audio using a single model via @google/genai SDK.
     *
     * @param {Object} segment
     * @param {string} model - Model name (without 'models/' prefix)
     * @param {string|null} voice - Resolved voice name or null for default
     * @returns {Promise<{id, text, audio: Buffer, voice, format}>}
     */
    _generateWithModel(segment, model, voice) {
        const GenAI = this._GoogleGenAI || GoogleGenAI;
        const ai = new GenAI({ apiKey: this.apiKey });

        return new Promise((resolve, reject) => {
            let settled = false;
            let session = null;

            const settle = (err, result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (session) {
                    try { session.close(); } catch (_) { /* ignore */ }
                }
                if (err) reject(err);
                else resolve(result);
            };

            const timer = setTimeout(() => {
                settle(new Error(
                    `LiveTTSGenerator: SDK timeout (${this.modelTimeout}ms) on ${model}`
                ));
            }, this.modelTimeout);

            const audioChunks = [];
            let audioMimeType = null;

            const config = { responseModalities: ['AUDIO'] };

            // Voice config — only if a specific voice is requested
            if (voice) {
                config.speechConfig = {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice,
                        },
                    },
                };
            }

            // Connect via @google/genai SDK
            ai.live.connect({
                model: `models/${model}`,
                config,
                callbacks: {
                    onmessage: (msg) => {
                        // msg is LiveServerMessage — already parsed JSON

                        // -- setupComplete → now send the text content --
                        if (msg.setupComplete) {
                            if (session) {
                                session.sendClientContent({
                                    turns: [{ role: 'user', parts: [{ text: segment.text }] }],
                                    turnComplete: true,
                                });
                            }
                            return;
                        }

                        // -- serverContent → audio/text response from the model --
                        if (msg.serverContent) {
                            const modelTurn = msg.serverContent.modelTurn;
                            if (modelTurn && modelTurn.parts) {
                                for (const part of modelTurn.parts) {
                                    if (part.inlineData && part.inlineData.data) {
                                        const buf = Buffer.from(part.inlineData.data, 'base64');
                                        if (buf.length > 0) {
                                            audioChunks.push(buf);
                                        }
                                        if (part.inlineData.mimeType) {
                                            audioMimeType = part.inlineData.mimeType;
                                        }
                                    }
                                    if (part.text) {
                                        console.warn(
                                            `LiveTTSGenerator: segment ${segment.id} — ` +
                                            `model returned text instead of audio: "${part.text.slice(0, 80)}"`
                                        );
                                    }
                                }
                            }

                            // Turn complete → close session & resolve
                            if (msg.serverContent.turnComplete) {
                                setTimeout(() => { try { session?.close(); } catch (_) { /* */ } }, 500);

                                if (audioChunks.length > 0) {
                                    const raw = Buffer.concat(audioChunks);
                                    const mime = audioMimeType || 'audio/pcm;rate=24000';
                                    const { audio, format } = _ensureWav(raw, mime);
                                    settle(null, {
                                        id: segment.id,
                                        text: segment.text,
                                        audio,
                                        voice: voice || 'auto',
                                        format,
                                    });
                                } else {
                                    settle(new Error(
                                        'LiveTTSGenerator: model returned text-only response (no audio). ' +
                                        'Ensure responseModalities includes AUDIO.'
                                    ));
                                }
                            }
                            return;
                        }

                        // -- toolCall / usageMetadata / goAway — informational, ignore --
                    },
                    onerror: (err) => {
                        const msg = err && (err.message || String(err));
                        settle(new Error(
                            `LiveTTSGenerator: SDK error on ${model} — ${msg}`
                        ));
                    },
                    onclose: (_evt) => {
                        if (settled) return;
                        // Connection closed — resolve with whatever audio we have
                        if (audioChunks.length > 0) {
                            const raw = Buffer.concat(audioChunks);
                            const { audio, format } = _ensureWav(
                                raw, audioMimeType || 'audio/pcm;rate=24000',
                            );
                            settle(null, {
                                id: segment.id,
                                text: segment.text,
                                audio,
                                voice: voice || 'auto',
                                format,
                            });
                        } else {
                            settle(new Error(
                                `LiveTTSGenerator: connection closed without audio on ${model}`
                            ));
                        }
                    },
                },
            }).then(s => {
                session = s;
            }).catch(err => {
                settle(new Error(
                    `LiveTTSGenerator: connect failed on ${model} — ${err.message}`
                ));
            });
        });
    }
}

module.exports = {
    LiveTTSGenerator,
    LIVE_MODELS,
    LIVE_MODEL_NAMES,
    // Internal helpers (exported for unit testing)
    _isPcm,
    _parseSampleRate,
    _pcmToWav,
    _ensureWav,
};
