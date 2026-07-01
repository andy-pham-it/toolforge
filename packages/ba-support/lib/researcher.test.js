const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MarketResearcher = require('./researcher');

function makeMockLLM(returnValue) {
    return {
        chat: async (system, user, jsonMode) => {
            if (typeof returnValue === 'function') return returnValue(system, user, jsonMode);
            return returnValue;
        },
    };
}

function makeMockLogger() {
    return { info: () => {}, warn: () => {}, error: () => {} };
}

describe('MarketResearcher', async () => {
    describe('constructor', async () => {
        await it('should create instance without LLMClient', async () => {
            const r = new MarketResearcher({ logger: makeMockLogger() });
            assert.ok(r);
            assert.equal(r.llm, undefined);
        });
    });

    describe('crawlCompetitor', async () => {
        await it('should crawl competitor from URL', async () => {
            const mockProfile = JSON.stringify({
                name: 'Competitor Inc',
                website: 'https://example.com',
                description: 'Makes things',
                products: ['Product A'],
                targetMarket: 'Developers',
                pricingModel: 'Subscription',
                estimatedScale: 'Mid-market',
                keyStrengths: ['Strong brand'],
                keyWeaknesses: ['High price'],
            });

            const r = new MarketResearcher({
                llmClient: makeMockLLM(mockProfile),
                logger: makeMockLogger(),
            });

            const profile = await r.crawlCompetitor('https://example.com');
            assert.equal(profile.name, 'Competitor Inc');
            assert.equal(profile.products.length, 1);
            assert.equal(profile.keyStrengths[0], 'Strong brand');
        });

        await it('should throw for empty URL', async () => {
            const r = new MarketResearcher({ logger: makeMockLogger() });
            await assert.rejects(
                () => r.crawlCompetitor(''),
                { message: 'URL must be a non-empty string' },
            );
        });

        await it('should throw if LLM is not set', async () => {
            const r = new MarketResearcher({ logger: makeMockLogger() });
            await assert.rejects(
                () => r.crawlCompetitor('https://example.com'),
                { message: /LLMClient is required/ },
            );
        });

        await it('should use defaults on invalid JSON', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('not json'),
                logger: makeMockLogger(),
            });

            const profile = await r.crawlCompetitor('https://example.com');
            assert.equal(profile.name, 'https://example.com');
            assert.equal(profile.products.length, 0);
        });
    });

    describe('analyzePricing', async () => {
        await it('should analyze pricing data', async () => {
            const mockAnalysis = JSON.stringify({
                summary: 'Competitive market with varied pricing',
                priceRange: { min: 10, max: 100, currency: 'USD' },
                commonModels: ['Subscription', 'One-time'],
                competitors: [
                    { name: 'Comp A', pricePoint: 'premium', strategy: 'Value-based' },
                ],
                recommendations: ['Consider freemium tier'],
                marketPosition: 'Mid-range',
            });

            const r = new MarketResearcher({
                llmClient: makeMockLLM(mockAnalysis),
                logger: makeMockLogger(),
            });

            const data = [
                { company: 'Comp A', product: 'Basic', price: 10 },
                { company: 'Comp B', product: 'Pro', price: 50 },
            ];

            const analysis = await r.analyzePricing(data);
            assert.equal(analysis.summary, 'Competitive market with varied pricing');
            assert.equal(analysis.recommendations.length, 1);
        });

        await it('should reject empty array', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.analyzePricing([]),
                { message: 'Pricing data must be a non-empty array' },
            );
        });

        await it('should reject non-array', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.analyzePricing('not array'),
                { message: 'Pricing data must be a non-empty array' },
            );
        });
    });

    describe('swotAnalysis', async () => {
        await it('should generate SWOT from competitor data', async () => {
            const mockSwot = JSON.stringify({
                summary: 'Competitive market with opportunities',
                strengths: [
                    { factor: 'Strong brand presence', impact: 'high', source: 'Comp A' },
                ],
                weaknesses: [
                    { factor: 'Limited features', impact: 'medium', source: 'Comp B' },
                ],
                opportunities: [
                    { factor: 'AI integration gap', potential: 'high', actionable: true },
                ],
                threats: [
                    { factor: 'New entrants', severity: 'medium', urgency: 'short-term' },
                ],
                recommendations: ['Invest in AI features'],
            });

            const r = new MarketResearcher({
                llmClient: makeMockLLM(mockSwot),
                logger: makeMockLogger(),
            });

            const data = [
                { name: 'Comp A', description: 'Market leader' },
                { name: 'Comp B', description: 'Challenger' },
            ];

            const swot = await r.swotAnalysis(data);
            assert.equal(swot.summary, 'Competitive market with opportunities');
            assert.equal(swot.strengths.length, 1);
            assert.equal(swot.weaknesses.length, 1);
            assert.equal(swot.opportunities.length, 1);
            assert.equal(swot.threats.length, 1);
        });

        await it('should reject empty competitor data', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.swotAnalysis([]),
                { message: 'Competitor data must be a non-empty array' },
            );
        });
    });

    describe('generateReport', async () => {
        await it('should generate a markdown report', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('# Executive Summary\n\nMarket analysis.'),
                logger: makeMockLogger(),
            });

            const report = await r.generateReport({
                title: 'Market Analysis',
                competitors: ['Comp A', 'Comp B'],
            }, 'markdown');

            assert.ok(report.includes('Executive Summary'));
        });

        await it('should generate a plain text report', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('Executive Summary\n\nMarket analysis.'),
                logger: makeMockLogger(),
            });

            const report = await r.generateReport({
                title: 'Market Analysis',
                competitors: ['Comp A', 'Comp B'],
            }, 'plain');

            assert.ok(report.includes('Executive Summary'));
        });

        await it('should reject invalid format', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('content'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.generateReport({ title: 'Test' }, 'html'),
                { message: 'Format must be one of: markdown, plain' },
            );
        });

        await it('should reject empty findings', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('content'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.generateReport(null, 'markdown'),
                { message: 'Findings must be a non-empty object' },
            );
        });

        await it('should throw if LLM is not set', async () => {
            const r = new MarketResearcher({ logger: makeMockLogger() });
            await assert.rejects(
                () => r.generateReport({ title: 'Test' }, 'markdown'),
                { message: /LLMClient is required/ },
            );
        });
    });

    describe('trackTrends', async () => {
        await it('should analyze trends for keywords', async () => {
            const mockTrends = JSON.stringify({
                summary: 'AI and automation are rising',
                keywords: [
                    { keyword: 'AI', trend: 'rising', momentum: 'high', notes: 'Strong growth' },
                    { keyword: 'Blockchain', trend: 'stable', momentum: 'medium', notes: 'Mature market' },
                ],
                emergingPatterns: ['AI-driven automation'],
                industryInsights: ['Enterprise adoption increasing'],
                recommendedActions: ['Invest in AI capabilities'],
            });

            const r = new MarketResearcher({
                llmClient: makeMockLLM(mockTrends),
                logger: makeMockLogger(),
            });

            const trends = await r.trackTrends(['AI', 'Blockchain']);
            assert.equal(trends.summary, 'AI and automation are rising');
            assert.equal(trends.keywords.length, 2);
            assert.equal(trends.recommendedActions.length, 1);
        });

        await it('should reject empty keywords', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.trackTrends([]),
                { message: 'Keywords must be a non-empty array' },
            );
        });

        await it('should reject non-array keywords', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => r.trackTrends('AI'),
                { message: 'Keywords must be a non-empty array' },
            );
        });

        await it('should use defaults on invalid JSON', async () => {
            const r = new MarketResearcher({
                llmClient: makeMockLLM('bad json'),
                logger: makeMockLogger(),
            });

            const trends = await r.trackTrends(['AI']);
            assert.equal(trends.keywords.length, 0);
            assert.equal(trends.recommendedActions.length, 0);
        });
    });
});
