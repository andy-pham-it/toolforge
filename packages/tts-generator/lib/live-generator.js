'use strict';

/**
 * @andy-toolforge/tts-generator — LiveTTSGenerator
 *
 * Generates audio from text via the Gemini Live API (WebSocket).
 *
 * Unlike the REST-based TTSGenerator (Interactions API), this class
 * uses a bidirectional WebSocket for real-time streaming with native
 * audio models (gemini-live-2.5-flash-native-audio etc.).
 *
 * Models:
 *   gemini-live-2.5-flash-native-audio   — Live 2.5 Flash with native audio dialog
 *   gemini-3.1-flash-live-preview        — Live 3.1 Flash preview
 *   gemini-3.5-live-translate-preview    — Live 3.5 Translate preview
 *
 * API reference: https://ai.google.dev/gemini-api/docs/live-api
 *
 * WebSocket endpoint (v1beta):
 *   wss://generativelanguage.googleapis.com/ws/.../BidiGenerateContent?key=API_KEY
 *
 * Protocol:
 *   1. Connect → send BidiGenerateContentSetup (model, responseModalities, voice)
 *   2. Wait for setupComplete → send clientContent with text turn
 *   3. Receive serverContent chunks with audio parts (base64)
 *   4. Close on turnComplete or disconnect
 */

const WebSocket = require('ws');

// ---------------------------------------------------------------------------
// Live API models
// ---------------------------------------------------------------------------

const LIVE_MODELS = {
    /** Live 2.5 Flash with native audio I/O */
    NATIVE_AUDIO: 'gemini-live-2.5-flash-native-audio',
    /** Live 3.1 Flash preview */
    FLASH_LIVE: 'gemini-3.1-flash-live-preview',
    /** Live 3.5 Translate preview */
    LIVE_TRANSLATE: 'gemini-3.5-live-translate-preview',
};

const LIVE_MODEL_NAMES = Object.values(LIVE_MODELS);

// ---------------------------------------------------------------------------
// WebSocket endpoint (v1beta)
// ---------------------------------------------------------------------------

const LIVE_API_BASE =
    'wss://generativelanguage.googleapis.com/ws/' +
    'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// ---------------------------------------------------------------------------
// LiveTTSGenerator
// ---------------------------------------------------------------------------

class LiveTTSGenerator {
    /**
     * @param {Object} config
     * @param {string} [config.apiKey] - Gemini API key (default: env GEMINI_API_KEY)
     * @param {Object} [config.live]
     * @param {string[]} [config.live.models] - Ordered model chain for fallback.
     *   Default: [gemini-live-2.5-flash-native-audio, gemini-3.1-flash-live-preview,
     *            gemini-3.5-live-translate-preview].
     * @param {number} [config.live.modelTimeout=120000] - Max ms per-model
     *   (WebSocket negotiation + audio generation).
     * @param {Function} [config.live._WebSocket] - For testing: mock WebSocket constructor.
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

        if (!this.apiKey) {
            throw new Error(
                'LiveTTSGenerator: API key is required. Set GEMINI_API_KEY or GOOGLE_API_KEY ' +
                'environment variable, or pass apiKey in constructor config.'
            );
        }

        const liveConfig = config.live || {};
        this.models = liveConfig.models || [
            LIVE_MODELS.NATIVE_AUDIO,
            LIVE_MODELS.FLASH_LIVE,
            LIVE_MODELS.LIVE_TRANSLATE,
        ];
        this.modelTimeout = liveConfig.modelTimeout ?? 120000;
        this._WebSocket = liveConfig._WebSocket || WebSocket;
    }

    /**
     * Generate audio for a single segment via Live API WebSocket.
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
            try {
                return await this._generateWithModel(segment, model, voice);
            } catch (err) {
                lastError = err;
                console.warn(
                    `LiveTTSGenerator: ${model} failed — ${err.message}, trying next model`
                );
            }
        }

        throw lastError || new Error('LiveTTSGenerator: all models failed');
    }

    /**
     * Generate audio for multiple segments.
     * Failed segments include an `error` property instead of throwing.
     *
     * @param {Array} segments - Array of segment objects
     * @param {Object} [options]
     * @param {number} [options.concurrency=1] - Max concurrent WebSocket connections.
     *   Live API is connection-heavy; keep low.
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
    // Internal — WebSocket handshake & streaming
    // -----------------------------------------------------------------------

    /**
     * Generate audio using a single model via WebSocket.
     *
     * @param {Object} segment
     * @param {string} model - Model name (without 'models/' prefix)
     * @param {string|null} voice - Resolved voice name or null for default
     * @returns {Promise<{id, text, audio: Buffer, voice, format}>}
     */
    _generateWithModel(segment, model, voice) {
        const wsUrl = `${LIVE_API_BASE}?key=${this.apiKey}`;

        return new Promise((resolve, reject) => {
            let settled = false;

            const settle = (err, result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try { ws.close(); } catch (_) { /* ignore */ }
                if (err) reject(err);
                else resolve(result);
            };

            const timer = setTimeout(() => {
                settle(new Error(`LiveTTSGenerator: WebSocket timeout (${this.modelTimeout}ms) on ${model}`));
            }, this.modelTimeout);

            const ws = new this._WebSocket(wsUrl);
            const audioChunks = [];
            let audioMimeType = 'audio/wav';

            ws.onopen = () => {
                // Send session configuration (first & only setup message)
                const setup = {
                    setup: {
                        model: `models/${model}`,
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                        },
                    },
                };

                // Add voice config only if a specific voice was requested
                if (voice) {
                    setup.setup.generationConfig.speechConfig = {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voice,
                            },
                        },
                    };
                }

                ws.send(JSON.stringify(setup));
            };

            ws.onmessage = (event) => {
                // The Live API sends text (JSON) for control messages
                // and potentially Blob/binary for audio. Handle both.
                if (typeof event.data === 'string') {
                    this._handleTextMessage(event.data, ws, segment, audioChunks, (mime) => {
                        if (mime) audioMimeType = mime;
                    }, settle);
                } else if (Buffer.isBuffer(event.data) || event.data instanceof Buffer) {
                    // Binary audio data (unlikely for this API but be safe)
                    audioChunks.push(event.data);
                } else if (event.data && typeof event.data === 'object' && event.data.data) {
                    // ArrayBuffer or similar
                    audioChunks.push(Buffer.from(event.data));
                }
            };

            ws.onerror = (err) => {
                settle(new Error(`LiveTTSGenerator: WebSocket error on ${model} — ${err.message || err}`));
            };

            ws.onclose = () => {
                // If we haven't settled yet, treat as end of stream with whatever audio we got
                if (!settled) {
                    if (audioChunks.length > 0) {
                        settle(null, this._buildResult(audioChunks, audioMimeType, segment, voice));
                    } else {
                        settle(new Error(`LiveTTSGenerator: connection closed without audio on ${model}`));
                    }
                }
            };
        });
    }

    /**
     * Process a text (JSON) message from the Live API.
     *
     * @param {string} raw - Raw JSON string from the server
     * @param {WebSocket} ws - Active WebSocket (to send next message)
     * @param {Object} segment - The segment being processed
     * @param {Buffer[]} audioChunks - Accumulated audio buffers
     * @param {Function} setMimeType - Callback to update audio mime type
     * @param {Function} settle - Callback to resolve/reject the promise
     */
    _handleTextMessage(raw, ws, segment, audioChunks, setMimeType, settle) {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (_) {
            return; // Ignore malformed JSON
        }

        // -- Setup complete → send the actual text content --
        if (msg.setupComplete) {
            const contentMsg = {
                clientContent: {
                    turns: [
                        {
                            role: 'user',
                            parts: [{ text: segment.text }],
                        },
                    ],
                    turnComplete: true,
                },
            };
            ws.send(JSON.stringify(contentMsg));
            return;
        }

        // -- Server content (model's response) --
        if (msg.serverContent) {
            const modelTurn = msg.serverContent.modelTurn;
            if (modelTurn && modelTurn.parts) {
                for (const part of modelTurn.parts) {
                    // Audio data
                    if (part.inlineData && part.inlineData.data) {
                        const buf = Buffer.from(part.inlineData.data, 'base64');
                        if (buf.length > 0) {
                            audioChunks.push(buf);
                        }
                        if (part.inlineData.mimeType) {
                            setMimeType(part.inlineData.mimeType);
                        }
                    }
                }
            }

            // If turn is complete, close cleanly
            if (msg.serverContent.turnComplete) {
                // Give a small delay for any in-flight chunks, then resolve
                setImmediate(() => {
                    if (audioChunks.length > 0) {
                        settle(null, {
                            id: segment.id,
                            text: segment.text,
                            audio: Buffer.concat(audioChunks),
                            voice: segment.voice || 'auto',
                            format: 'wav',
                        });
                    } else {
                        // Model responded but no audio — text-only response
                        settle(new Error(
                            'LiveTTSGenerator: model returned text-only response (no audio). ' +
                            'Ensure responseModalities includes AUDIO.'
                        ));
                    }
                });
                // Close the WebSocket after a short grace period
                setTimeout(() => {
                    try { ws.close(); } catch (_) { /* ignore */ }
                }, 500);
            }
            return;
        }

        // -- Tool call — ignore for TTS --
        if (msg.toolCall) {
            return;
        }

        // -- Usage metadata / goAway / session resumption — informational, ignore --
    }

    /**
     * Build the result object from accumulated audio chunks.
     */
    _buildResult(audioChunks, mimeType, segment, voice) {
        const format = mimeType.split('/').pop() || 'wav';
        return {
            id: segment.id,
            text: segment.text,
            audio: Buffer.concat(audioChunks),
            voice: voice || 'auto',
            format,
        };
    }
}

module.exports = { LiveTTSGenerator, LIVE_MODELS, LIVE_MODEL_NAMES };
