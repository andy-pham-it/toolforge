'use strict';
const { describe, it, before, after, mock } = require('node:test');
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

function makeMockFetch(statusCode, responseBody) {
    return mock.fn(async () => ({
        ok: statusCode >= 200 && statusCode < 300,
        status: statusCode,
        json: async () => responseBody,
        text: async () => (typeof responseBody === 'object' ? JSON.stringify(responseBody) : String(responseBody)),
    }));
}

describe('TTSGenerator', () => {
    describe('constructor', () => {
        it('should throw when no API key is provided', () => {
            // Temporarily clear env vars
            const savedKey = process.env.GEMINI_API_KEY;
            const savedKey2 = process.env.GOOGLE_API_KEY;
            delete process.env.GEMINI_API_KEY;
            delete process.env.GOOGLE_API_KEY;

            assert.throws(
                () => new TTSGenerator({}),
                { message: /API key is required/ },
            );

            // Restore
            if (savedKey) process.env.GEMINI_API_KEY = savedKey;
            if (savedKey2) process.env.GOOGLE_API_KEY = savedKey2;
        });
    });

    describe('generate()', () => {
        it('should throw when segment has no text', async () => {
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                _fetch: makeMockFetch(200, {}),
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

        it('should call Gemini Interactions API and return audio buffer', async () => {
            const mockAudioBase64 = Buffer.from('fake-audio-data').toString('base64');
            const mockResponse = {
                turns: [{
                    parts: [{
                        inlineData: {
                            mimeType: 'audio/wav',
                            data: mockAudioBase64,
                        },
                    }],
                }],
            };

            const fetchMock = makeMockFetch(200, mockResponse);
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);

            assert.ok(result, 'result should be returned');
            assert.ok(Buffer.isBuffer(result.audio), 'audio should be a Buffer');
            assert.equal(result.audio.toString(), 'fake-audio-data');
            assert.equal(result.text, SAMPLE_SEGMENT.text);
            assert.equal(result.voice, SAMPLE_SEGMENT.voice);
            assert.equal(result.format, 'wav');

            // Verify API call structure
            assert.equal(fetchMock.mock.calls.length, 1);
            const callUrl = fetchMock.mock.calls[0].arguments[0];
            assert.ok(callUrl.includes('generativelanguage.googleapis.com'), 'URL should be Interactions API');
            assert.ok(!callUrl.includes('key='), 'API key should NOT be in URL');

            const callHeaders = fetchMock.mock.calls[0].arguments[1].headers;
            assert.equal(callHeaders['x-goog-api-key'], 'test-key', 'API key should be in x-goog-api-key header');

            const callBody = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
            // Model
            assert.equal(callBody.model, 'gemini-3.1-flash-tts-preview');
            // Input as string (not {text: "..."})
            assert.equal(typeof callBody.input, 'string', 'input should be a string');
            assert.ok(callBody.input.includes(SAMPLE_SEGMENT.text));
            // Audio tags embedded as [neutral] prefix
            assert.ok(callBody.input.startsWith('[neutral]'), 'audio tags should be inline [tag] markers');
            // response_format at top level
            assert.deepEqual(callBody.response_format, { type: 'audio' });
            // speech_config as array
            assert.ok(callBody.generation_config, 'should have generation_config');
            assert.ok(Array.isArray(callBody.generation_config.speech_config), 'speech_config should be an array');
            assert.equal(callBody.generation_config.speech_config[0].voice, 'Charon');
        });

        it('should throw on non-ok response', async () => {
            const fetchMock = makeMockFetch(400, { error: { message: 'Bad request' } });
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            await assert.rejects(
                () => gen.generate(SAMPLE_SEGMENT),
                { message: /Gemini TTS API error/ },
            );
        });

        it('should retry on 429 and succeed', async () => {
            let callCount = 0;
            const mockAudioBase64 = Buffer.from('retry-success').toString('base64');
            const fetchMock = mock.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    return { ok: false, status: 429, text: async () => 'Rate limited' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        turns: [{
                            parts: [{
                                inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                            }],
                        }],
                    }),
                    text: async () => '',
                };
            });

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview', fallback: null },
                _fetch: fetchMock,
                maxRetries: 2,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.ok(result);
            assert.equal(callCount, 2, 'should retry once');
        });

        it('should fallback to fallback model on 403', async () => {
            let callCount = 0;
            const mockAudioBase64 = Buffer.from('fallback-success').toString('base64');
            const fetchMock = mock.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    return { ok: false, status: 403, text: async () => 'Quota exceeded' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        turns: [{
                            parts: [{
                                inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                            }],
                        }],
                    }),
                    text: async () => '',
                };
            });

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: {
                    model: 'gemini-3.1-flash-tts-preview',
                    fallback: 'gemini-2.5-flash-preview-tts',
                },
                _fetch: fetchMock,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.ok(result);
            assert.equal(callCount, 2, 'should try primary, then fallback');
        });

        it('should throw if both models return 403', async () => {
            const fetchMock = mock.fn(async () => {
                return { ok: false, status: 403, text: async () => 'Quota exceeded on all models' };
            });

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: {
                    model: 'gemini-3.1-flash-tts-preview',
                    fallback: 'gemini-2.5-flash-preview-tts',
                },
                _fetch: fetchMock,
                maxRetries: 0, // Don't retry — just test fallback
            });

            await assert.rejects(
                () => gen.generate(SAMPLE_SEGMENT),
                { message: /quota exhausted on both/ },
            );
        });
    });

    describe('generateBatch()', () => {
        it('should generate audio for multiple segments', async () => {
            const mockAudioBase64 = Buffer.from('audio-data').toString('base64');
            const mockResponse = {
                turns: [{
                    parts: [{
                        inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                    }],
                }],
            };

            const fetchMock = makeMockFetch(200, mockResponse);
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const segments = [
                { ...SAMPLE_SEGMENT, id: 1, text: 'First segment.' },
                { ...SAMPLE_SEGMENT, id: 2, text: 'Second segment.' },
            ];

            const results = await gen.generateBatch(segments);
            assert.equal(results.length, 2);
            assert.equal(fetchMock.mock.calls.length, 2, 'should call API per segment');
        });

        it('should skip failed segments and return partial results with ids', async () => {
            const fetchMock = mock.fn(async (url, opts) => {
                const body = JSON.parse(opts.body);
                const text = body.input;
                if (text && text.includes('Second')) {
                    return { ok: false, status: 500, text: async () => 'Server error' };
                }
                const mockAudioBase64 = Buffer.from(`audio-${text || 'unknown'}`).toString('base64');
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        turns: [{
                            parts: [{
                                inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                            }],
                        }],
                    }),
                    text: async () => '',
                };
            });

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
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
                _fetch: makeMockFetch(200, {}),
            });
            const results = await gen.generateBatch([]);
            assert.deepEqual(results, []);
        });
    });
});
