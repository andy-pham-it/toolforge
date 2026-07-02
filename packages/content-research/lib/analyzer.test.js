const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const CompetitorAnalyzer = require('./analyzer');
const { LLMClient } = require('./llm');
const { BrowserManager } = require('@andy-toolforge/core');

class MockBrowserManager extends BrowserManager {
    async launch() {
        this.browser = {
            newPage: async () => ({
                goto: async (url) => {
                    assert.equal(url, 'http://competitor.com');
                },
                content: async () => '<html><body>Competitor content</body></html>',
            }),
            close: async () => {},
        };
        return this.browser;
    }
    async close() {}
}

describe('CompetitorAnalyzer', () => {
    it('analyzes competitor correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.analyzeCompetitor = async (pageContent, scope, lang) => {
            assert.equal(pageContent, '<html><body>Competitor content</body></html>');
            assert.equal(scope, 'SEO');
            assert.equal(lang, 'en');
            return { competitorName: 'Competitor A', analysisSummary: 'Good SEO' };
        };

        const analyzer = new CompetitorAnalyzer({});
        analyzer.llm = mockLlm;
        analyzer.browserManager = new MockBrowserManager();

        const result = await analyzer.analyze('http://competitor.com', 'SEO', 'en');
        assert.equal(result.competitorName, 'Competitor A');
        assert.equal(result.analysisSummary, 'Good SEO');
    });

    it('throws error if competitorUrl or analysisScope is missing', async () => {
        const analyzer = new CompetitorAnalyzer({});
        await assert.rejects(() => analyzer.analyze(null, 'Scope'), /competitorUrl/);
        await assert.rejects(() => analyzer.analyze('http://test.com', null), /analysisScope/);
    });
});
