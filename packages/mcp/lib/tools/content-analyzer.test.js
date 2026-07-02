const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./content-analyzer');

describe('andy_toolforge_competitor_analyzer handler', () => {
    function mockLlm(result) {
        return {
            apiKey: 'test-key',
            model: 'gemini-2.0-flash',
            analyzeCompetitor: async (_url, _scope, _lang) => result,
        };
    }

    it('returns analysis for valid input', async () => {
        const mockResult = {
            swot: { strengths: ['Good content'], weaknesses: ['Slow'], opportunities: ['SEO'], threats: ['Competitors'] },
        };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            competitorUrl: 'https://example.com',
            analysisScope: 'full',
        });
        assert(result.swot);
        assert(result.swot.strengths.includes('Good content'));
    });

    it('returns error when competitorUrl missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { analysisScope: 'full' }),
            /competitorUrl/
        );
    });

    it('returns error when analysisScope missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { competitorUrl: 'https://example.com' }),
            /analysisScope/
        );
    });

    it('passes lang parameter', async () => {
        const mockResult = { swot: { strengths: ['Nội dung tốt'] } };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            competitorUrl: 'https://example.com',
            analysisScope: 'content',
            lang: 'vi',
        });
        assert(result.swot.strengths.includes('Nội dung tốt'));
    });
});
