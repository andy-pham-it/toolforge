'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const TTSGenerator = require('./generator');

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

function makeMockGenerateFn(response) {
    return async () => response;
}

describe('TTSGenerator', () => {
    describe('constructor', () => {
        it('should throw when no API key is provided', () => {
            const savedKeys = {
                GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
                GEMINI_API_KEY: process.env.GEMINI_API_KEY,
            };
            delete process.env.GOOGLE_API_KEY;
            delete process.env.GEMINI_API_KEY;

            assert.throws(
                () => new TTSGenerator({}),
                { message: /API key is required/ },
            );

            Object.assign(process.env, savedKeys);
        });

        it('should accept GEMINI_API_KEY env var', () => {
            const saved = process.env.GEMINI_API_KEY;
            process.env.GEMINI_API_KEY = 'env-key';
            try {
                const gen = new TTSGenerator({});
                assert.ok(gen);
            } finally {
                if (saved) process.env.GEMINI_API_KEY = saved;
                else delete process.env.GEMINI_API_KEY;
            }
        });
    });

    describe('generate()', () => {
        it('should throw when segment has no text', async () => {
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                _generateFn: makeMockGenerateFn({}),
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

        it('should call SDK and return audio buffer', async () => {
            const fakeAudio = Buffer.from('fake-audio-data');
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: 'audio/l16; rate=24000',
                                data: fakeAudio,
                            },
                        }],
                    },
                }],
            };

            let callArgs = null;
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _generateFn: async ({ model, contents, config }) => {
                    callArgs = { model, contents, config };
                    return mockResponse;
                },
            });

            const result = await gen.generate(SAMPLE_SEGMENT);

            assert.ok(result, 'result should be returned');
            assert.ok(Buffer.isBuffer(result.audio), 'audio should be a Buffer');
            assert.ok(result.audio.length > 44, 'audio should have WAV header + content');
            assert.equal(result.audio.readUInt32LE(0), 0x46464952, 'should start with RIFF header');
            assert.equal(result.text, SAMPLE_SEGMENT.text);
            assert.equal(result.voice, SAMPLE_SEGMENT.voice);
            assert.equal(result.format, 'wav');

            assert.equal(callArgs.model, 'gemini-3.1-flash-tts-preview');
            assert.equal(callArgs.contents, SAMPLE_SEGMENT.text);
            assert.equal(callArgs.config.responseModalities[0], 'AUDIO');
            assert.equal(callArgs.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Charon');
        });

        it('should throw on SDK error', async () => {
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _generateFn: async () => {
                    throw Object.assign(new Error('generateContent error (500): Internal error'));
                },
            });

            await assert.rejects(
                () => gen.generate(SAMPLE_SEGMENT),
                { message: /generateContent error.*500/ },
            );
        });

        it('should retry on 429 and succeed', async () => {
            let callCount = 0;
            const fakeAudio = Buffer.from('retry-success');
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: 'audio/l16; rate=24000',
                                data: fakeAudio,
                            },
                        }],
                    },
                }],
            };

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview', fallback: null },
                _generateFn: async () => {
                    callCount++;
                    if (callCount === 1) {
                        throw Object.assign(new Error('rate limited'), {
                            message: 'generateContent error (429): Rate limited',
                        });
                    }
                    return mockResponse;
                },
                maxRetries: 2,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.ok(result);
            assert.equal(callCount, 2, 'should retry once');
        });

        it('should try fallback model on error', async () => {
            let callCount = 0;
            const fakeAudio = Buffer.from('fallback-success');
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: 'audio/l16; rate=24000',
                                data: fakeAudio,
                            },
                        }],
                    },
                }],
            };

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: {
                    model: 'gemini-3.1-flash-tts-preview',
                    fallback: 'gemini-2.5-flash-preview-tts',
                },
                _generateFn: async ({ model }) => {
                    callCount++;
                    if (callCount === 1) {
                        throw Object.assign(new Error('Model error'), {
                            message: `generateContent error (403): forbidden on ${model}`,
                        });
                    }
                    return mockResponse;
                },
                maxRetries: 0,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.ok(result);
            assert.equal(callCount, 2, 'should try primary, then fallback');
        });

        it('should throw if both models fail', async () => {
            let callCount = 0;
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: {
                    model: 'gemini-3.1-flash-tts-preview',
                    fallback: 'gemini-2.5-flash-preview-tts',
                },
                _generateFn: async ({ model }) => {
                    callCount++;
                    throw Object.assign(new Error('All models failed'), {
                        message: `generateContent error (403): quota exhausted on ${model}`,
                    });
                },
                maxRetries: 0,
            });

            await assert.rejects(
                () => gen.generate(SAMPLE_SEGMENT),
                { message: /generateContent error \(403\)/ },
            );
        });
    });

    describe('generateBatch()', () => {
        it('should generate audio for multiple segments', async () => {
            const fakeAudio = Buffer.from('audio-data');
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: 'audio/l16; rate=24000',
                                data: fakeAudio,
                            },
                        }],
                    },
                }],
            };

            let callCount = 0;
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _generateFn: async () => {
                    callCount++;
                    return mockResponse;
                },
            });

            const segments = [
                { ...SAMPLE_SEGMENT, id: 1, text: 'First segment.' },
                { ...SAMPLE_SEGMENT, id: 2, text: 'Second segment.' },
            ];

            const results = await gen.generateBatch(segments);
            assert.equal(results.length, 2);
            assert.equal(callCount, 2, 'should call API per segment');
        });

        it('should skip failed segments and return partial results with ids', async () => {
            let callCount = 0;
            const fakeAudio = Buffer.from('audio');
            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: 'audio/l16; rate=24000',
                                data: fakeAudio,
                            },
                        }],
                    },
                }],
            };

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _generateFn: async ({ contents }) => {
                    callCount++;
                    if (contents && contents.includes('Second')) {
                        throw Object.assign(new Error('Server error'), {
                            message: 'generateContent error (500): Server error',
                        });
                    }
                    return mockResponse;
                },
            });

            const segments = [
                { ...SAMPLE_SEGMENT, id: 1, text: 'First.' },
                { ...SAMPLE_SEGMENT, id: 2, text: 'Second.' },
                { ...SAMPLE_SEGMENT, id: 3, text: 'Third.' },
            ];

            const results = await gen.generateBatch(segments, { concurrency: 1 });
            assert.equal(results.length, 3, 'should return all segments');
            const failed = results.find(r => r.error);
            assert.ok(failed, 'failed segment should have error property');
            assert.equal(failed.id, 2, 'failed segment should carry its id');
        });

        it('should return empty array for empty segments input', async () => {
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                _generateFn: makeMockGenerateFn({}),
            });
            const results = await gen.generateBatch([]);
            assert.deepEqual(results, []);
        });
    });
});
