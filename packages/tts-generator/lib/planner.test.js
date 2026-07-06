'use strict';
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const TTSPlanner = require('./planner');

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
});
