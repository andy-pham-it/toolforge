const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const ContentResearcher = require('./researcher');
const { ContentResearcherError } = require('./errors');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
const mockLLM = {
    chat: async (prompt) => {
        if (prompt.includes('trend researcher')) return JSON.stringify([
            { name: 'AI Content', description: 'AI-generated content trends', momentum: 'rising', relatedKeywords: ['AI', 'automation', 'content'] },
        ]);
        if (prompt.includes('keyword researcher')) return JSON.stringify({
            primaryKeywords: [{ keyword: 'content marketing', volume: 'high', difficulty: 45 }],
            longTailKeywords: ['content marketing strategy', 'content marketing for beginners'],
            suggestedTags: ['marketing', 'content', 'strategy'],
        });
        if (prompt.includes('competitor analyst')) return JSON.stringify({
            contentStrategy: 'Regular blog posts and video content',
            strengths: ['SEO', 'Consistency'],
            weaknesses: ['No social media presence'],
            estimatedAudience: 'Small business owners',
            contentTypeMix: { written: 70, video: 20, other: 10 },
            recommendedActions: ['Start social media', 'Create video content'],
        });
        if (prompt.includes('Analyze content gaps')) return JSON.stringify({
            gaps: [{ topic: 'Beginner guides', whyUncovered: 'Too basic for existing content', opportunity: 'high', suggestedFormat: 'blog' }],
            topOpportunities: ['Beginner guides'],
            marketTrend: 'Growing demand for entry-level content',
        });
        if (prompt.includes('Generate')) return JSON.stringify([
            { title: 'Getting Started Guide', format: 'blog', targetAudience: 'Beginners', estimatedEffort: 'easy', whyWorks: 'High search volume', primaryKeyword: 'getting started' },
        ]);
        return JSON.stringify({});
    },
};

describe('ContentResearcher', async () => {
    let researcher;

    before(() => {
        researcher = new ContentResearcher({ logger: mockLogger, llmClient: mockLLM });
    });

    describe('constructor', async () => {
        await it('should create instance with defaults', () => {
            const r = new ContentResearcher();
            assert.ok(r.logger);
            assert.strictEqual(r.llmClient, null);
        });

        await it('should accept config', () => {
            const r = new ContentResearcher({ logger: mockLogger, llmClient: mockLLM });
            assert.strictEqual(r.llmClient, mockLLM);
        });
    });

    describe('discoverTrends', async () => {
        await it('should return trends for a valid niche', async () => {
            const result = await researcher.discoverTrends('content marketing');
            assert.ok(Array.isArray(result.trends));
            assert.ok(result.trends.length > 0);
            assert.equal(result.niche, 'content marketing');
        });

        await it('should throw for empty niche', async () => {
            await assert.rejects(
                () => researcher.discoverTrends(''),
                ContentResearcherError
            );
        });

        await it('should throw without LLMClient', async () => {
            const r = new ContentResearcher({ logger: mockLogger });
            await assert.rejects(
                () => r.discoverTrends('niche'),
                /LLMClient is required/
            );
        });
    });

    describe('analyzeKeywords', async () => {
        await it('should return keyword analysis', async () => {
            const result = await researcher.analyzeKeywords('content marketing');
            assert.ok(Array.isArray(result.primaryKeywords));
            assert.ok(Array.isArray(result.longTailKeywords));
        });

        await it('should throw for non-string niche', async () => {
            await assert.rejects(
                () => researcher.analyzeKeywords(123),
                ContentResearcherError
            );
        });
    });

    describe('analyzeCompetitor', async () => {
        await it('should return competitor analysis', async () => {
            const result = await researcher.analyzeCompetitor('https://example.com');
            assert.ok(typeof result.contentStrategy === 'string');
            assert.ok(Array.isArray(result.strengths));
        });

        await it('should throw for empty URL', async () => {
            await assert.rejects(
                () => researcher.analyzeCompetitor(''),
                ContentResearcherError
            );
        });
    });

    describe('findContentGaps', async () => {
        await it('should return gap analysis', async () => {
            const result = await researcher.findContentGaps('marketing', ['competitor1', 'competitor2']);
            assert.ok(Array.isArray(result.gaps));
            assert.ok(Array.isArray(result.topOpportunities));
        });

        await it('should throw for non-array competitors', async () => {
            await assert.rejects(
                () => researcher.findContentGaps('niche', 'not-array'),
                ContentResearcherError
            );
        });
    });

    describe('generateContentIdeas', async () => {
        await it('should return content ideas', async () => {
            const result = await researcher.generateContentIdeas('marketing', 3);
            assert.ok(Array.isArray(result.ideas));
            assert.equal(result.count, 3);
        });

        await it('should throw for invalid count', async () => {
            await assert.rejects(
                () => researcher.generateContentIdeas('niche', 0),
                ContentResearcherError
            );
            await assert.rejects(
                () => researcher.generateContentIdeas('niche', 100),
                ContentResearcherError
            );
        });
    });
});
