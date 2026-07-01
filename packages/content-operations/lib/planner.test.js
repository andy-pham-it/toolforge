const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const ContentPlanner = require('./planner');
const { ContentPlannerError } = require('./errors');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
const mockLLM = {
    chat: async (prompt) => {
        if (prompt.includes('calendar strategist')) return JSON.stringify([
            { date: 'Mon', title: 'Intro to Topic', format: 'blog', goal: 'awareness', notes: 'First post' },
            { date: 'Wed', title: 'Deep Dive', format: 'video', goal: 'education', notes: 'Tutorial' },
        ]);
        if (prompt.includes('comprehensive content strategy')) return JSON.stringify({
            mission: 'Educate and engage',
            targetAudience: 'Beginners',
            contentPillars: ['Education', 'Tips'],
            recommendedFormats: ['Blog', 'Video'],
            publishingCadence: '3x weekly',
            distributionChannels: ['YouTube', 'Blog'],
            successMetrics: ['Views', 'Engagement'],
            competitiveAngle: 'Simplicity',
        });
        if (prompt.includes('batch production plan')) return JSON.stringify({
            productionOrder: [{ day: 'Mon', task: 'Write script', assignee: 'Writer', estimatedHours: 2 }],
            dependencies: ['Script before recording'],
            totalEstimatedHours: 10,
            bottlenecks: ['Limited design resources'],
            recommendations: ['Batch create content'],
        });
        if (prompt.includes('timing analyst')) return JSON.stringify({
            recommendations: [
                { platform: 'YouTube', bestTime: '14:00', bestDay: 'Thursday', rationale: 'Highest engagement' },
            ],
            generalAdvice: 'Post during lunch hours',
        });
        return JSON.stringify({});
    },
};

describe('ContentPlanner', async () => {
    let planner;

    before(() => {
        planner = new ContentPlanner({ logger: mockLogger, llmClient: mockLLM });
    });

    describe('constructor', async () => {
        await it('should create instance with defaults', () => {
            const p = new ContentPlanner();
            assert.ok(p.logger);
            assert.strictEqual(p.llmClient, null);
        });
    });

    describe('buildCalendar', async () => {
        await it('should return calendar for valid input', async () => {
            const result = await planner.buildCalendar('marketing', 'weekly');
            assert.ok(Array.isArray(result.calendar));
            assert.ok(result.calendar.length > 0);
        });

        await it('should throw for empty niche', async () => {
            await assert.rejects(
                () => planner.buildCalendar(''),
                ContentPlannerError
            );
        });

        await it('should throw for invalid frequency', async () => {
            await assert.rejects(
                () => planner.buildCalendar('niche', 'yearly'),
                ContentPlannerError
            );
        });

        await it('should throw without LLMClient', async () => {
            const p = new ContentPlanner({ logger: mockLogger });
            await assert.rejects(
                () => p.buildCalendar('niche', 'weekly'),
                /LLMClient is required/
            );
        });
    });

    describe('createContentStrategy', async () => {
        await it('should return strategy for valid input', async () => {
            const result = await planner.createContentStrategy('marketing', ['growth']);
            assert.ok(typeof result.mission === 'string');
            assert.ok(Array.isArray(result.contentPillars));
        });

        await it('should throw for non-array goals', async () => {
            await assert.rejects(
                () => planner.createContentStrategy('niche', 'not-array'),
                ContentPlannerError
            );
        });
    });

    describe('generateBatchPlan', async () => {
        await it('should return batch plan for valid calendar', async () => {
            const calendar = await planner.buildCalendar('marketing', 'weekly');
            const result = await planner.generateBatchPlan(calendar.calendar, 1);
            assert.ok(result.plan);
            assert.ok(typeof result.plan.totalEstimatedHours === 'number');
        });

        await it('should throw for empty calendar', async () => {
            await assert.rejects(
                () => planner.generateBatchPlan([]),
                ContentPlannerError
            );
        });

        await it('should throw for invalid weekRange', async () => {
            await assert.rejects(
                () => planner.generateBatchPlan([{ date: 'Mon', title: 'Test' }], -1),
                ContentPlannerError
            );
        });
    });

    describe('suggestOptimalTimes', async () => {
        await it('should return timing suggestions', async () => {
            const result = await planner.suggestOptimalTimes('small business owners', ['youtube', 'facebook']);
            assert.ok(Array.isArray(result.recommendations));
            assert.ok(result.recommendations.length > 0);
        });

        await it('should throw for empty audience', async () => {
            await assert.rejects(
                () => planner.suggestOptimalTimes(''),
                ContentPlannerError
            );
        });

        await it('should throw for non-array platforms', async () => {
            await assert.rejects(
                () => planner.suggestOptimalTimes('audience', 'not-array'),
                ContentPlannerError
            );
        });
    });
});
