const { describe, it } = require('node:test');
const assert = require('node:assert');

// ---------- Mocks ----------

class FakeStockLLM {
    constructor(config) { this.config = config || {}; this.calls = []; }
    async quickChat(systemPrompt, userContent) {
        this.calls.push({ type: 'quick', systemPrompt, userContent });
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

/** Mock DB that never connects to real MongoDB */
class MockStockDB {
    constructor() { this.client = { close: async () => {} }; this.db = {}; }
    async connect() { return this.db; }
    async close() {}
    collection() {
        return {
            find: () => ({ toArray: async () => [] }),
        };
    }
    getLatestCandles() { return []; }
    getFundamentals() { return []; }
    getIntradayIndicators() { return []; }
}

const CANDLE_DATA = {
    rsi: 48, ema20: 110, ema50: 100, close: 120000, volume: 2000000,
    vol_ma20: 500000, price_change_pct: 1.5, bb_upper: 125, bb_lower: 105,
    atr: 2000, macd: 1.5, signal: 1.0, obv: 1500, bb_position: 0.5,
    bb_squeeze: false, ema100: 95, ema20_minus_ema50: 10,
    macd_histogram: 0.5, c: 120000, h: 121000, l: 119000, o: 119500,
    mfi: 55, stoch_k: 60, stoch_d: 55, vwap: 119500,
};
const FUNDAMENTALS = { pe: 12, pb: 1.5, roe: 18, eps_growth: 15 };

/** Mock screener that returns canned data without DB */
const mockScreener = {
    getSymbolInfo: async (symbol) => ({
        daily: { ...CANDLE_DATA },
        fundamentals: { ...FUNDAMENTALS },
        dailyDate: '2026-07-17',
    }),
};

/** Mock scorer that scores without DB */
const mockScorer = {
    scoreCandle: (candle, fundamentals) => ({
        total: 75,
        breakdown: { technical: 30, volume: 15, momentum: 15, fundamental: 15 },
    }),
    scoreAll: async () => [
        { symbol: 'FPT', score: 75, breakdown: { technical: 30, volume: 15, momentum: 15, fundamental: 15 } },
        { symbol: 'VNM', score: 60, breakdown: { technical: 25, volume: 15, momentum: 10, fundamental: 10 } },
    ],
};

/** Mock detector that returns canned signals */
const mockDetector = {
    getSignals: () => [
        { type: 'RSI_OVERSOLD', direction: 'bullish', strength: 0.5, message: 'RSI oversold bounce' },
    ],
    getSignalsGrouped: (signals) => ({ momentum: signals }),
};

const { Analyst } = require('./analyst');

describe('Analyst', () => {
    it('should construct', () => {
        const analyst = new Analyst({ llm: new FakeStockLLM() });
        assert.ok(analyst);
        assert.ok(analyst.llm);
    });

    it('analyzeSymbol should return structured result', async () => {
        const fake = new FakeStockLLM();
        const analyst = new Analyst({
            llm: fake,
            screener: mockScreener,
            scorer: mockScorer,
            detector: mockDetector,
        });
        const result = await analyst.analyzeSymbol('FPT');
        assert.strictEqual(result.symbol, 'FPT');
        assert.strictEqual(result.recommendation, 'MUA');
        assert.strictEqual(result.score, 75);
        assert.ok(Array.isArray(result.signals));
        assert.ok(result.breakdown);
        assert.ok(fake.calls.length >= 1);
    });

    it('compareSymbols should compare and pick top', async () => {
        const analyst = new Analyst({
            llm: new FakeStockLLM(),
            screener: mockScreener,
            scorer: mockScorer,
            detector: mockDetector,
        });
        const result = await analyst.compareSymbols(['FPT', 'VNM']);
        assert.ok(result.comparison);
        assert.ok(result.topPick);
    });

    it('analyzeMarket should return market overview', async () => {
        const analyst = new Analyst({
            llm: new FakeStockLLM(),
            scorer: mockScorer,
        });
        const result = await analyst.analyzeMarket();
        assert.ok(result.marketSummary);
        assert.ok(result.sentiment);
        assert.ok(result.topStocks);
    });

    it('deepDiveStrategy should return entry/exit plan', async () => {
        const analyst = new Analyst({
            llm: new FakeStockLLM(),
            screener: mockScreener,
        });
        const result = await analyst.deepDiveStrategy('FPT', '1D');
        assert.ok(result.strategy);
        assert.ok(result.entry != null);
        assert.ok(result.stopLoss != null);
    });

    it('portfolioReview should return holdings review', async () => {
        const analyst = new Analyst({
            llm: new FakeStockLLM(),
            screener: mockScreener,
            scorer: mockScorer,
            detector: mockDetector,
        });
        const result = await analyst.portfolioReview([
            { symbol: 'FPT', shares: 100, avgPrice: 110000 },
            { symbol: 'VNM', shares: 50, avgPrice: 75000 },
        ]);
        assert.ok(result.holdings);
        assert.ok(result.overallAssessment);
    });

    it('analyzeSymbol should handle unknown symbol gracefully', async () => {
        const noopScreener = {
            getSymbolInfo: async () => ({ daily: null, intraday: null }),
        };
        const analyst = new Analyst({
            llm: new FakeStockLLM(),
            screener: noopScreener,
        });
        const result = await analyst.analyzeSymbol('ZZ_NONEXISTENT');
        assert.ok(result.error || result.recommendation);
    });
});
