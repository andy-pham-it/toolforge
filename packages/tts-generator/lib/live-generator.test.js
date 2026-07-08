'use strict';
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const {
    LiveTTSGenerator,
    LIVE_MODELS,
    LIVE_MODEL_NAMES,
} = require('./live-generator');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_SEGMENT = {
    id: 1,
    text: 'Xin chào các bạn, hôm nay chúng ta sẽ nói về trí tuệ nhân tạo.',
    title: 'Giới thiệu',
    voice: 'Charon',
    pace: 'normal',
    audioTags: ['neutral'],
    language: 'vi',
    estimatedDuration: 10,
};

/**
 * Build a mock GoogleGenAI constructor that simulates the Live API protocol
 * via the @google/genai SDK.
 *
 * @param {object} opts
 * @param {boolean} [opts.connectOk=true]        — Whether connect succeeds
 * @param {boolean} [opts.audioOk=true]           — Whether serverContent with audio is returned
 * @param {boolean} [opts.turnComplete=true]      — Whether turnComplete fires
 * @param {string}  [opts.audioMime='audio/pcm;rate=24000']
 * @param {number}  [opts.audioLen=16000]         — Length of fake PCM audio buffer
 * @param {boolean} [opts.textOnly=false]         — Return text part instead of audio
 * @param {boolean} [opts.connectError=false]     — Whether connect() rejects
 * @param {number}  [opts.onopenDelay=0]          — ms delay before onmessage
 * @param {number}  [opts.messageDelay=0]          — ms delay before audio message
 * @returns {Function} GoogleGenAI constructor mock
 */
function makeMockGenAI(opts = {}) {
    const {
        connectOk = true,
        audioOk = true,
        turnComplete = true,
        audioMime = 'audio/pcm;rate=24000',
        audioLen = 16000,
        textOnly = false,
        connectError = false,
        onopenDelay = 0,
        messageDelay = 0,
    } = opts;

    let _lastSession = null;

    class MockSession {
        constructor() {
            this.sendClientContent = mock.fn(() => {});
            this.close = mock.fn(() => {
                if (this._callbacks && this._callbacks.onclose) {
                    setTimeout(() => this._callbacks.onclose({}), 10);
                }
            });
        }

        setCallbacks(callbacks) {
            this._callbacks = callbacks;
        }

        getLastSession() { return this; }
    }

    class MockGoogleGenAI {
        constructor({ apiKey } = {}) {
            this.apiKey = apiKey;
            this.live = {
                connect: ({ model, config, callbacks }) => {
                    return new Promise((resolve, reject) => {
                        if (connectError) {
                            reject(new Error('mock connection error'));
                            return;
                        }

                        const session = new MockSession();
                        session.setCallbacks(callbacks);
                        _lastSession = session;

                        // Simulate async connection: setupComplete → audio
                        setTimeout(() => {
                            if (callbacks.onmessage) {
                                // 1. setupComplete
                                callbacks.onmessage({ setupComplete: {} });
                            }

                            // 2. serverContent with audio (if configured)
                            if (audioOk) {
                                setTimeout(() => {
                                    if (!callbacks.onmessage) return;

                                    const parts = [];

                                    if (textOnly) {
                                        parts.push({ text: 'This is a text response from the model.' });
                                    } else if (audioLen > 0) {
                                        const audioBuf = Buffer.alloc(audioLen, 0xAB);
                                        parts.push({
                                            inlineData: {
                                                mimeType: audioMime,
                                                data: audioBuf.toString('base64'),
                                            },
                                        });
                                    }

                                    const serverMsg = {
                                        serverContent: {
                                            modelTurn: { parts },
                                        },
                                    };

                                    if (turnComplete) {
                                        serverMsg.serverContent.turnComplete = true;
                                    }

                                    callbacks.onmessage(serverMsg);
                                }, messageDelay + 5);
                            }
                        }, onopenDelay);

                        resolve(session);
                    });
                },
            };
        }
    }

    MockGoogleGenAI._lastSession = () => _lastSession;

    return MockGoogleGenAI;
}

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

describe('LiveTTSGenerator — PCM helpers', () => {
    describe('_isPcm', () => {
        it('should return true for audio/pcm mime types', async () => {
            const { _isPcm } = require('./live-generator');
            assert.equal(_isPcm('audio/pcm;rate=24000'), true);
            assert.equal(_isPcm('audio/l16'), true);
            assert.equal(_isPcm('audio/l8'), true);
            assert.equal(_isPcm('audio/raw'), true);
        });

        it('should return false for non-PCM mime types', async () => {
            const { _isPcm } = require('./live-generator');
            assert.equal(_isPcm('audio/wav'), false);
            assert.equal(_isPcm('audio/mpeg'), false);
            assert.equal(_isPcm(''), false);
            assert.equal(_isPcm(null), false);
            assert.equal(_isPcm(undefined), false);
        });
    });

    describe('_parseSampleRate', () => {
        it('should extract sample rate from mime type', async () => {
            const { _parseSampleRate } = require('./live-generator');
            assert.equal(_parseSampleRate('audio/pcm;rate=24000'), 24000);
            assert.equal(_parseSampleRate('audio/pcm;rate=44100;codec=pcm'), 44100);
            assert.equal(_parseSampleRate('audio/l16'), 24000); // default
        });

        it('should return 24000 for missing rate', async () => {
            const { _parseSampleRate } = require('./live-generator');
            assert.equal(_parseSampleRate('audio/pcm'), 24000);
            assert.equal(_parseSampleRate(''), 24000);
            assert.equal(_parseSampleRate(null), 24000);
        });
    });

    describe('_pcmToWav', () => {
        it('should add a WAV header to raw PCM data', async () => {
            const { _pcmToWav } = require('./live-generator');
            const pcm = Buffer.alloc(1000, 0xAB);
            const wav = _pcmToWav(pcm);

            assert.equal(wav.slice(0, 4).toString('ascii'), 'RIFF');
            assert.equal(wav.slice(8, 12).toString('ascii'), 'WAVE');
            assert.equal(wav.slice(12, 16).toString('ascii'), 'fmt ');
            assert.equal(wav.readUInt16LE(20), 1); // PCM format
            assert.equal(wav.readUInt16LE(22), 1); // mono
            assert.equal(wav.readUInt32LE(24), 24000); // sample rate
            assert.equal(wav.readUInt16LE(34), 16); // bits per sample
            assert.equal(wav.slice(36, 40).toString('ascii'), 'data');
            assert.equal(wav.readUInt32LE(40), 1000); // data size
            assert.equal(wav.length, 44 + 1000);
        });

        it('should return 44-byte header-only for empty PCM', async () => {
            const { _pcmToWav } = require('./live-generator');
            const wav = _pcmToWav(null);
            assert.equal(wav.length, 44);
        });
    });

    describe('_ensureWav', () => {
        it('should convert PCM mime to WAV', async () => {
            const { _ensureWav } = require('./live-generator');
            const audio = Buffer.alloc(100, 0xAB);
            const result = _ensureWav(audio, 'audio/pcm;rate=24000');
            assert.equal(result.format, 'wav');
            assert.equal(result.audio.length, 44 + 100);
        });

        it('should pass through non-PCM mime', async () => {
            const { _ensureWav } = require('./live-generator');
            const audio = Buffer.alloc(100, 0xAB);
            const result = _ensureWav(audio, 'audio/wav');
            assert.equal(result.format, 'wav');
            assert.equal(result.audio.length, 100); // no header added
        });
    });
});

// ---------------------------------------------------------------------------
// LiveTTSGenerator tests
// ---------------------------------------------------------------------------

describe('LiveTTSGenerator', () => {
    let savedKey1;
    let savedKey2;

    before(() => {
        savedKey1 = process.env.GEMINI_API_KEY;
        savedKey2 = process.env.GOOGLE_API_KEY;
    });

    after(() => {
        if (savedKey1) process.env.GEMINI_API_KEY = savedKey1;
        if (savedKey2) process.env.GOOGLE_API_KEY = savedKey2;
    });

    // ensure env is set for tests that need it
    before(() => {
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
            process.env.GEMINI_API_KEY = 'test-env-key';
        }
    });

    describe('constructor', () => {
        it('should throw when no API key is provided', () => {
            delete process.env.GEMINI_API_KEY;
            delete process.env.GOOGLE_API_KEY;
            assert.throws(
                () => new LiveTTSGenerator({}),
                { message: /API key is required/ },
            );

            process.env.GEMINI_API_KEY = 'test-env-key';
        });

        it('should accept API key from constructor', () => {
            const gen = new LiveTTSGenerator({ apiKey: 'my-key' });
            assert.equal(gen.apiKey, 'my-key');
        });

        it('should accept custom config', () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                live: {
                    models: ['custom-model'],
                    modelTimeout: 5000,
                },
                maxRetries: 0,
                baseDelay: 500,
            });
            assert.deepEqual(gen.models, ['custom-model']);
            assert.equal(gen.modelTimeout, 5000);
            assert.equal(gen.maxRetries, 0);
            assert.equal(gen.baseDelay, 500);
        });

        it('should use default models when none specified', () => {
            const gen = new LiveTTSGenerator({ apiKey: 'key' });
            assert.deepEqual(gen.models, [
                LIVE_MODELS.NATIVE_AUDIO,
                LIVE_MODELS.FLASH_LIVE,
                LIVE_MODELS.LIVE_TRANSLATE,
            ]);
            assert.equal(gen.modelTimeout, 120000);
            assert.equal(gen.maxRetries, 2);
            assert.equal(gen.baseDelay, 1000);
        });
    });

    describe('_backoff', () => {
        it('should return a non-negative number', () => {
            const gen = new LiveTTSGenerator({ apiKey: 'key', baseDelay: 1000 });
            const delay = gen._backoff(0);
            assert.ok(delay >= 0);
            assert.ok(delay <= 1000);
        });

        it('should increase exponentially with attempt', () => {
            const gen = new LiveTTSGenerator({ apiKey: 'key', baseDelay: 1000 });
            const d0 = gen._backoff(0);
            const d1 = gen._backoff(1);
            const d2 = gen._backoff(2);
            // Each should be bounded by baseDelay * 2^attempt
            assert.ok(d0 <= 1000);
            assert.ok(d1 <= 2000);
            assert.ok(d2 <= 4000);
        });

        it('should cap at 30s', () => {
            const gen = new LiveTTSGenerator({ apiKey: 'key', baseDelay: 1000 });
            const d10 = gen._backoff(10);
            assert.ok(d10 <= 30000);
        });
    });

    // -------------------------------------------------------------------
    // Async generator tests with mocked @google/genai SDK
    // -------------------------------------------------------------------

    describe('generate()', () => {
        it('should throw when segment has no text', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                live: { _GoogleGenAI: makeMockGenAI() },
            });

            await assert.rejects(
                () => gen.generate({ id: 1, text: '' }),
                { message: /segment\.text is required/ },
            );

            await assert.rejects(
                () => gen.generate({ id: 1 }),
                { message: /segment\.text is required/ },
            );

            await assert.rejects(
                () => gen.generate(null),
                { message: /segment\.text is required/ },
            );
        });

        it('should return audio buffer on successful generation', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: { _GoogleGenAI: makeMockGenAI({ audioLen: 16000 }) },
            });

            const result = await gen.generate(SAMPLE_SEGMENT);

            assert.equal(result.id, 1);
            assert.equal(result.text, SAMPLE_SEGMENT.text);
            assert.ok(Buffer.isBuffer(result.audio));
            assert.ok(result.audio.length > 44); // WAV header + PCM data
            assert.equal(result.voice, 'Charon');
            assert.equal(result.format, 'wav');

            // Verify WAV header
            assert.equal(result.audio.slice(0, 4).toString('ascii'), 'RIFF');
        });

        it('should use auto voice when voice is not set', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: { _GoogleGenAI: makeMockGenAI({ audioLen: 16000 }) },
            });

            const result = await gen.generate({ id: 2, text: 'Hello world' });
            assert.equal(result.voice, 'auto');
        });

        it('should handle text-only response (no audio) by throwing', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: {
                    models: ['test-model'],
                    _GoogleGenAI: makeMockGenAI({ textOnly: true, turnComplete: true }),
                },
            });

            await assert.rejects(
                () => gen.generate({ id: 1, text: 'Hello' }),
                { message: /text-only response/ },
            );
        });

        it('should handle SDK connect error', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: {
                    models: ['test-model'],
                    _GoogleGenAI: makeMockGenAI({ connectError: true }),
                },
            });

            await assert.rejects(
                () => gen.generate({ id: 1, text: 'Hello' }),
                { message: /connect failed/ },
            );
        });

        it('should handle SDK timeout', async () => {
            const MockTimeoutGenAI = makeMockGenAI({
                connectOk: true,
                audioOk: false,
                turnComplete: false,
                onopenDelay: 0,
            });

            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: {
                    models: ['test-model'],
                    modelTimeout: 10, // very short timeout for testing
                    _GoogleGenAI: MockTimeoutGenAI,
                },
            });

            await assert.rejects(
                () => gen.generate({ id: 1, text: 'Hello' }),
                { message: /SDK timeout/ },
            );
        });

        it('should retry on transient error', async () => {
            let callCount = 0;

            // Mock GoogleGenAI that fails on first connect, succeeds on second
            class FailingGenAI {
                constructor({ apiKey } = {}) {
                    this.apiKey = apiKey;
                    this.live = {
                        connect: ({ model, config, callbacks }) => {
                            return new Promise((resolve, reject) => {
                                if (callCount === 0) {
                                    callCount++;
                                    reject(new Error('transient connection error'));
                                    return;
                                }

                                const session = {
                                    sendClientContent: mock.fn(() => {}),
                                    close: mock.fn(() => {
                                        if (callbacks.onclose) {
                                            setTimeout(() => callbacks.onclose({}), 10);
                                        }
                                    }),
                                };

                                setTimeout(() => {
                                    if (callbacks.onmessage) {
                                        callbacks.onmessage({ setupComplete: {} });
                                    }

                                    setTimeout(() => {
                                        if (callbacks.onmessage) {
                                            const audioBuf = Buffer.alloc(1000, 0xAB);
                                            callbacks.onmessage({
                                                serverContent: {
                                                    modelTurn: {
                                                        parts: [{
                                                            inlineData: {
                                                                mimeType: 'audio/pcm;rate=24000',
                                                                data: audioBuf.toString('base64'),
                                                            },
                                                        }],
                                                    },
                                                    turnComplete: true,
                                                },
                                            });
                                        }
                                    }, 10);
                                }, 5);

                                resolve(session);
                            });
                        },
                    };
                }
            }

            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 1,
                baseDelay: 1,
                live: {
                    models: ['test-model'],
                    modelTimeout: 1000,
                    _GoogleGenAI: FailingGenAI,
                },
            });

            const result = await gen.generate({ id: 1, text: 'Hello' });
            assert.ok(Buffer.isBuffer(result.audio));
            assert.ok(result.audio.length > 0);
        });

        it('should try next model when one model fails all retries', async () => {
            const modelAttempts = [];

            class ErrorGenAI {
                constructor({ apiKey } = {}) {
                    this.apiKey = apiKey;
                    this.live = {
                        connect: ({ model, config, callbacks }) => {
                            modelAttempts.push(model);

                            return new Promise((resolve, reject) => {
                                // Connect succeeds, but then error fires
                                const session = {
                                    sendClientContent: mock.fn(() => {}),
                                    close: mock.fn(() => {
                                        if (callbacks.onclose) {
                                            setTimeout(() => callbacks.onclose({}), 10);
                                        }
                                    }),
                                };

                                setTimeout(() => {
                                    if (callbacks.onerror) {
                                        callbacks.onerror(new Error('connection refused'));
                                    }
                                }, 10);

                                resolve(session);
                            });
                        },
                    };
                }
            }

            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0, // no retries per model, try next model immediately
                baseDelay: 1,
                live: {
                    models: ['model-a', 'model-b', 'model-c'],
                    modelTimeout: 500,
                    _GoogleGenAI: ErrorGenAI,
                },
            });

            await assert.rejects(
                () => gen.generate({ id: 1, text: 'Hello' }),
                { message: /connection refused/ },
            );

            // Should have attempted all 3 models
            assert.equal(modelAttempts.length, 3);
            assert.ok(modelAttempts.includes('models/model-a'));
            assert.ok(modelAttempts.includes('models/model-b'));
            assert.ok(modelAttempts.includes('models/model-c'));
        });
    });

    describe('generateBatch()', () => {
        it('should return empty array for empty input', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                live: { _GoogleGenAI: makeMockGenAI() },
            });

            const results = await gen.generateBatch([]);
            assert.deepEqual(results, []);
        });

        it('should generate audio for multiple segments sequentially', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: { _GoogleGenAI: makeMockGenAI({ audioLen: 1000 }) },
            });

            const results = await gen.generateBatch(
                [
                    { id: 1, text: 'Segment one' },
                    { id: 2, text: 'Segment two' },
                    { id: 3, text: 'Segment three' },
                ],
                { concurrency: 1 },
            );

            assert.equal(results.length, 3);
            results.forEach(r => {
                assert.ok(Buffer.isBuffer(r.audio));
                assert.equal(r.format, 'wav');
            });
        });

        it('should handle errors in batch by returning error properties', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: {
                    models: ['test-model'],
                    modelTimeout: 100,
                    _GoogleGenAI: makeMockGenAI({ connectError: true }),
                },
            });

            const results = await gen.generateBatch([
                { id: 1, text: 'Will fail' },
            ]);

            assert.equal(results.length, 1);
            assert.ok(results[0].error, 'should have error property');
        });
    });

    describe('LIVE_MODELS export', () => {
        it('should contain expected model constants', () => {
            assert.equal(LIVE_MODELS.NATIVE_AUDIO, 'gemini-2.5-flash-native-audio-latest');
            assert.equal(LIVE_MODELS.FLASH_LIVE, 'gemini-3.1-flash-live-preview');
            assert.equal(LIVE_MODELS.LIVE_TRANSLATE, 'gemini-3.5-live-translate-preview');
        });

        it('LIVE_MODEL_NAMES should be array of model values', () => {
            assert.ok(Array.isArray(LIVE_MODEL_NAMES));
            assert.equal(LIVE_MODEL_NAMES.length, 3);
            assert.ok(LIVE_MODEL_NAMES.includes('gemini-2.5-flash-native-audio-latest'));
        });
    });

    describe('voice resolution', () => {
        it('should include voice in result when voice is specified', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: {
                    models: ['test-model'],
                    _GoogleGenAI: makeMockGenAI({ audioLen: 1000 }),
                },
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.equal(result.voice, 'Charon');
        });

        it('should use auto voice when voice is not set', async () => {
            const gen = new LiveTTSGenerator({
                apiKey: 'key',
                maxRetries: 0,
                live: {
                    models: ['test-model'],
                    _GoogleGenAI: makeMockGenAI({ audioLen: 1000 }),
                },
            });

            const result = await gen.generate({ id: 2, text: 'Hello world' });
            assert.equal(result.voice, 'auto');
        });
    });
});
