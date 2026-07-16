const { describe, it } = require('node:test');
const assert = require('node:assert');

// Fake LLM that returns controllable JSON
class FakeStockLLM {
    constructor(config) { this.config = config || {}; this.calls = []; }
    async quickChat(systemPrompt, userContent) {
        this.calls.push({ type: 'quick', systemPrompt, userContent });
        // Return a superset of all possible response fields
        return JSON.stringify({
            recommendation: 'MUA',
            reasoning: 'Strong technical signals',
            risks: ['Market volatility'],
            score: 75,
            marketSummary: 'Bullish market with strong momentum',
            sentiment: 'Tích cực',
            notableStocks: ['FPT'],
            advice: 'Focus on leading stocks',
            overallAssessment: 'Well-diversified portfolio',
            concerns: ['Concentration risk in tech'],
            suggestions: ['Add defensive stocks'],
            riskLevel: 'Trung bình',
            summary: 'FPT leads in technical scores',
        });
    }
    async deepChat(systemPrompt, userContent) {
        this.calls.push({ type: 'deep', systemPrompt, userContent });
        return JSON.stringify({
            strategy: 'Buy on pullback to MA20',
            entry: 120000,
            stopLoss: 115000,
            support: [118000, 115000],
            resistance: [125000, 130000],
            reasoning: 'Strong uptrend with accumulation',
            riskReward: 2.5,
        });
    }
}

const { Analyst } = require('./analyst');

describe('Analyst', () => {
    it('should construct', () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        assert.ok(analyst);
        assert.ok(analyst.llm);
    });

    it('analyzeSymbol should return structured result', async () => {
        const fake = new FakeStockLLM();
        const analyst = new Analyst({ llm: fake });
        const result = await analyst.analyzeSymbol('FPT');
        assert.ok(result.symbol, 'FPT');
        assert.strictEqual(result.recommendation, 'MUA');
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.ok(Array.isArray(result.signals));
        assert.ok(result.breakdown);
        assert.ok(fake.calls.length >= 1);
    });

    it('compareSymbols should compare and pick top', async () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        const result = await analyst.compareSymbols(['FPT', 'VNM']);
        assert.ok(result.comparison);
        assert.ok(result.topPick);
    });

    it('analyzeMarket should return market overview', async () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        const result = await analyst.analyzeMarket();
        assert.ok(result.marketSummary);
        assert.ok(result.sentiment);
        assert.ok(result.topStocks);
    });

    it('deepDiveStrategy should return entry/exit plan', async () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        const result = await analyst.deepDiveStrategy('FPT', '1D');
        assert.ok(result.strategy);
        assert.ok(result.entry != null);
        assert.ok(result.stopLoss != null);
    });

    it('portfolioReview should return holdings review', async () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        const result = await analyst.portfolioReview([
            { symbol: 'FPT', shares: 100, avgPrice: 110000 },
            { symbol: 'VNM', shares: 50, avgPrice: 75000 },
        ]);
        assert.ok(result.holdings);
        assert.ok(result.overallAssessment);
    });

    it('analyzeSymbol should handle unknown symbol gracefully', async () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        const result = await analyst.analyzeSymbol('ZZ_NONEXISTENT');
        assert.ok(result.error || result.recommendation);
    });
});
