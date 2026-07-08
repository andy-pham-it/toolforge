'use strict';
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const TTSPlanner = require('./planner');
const GeminiWebClient = require('./gemini-web');

const path = require('path');

const SAMPLE_SCRIPT = `Xin chào các bạn, hôm nay chúng ta sẽ nói về trí tuệ nhân tạo.

AI đang thay đổi cách chúng ta làm việc và sống. Nó ảnh hưởng đến mọi ngành công nghiệp.

Trong lĩnh vực y tế, AI giúp chẩn đoán bệnh nhanh hơn và chính xác hơn.

Còn trong giáo dục, AI cá nhân hóa trải nghiệm học tập cho từng học sinh.

Cảm ơn các bạn đã lắng nghe. Hẹn gặp lại ở tập sau.`;

describe('TTSPlanner', () => {
    describe('plan() — LLM mode', () => {
        it('should call LLM and parse SegmentPlan from JSON response', async () => {
            const mockLlm = {
                chat: mock.fn(async () => JSON.stringify({
                    segments: [
                        {
                            id: 1,
                            text: 'Xin chào các bạn, hôm nay chúng ta sẽ nói về trí tuệ nhân tạo.',
                            title: 'Giới thiệu',
                            voice: 'Charon',
                            pace: 'normal',
                            audioTags: ['neutral'],
                            language: 'vi',
                            estimatedDuration: 10,
                        },
                        {
                            id: 2,
                            text: 'AI đang thay đổi cách chúng ta làm việc và sống.',
                            title: 'Tác động của AI',
                            voice: 'Kore',
                            pace: 'normal',
                            audioTags: ['determination'],
                            language: 'vi',
                            estimatedDuration: 8,
                        },
                    ],
                    metadata: {
                        totalEstimatedDuration: 18,
                        voiceCount: 2,
                        languages: ['vi'],
                    },
                })),
            };

            const planner = new TTSPlanner({ llm: mockLlm });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'AI và Tương Lai');

            assert.ok(plan, 'plan should be returned');
            assert.ok(Array.isArray(plan.segments), 'plan.segments should be an array');
            assert.equal(plan.segments.length, 2, 'should have 2 segments');
            assert.equal(plan.segments[0].title, 'Giới thiệu');
            assert.equal(plan.segments[1].voice, 'Kore');
            assert.equal(plan.metadata.totalEstimatedDuration, 18);
        });

        it('should fallback to regex when LLM returns non-JSON', async () => {
            const mockLlm = {
                chat: mock.fn(async () => 'not json at all'),
            };
            const planner = new TTSPlanner({ llm: mockLlm });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'Test');

            assert.ok(plan, 'plan should be returned via fallback');
            assert.ok(Array.isArray(plan.segments), 'segments should be an array');
            assert.ok(plan.segments.length >= 4, 'should fallback to paragraph split');
        });

        it('should retry once then fallback when LLM returns invalid JSON', async () => {
            let callCount = 0;
            const mockLlm = {
                chat: mock.fn(async () => {
                    callCount++;
                    return 'still not json';
                }),
            };
            const planner = new TTSPlanner({ llm: mockLlm, maxRetries: 1 });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'Test');

            assert.ok(plan, 'plan should be returned via fallback');
            assert.equal(callCount, 2, 'should retry once before fallback');
            assert.ok(plan.segments.length >= 4, 'should fallback to paragraph split');
        });
    });

    describe('plan() — regex fallback', () => {
        it('should split by double-newlines when LLM is null', async () => {
            const planner = new TTSPlanner({ llm: null });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'Fallback Test');

            assert.ok(plan, 'plan should be returned');
            // Sample has 5 paragraphs separated by blank lines
            assert.ok(plan.segments.length >= 4, `should split into paragraphs, got ${plan.segments.length}`);
            assert.ok(plan.segments.every(s => s.voice === 'auto'), 'all segments should have auto voice');
            assert.ok(plan.segments.every(s => s.pace === 'normal'), 'all segments should have normal pace');
            assert.ok(Array.isArray(plan.metadata.languages), 'metadata.languages should be an array');
        });

        it('should split by double-newlines when LLM throws', async () => {
            const mockLlm = {
                chat: mock.fn(async () => { throw new Error('API down'); }),
            };
            const planner = new TTSPlanner({ llm: mockLlm });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'Fallback Test');

            assert.ok(plan, 'plan should be returned');
            assert.ok(plan.segments.length >= 4, 'should fallback to paragraph split');
        });
    });

    describe('injectTags()', () => {
        it('should inject audio tags via google-api backend', async () => {
            const mockGenAI = {
                models: {
                    generateContent: mock.fn(async () => ({
                        text: JSON.stringify({
                            segments: [{
                                id: 1,
                                text: '[slow][philosophical] Đây là nội dung segment 1.',
                                audioTags: ['slow', 'philosophical'],
                                pace: 'slow',
                                tone: 'philosophical',
                                suggestedSplit: null,
                                sourceRef: { startChar: 0, endChar: 50 },
                            }, {
                                id: 2,
                                text: '[normal][storyteller] Đây là nội dung segment 2.',
                                audioTags: ['normal', 'storyteller'],
                                pace: 'normal',
                                tone: 'storyteller',
                                suggestedSplit: { splitAt: 'có một câu chuyện', reason: 'segment too long (>60s)' },
                                sourceRef: { startChar: 51, endChar: 200 },
                            }],
                        }),
                    })),
                },
            };

            const planner = new TTSPlanner({ llm: null, genai: mockGenAI, maxRetries: 0 });
            const segments = [
                { id: 1, text: 'Đây là nội dung segment 1.', title: 'Mở đầu', pace: 'normal', audioTags: [] },
                { id: 2, text: 'Đây là nội dung segment 2. Có một câu chuyện dài.', title: 'Nội dung', pace: 'normal', audioTags: [] },
            ];

            const result = await planner.injectTags(segments, 'Đây là nội dung segment 1.\n\nĐây là nội dung segment 2. Có một câu chuyện dài.', { backend: 'google-api' });

            assert.equal(result.length, 2, 'should return all segments');
            assert.ok(result[0].tagsInjected, 'segment 1 should be tagged');
            assert.equal(result[0].text, '[slow][philosophical] Đây là nội dung segment 1.');
            assert.deepEqual(result[0].audioTags, ['slow', 'philosophical']);
            assert.equal(result[0].originalText, 'Đây là nội dung segment 1.');
            assert.equal(result[0].pace, 'slow');
            assert.equal(result[0].tone, 'philosophical');
            assert.equal(result[0].sourceRef.startChar, 0);

            assert.ok(result[1].suggestedSplit, 'should suggest split for long segment');
            assert.equal(result[1].suggestedSplit.splitAt, 'có một câu chuyện');

            // Verify the AI was called with correct prompt
            const callArgs = mockGenAI.models.generateContent.mock.calls[0].arguments[0];
            assert.ok(callArgs.model, 'model should be set');
            assert.equal(callArgs.config.responseMimeType, 'application/json');
            assert.equal(callArgs.config.temperature, 0.3);
        });

        it('should return empty array for empty segments', async () => {
            const planner = new TTSPlanner({ llm: null });
            const result = await planner.injectTags([], 'script');
            assert.deepEqual(result, []);
        });

        it('should preserve non-overridden fields from original segments', async () => {
            const mockGenAI = {
                models: {
                    generateContent: mock.fn(async () => ({
                        text: JSON.stringify({
                            segments: [{
                                id: 1,
                                text: '[calm] Hello world.',
                                audioTags: ['calm'],
                                pace: 'slow',
                                tone: 'calm',
                                suggestedSplit: null,
                                sourceRef: { startChar: 0, endChar: 12 },
                            }],
                        }),
                    })),
                },
            };

            const planner = new TTSPlanner({ llm: null, genai: mockGenAI, maxRetries: 0 });
            const segments = [{
                id: 1,
                text: 'Hello world.',
                title: 'Intro',
                pace: 'normal',
                audioTags: [],
                language: 'en',
                estimatedDuration: 15,
                voice: 'Charon',
            }];

            const result = await planner.injectTags(segments, 'Hello world.', { backend: 'google-api' });

            // Preserved fields
            assert.equal(result[0].title, 'Intro');
            assert.equal(result[0].voice, 'Charon');
            assert.equal(result[0].language, 'en');
            assert.equal(result[0].estimatedDuration, 15);
        });

        it('should return segments from gemini-web backend when Chrome available', async () => {
            const mockPage = {
                setViewport: mock.fn(),
                close: mock.fn(),
            };

            // Mock GeminiWebClient prototype methods
            mock.method(GeminiWebClient.prototype, 'getPage', async () => mockPage);
            mock.method(GeminiWebClient.prototype, 'navigateToChat', async () => {});
            mock.method(GeminiWebClient.prototype, 'checkSignedIn', async () => true);
            mock.method(GeminiWebClient.prototype, 'sendPrompt', async () => {});
            mock.method(GeminiWebClient.prototype, 'waitForResponse', async () => JSON.stringify({
                segments: [{
                    id: 1,
                    text: '[calm][storyteller] Hello world.',
                    audioTags: ['calm', 'storyteller'],
                    pace: 'slow',
                    tone: 'calm',
                    suggestedSplit: null,
                    sourceRef: { startChar: 0, endChar: 12 },
                }],
            }));
            mock.method(GeminiWebClient.prototype, 'close', async () => {});

            const planner = new TTSPlanner({ llm: null });
            const segments = [{ id: 1, text: 'Hello world.', title: 'Intro', pace: 'normal', audioTags: [] }];
            const result = await planner.injectTags(segments, 'Hello world.', { backend: 'gemini-web' });

            assert.equal(result.length, 1);
            assert.ok(result[0].tagsInjected);
            assert.equal(result[0].text, '[calm][storyteller] Hello world.');
            assert.deepEqual(result[0].audioTags, ['calm', 'storyteller']);

            // Verify the flow was called
            assert.equal(GeminiWebClient.prototype.getPage.mock.callCount(), 1);
            assert.equal(GeminiWebClient.prototype.sendPrompt.mock.callCount(), 1);
        });

        it('should fail informatively when gemini-web backend has no Chrome', async () => {
            mock.method(GeminiWebClient.prototype, 'getPage', async () => {
                throw new Error('Chrome not found');
            });
            mock.method(GeminiWebClient.prototype, 'close', async () => {});

            const planner = new TTSPlanner({ llm: null });
            await assert.rejects(
                () => planner.injectTags([{ id: 1, text: 'test' }], 'test', { backend: 'gemini-web' }),
                { message: /gemini-web failed.*Chrome not found/ },
            );
        });
    });
});
