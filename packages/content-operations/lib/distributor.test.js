const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const ContentDistributor = require('./distributor');
const { ContentDistributorError } = require('./errors');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
const mockLLM = {
    chat: async (prompt) => {
        if (prompt.includes('repurposing strategist')) return JSON.stringify({
            platformPlans: [
                { platform: 'YouTube', format: 'Video', adaptedContent: 'Video script version', adjustments: ['Add visuals'], estimatedTime: 60 },
                { platform: 'Blog', format: 'Article', adaptedContent: 'Blog version', adjustments: ['Expand sections'], estimatedTime: 45 },
            ],
            crossPromotionIdeas: ['Share video on social'],
            bestPlatform: 'YouTube',
            notes: 'Start with YouTube for maximum reach',
        });
        if (prompt.includes('cross-posting specialist')) return JSON.stringify({
            adaptations: [
                { platform: 'Twitter', adaptedText: 'Short tweet version', characterCount: 240, notes: 'Add link' },
                { platform: 'LinkedIn', adaptedText: 'Professional version', characterCount: 1200, notes: 'Add hashtags' },
            ],
            postingOrder: ['LinkedIn', 'Twitter'],
            optimalTimes: ['9 AM', '12 PM'],
            warnings: ['Avoid posting both on same day'],
        });
        if (prompt.includes('repurpose strategist')) return JSON.stringify({
            plan: [
                { format: 'Blog Post', steps: ['Rewrite intro', 'Expand sections'], tools: ['WordPress'], estimatedTimeMinutes: 60, difficulty: 'easy' },
                { format: 'Social Thread', steps: ['Extract key points', 'Write thread'], tools: ['Twitter'], estimatedTimeMinutes: 20, difficulty: 'easy' },
            ],
            quickestWins: ['Social Thread'],
            totalEstimatedTime: 80,
            recommendations: ['Repurpose blog to video next'],
        });
        return JSON.stringify({});
    },
};

describe('ContentDistributor', async () => {
    let distributor;

    before(() => {
        distributor = new ContentDistributor({ logger: mockLogger, llmClient: mockLLM });
    });

    describe('constructor', async () => {
        await it('should create instance with defaults', () => {
            const d = new ContentDistributor();
            assert.ok(d.logger);
            assert.strictEqual(d.llmClient, null);
        });
    });

    describe('repurposeContent', async () => {
        await it('should return repurpose plan for valid input', async () => {
            const result = await distributor.repurposeContent('Long form content about marketing', ['youtube', 'blog']);
            assert.ok(Array.isArray(result.platformPlans));
            assert.ok(result.platformPlans.length > 0);
        });

        await it('should throw for empty source', async () => {
            await assert.rejects(
                () => distributor.repurposeContent(''),
                ContentDistributorError
            );
        });

        await it('should throw for empty platforms', async () => {
            await assert.rejects(
                () => distributor.repurposeContent('source', []),
                ContentDistributorError
            );
        });

        await it('should throw for non-array platforms', async () => {
            await assert.rejects(
                () => distributor.repurposeContent('source', 'not-array'),
                ContentDistributorError
            );
        });

        await it('should throw without LLMClient', async () => {
            const d = new ContentDistributor({ logger: mockLogger });
            await assert.rejects(
                () => d.repurposeContent('source', ['blog']),
                /LLMClient is required/
            );
        });
    });

    describe('batchSchedule', async () => {
        await it('should schedule contents with default schedule', async () => {
            const result = await distributor.batchSchedule([
                { title: 'Post 1' },
                { title: 'Post 2' },
            ]);
            assert.ok(Array.isArray(result.scheduled));
            assert.equal(result.totalItems, 2);
            assert.ok(result.scheduled[0].scheduledAt);
        });

        await it('should throw for empty contents', async () => {
            await assert.rejects(
                () => distributor.batchSchedule([]),
                ContentDistributorError
            );
        });

        await it('should use custom schedule', async () => {
            const result = await distributor.batchSchedule(
                [{ title: 'Post 1' }],
                { timeSlot: '14:00', timezone: 'America/New_York', intervalHours: 12 }
            );
            assert.equal(result.timezone, 'America/New_York');
        });
    });

    describe('crossPost', async () => {
        await it('should return cross-post adaptations', async () => {
            const result = await distributor.crossPost(['twitter', 'linkedin'], 'Great content here');
            assert.ok(Array.isArray(result.adaptations));
        });

        await it('should throw for empty platforms', async () => {
            await assert.rejects(
                () => distributor.crossPost([], 'content'),
                ContentDistributorError
            );
        });

        await it('should throw for empty content', async () => {
            await assert.rejects(
                () => distributor.crossPost(['twitter'], ''),
                ContentDistributorError
            );
        });
    });

    describe('generateRepurposePlan', async () => {
        await it('should return repurpose plan', async () => {
            const result = await distributor.generateRepurposePlan('Long video script', ['blog', 'social']);
            assert.ok(Array.isArray(result.plan));
            assert.ok(typeof result.totalEstimatedTime === 'number');
        });

        await it('should throw for empty source', async () => {
            await assert.rejects(
                () => distributor.generateRepurposePlan(''),
                ContentDistributorError
            );
        });

        await it('should throw for empty formats', async () => {
            await assert.rejects(
                () => distributor.generateRepurposePlan('source', []),
                ContentDistributorError
            );
        });

        await it('should throw for non-array formats', async () => {
            await assert.rejects(
                () => distributor.generateRepurposePlan('source', 'not-array'),
                ContentDistributorError
            );
        });
    });
});
