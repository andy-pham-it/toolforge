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
        text: async () => JSON.stringify(responseBody),
    }));
}

describe('TTSGenerator', () => {
    describe('generate()', () => {
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
            assert.ok(callUrl.includes('generativelanguage.googleapis.com'));
            assert.ok(callUrl.includes('key=test-key'));

            const callBody = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
            assert.equal(callBody.model, 'gemini-3.1-flash-tts-preview');
            assert.equal(callBody.input.text, SAMPLE_SEGMENT.text);
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
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.ok(result);
            assert.equal(callCount, 2, 'should retry once');
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

        it('should skip failed segments and return partial results', async () => {
            const fetchMock = mock.fn(async (url, opts) => {
                const body = JSON.parse(opts.body);
                const text = body.input.text;
                if (text === 'Second.') {
                    return { ok: false, status: 500, text: async () => 'Server error' };
                }
                const mockAudioBase64 = Buffer.from(`audio-${text}`).toString('base64');
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
            // segment 2 fails — should still return 2 successful + 1 error
            assert.equal(results.length, 3, 'should return all segments');
            const failed = results.find(r => r.error);
            assert.ok(failed, 'failed segment should have error property');
            assert.equal(failed.id, 2);
        });
    });
});
