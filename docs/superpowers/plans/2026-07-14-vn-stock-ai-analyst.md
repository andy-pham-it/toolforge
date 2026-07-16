# @andy-toolforge/vn-stock AI Analyst Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered stock analysis module (StockLLM + Analyst) with 3 MCP tools

**Architecture:** StockLLM wraps two LLM providers (GenAIClient for quickChat, core LLMClient for deepChat). Analyst uses StockLLM + existing StockDB/StockScreener/StockScorer/SignalDetector to produce structured analysis with buy/sell/hold recommendations. MCP tools auto-registered via mcp-tools.js discovery.

**Tech Stack:** CommonJS, @andy-toolforge/genai-tools (GenAIClient), @andy-toolforge/core (LLMClient), MongoDB (StockDB)

## Global Constraints

- CommonJS (`require()` / `module.exports`) — no ESM
- Stateless pure functions for LLM calls (no class-level conversation history)
- GenAIClient requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` env var
- LLMClient requires `GROQ_API_KEY` env var for Groq provider
- Skill file saved under `packages/vn-stock/skills/` with prefix `vn-stock-`
- MCP tools auto-registered via `packages/vn-stock/mcp-tools.js` (no changes to `packages/mcp`)
- All methods handle missing data / API failures gracefully (return null/error message, never crash)

---

### Task 1: Add dep + create StockLLM (lib/llm.js)

**Files:**
- Modify: `packages/vn-stock/package.json`
- Create: `packages/vn-stock/lib/llm.js`
- Test: `packages/vn-stock/lib/llm.test.js`

**Interfaces:**
- Consumes: `GenAIClient` from `@andy-toolforge/genai-tools`, `LLMClient` from `@andy-toolforge/core`
- Produces: `class StockLLM { quickChat(systemPrompt, userContent), deepChat(systemPrompt, userContent) }`

- [ ] **Step 1: Add genai-tools dependency**

Edit `packages/vn-stock/package.json` — add to `dependencies`:
```json
"@andy-toolforge/genai-tools": "^0.1.0"
```

- [ ] **Step 2: Write failing test for StockLLM**

Create `packages/vn-stock/lib/llm.test.js`:
```javascript
const { describe, it, mock } = require('node:test');
const assert = require('node:assert');

mock.module('@andy-toolforge/genai-tools', {
    namedExports: {
        GenAIClient: class {
            constructor() { this.calls = []; }
            async generateContent({ model, prompt }) {
                this.calls.push({ model, prompt });
                return { text: `Mock quick reply: ${prompt.slice(0, 20)}`, raw: {} };
            }
        }
    }
});

mock.module('@andy-toolforge/core', {
    namedExports: {
        LLMClient: class {
            constructor(config) { this.config = config; this.calls = []; }
            async chat(systemPrompt, userPrompt, jsonMode) {
                this.calls.push({ systemPrompt, userPrompt, jsonMode });
                return `Mock deep reply: ${userPrompt.slice(0, 20)}`;
            }
        }
    }
});

const { StockLLM } = require('./llm');

describe('StockLLM', () => {
    it('should construct without apiKey (uses env)', () => {
        const llm = new StockLLM();
        assert.ok(llm);
        assert.ok(llm._quick);
        assert.ok(llm._deep);
    });

    it('quickChat should call GenAIClient.generateContent', async () => {
        const llm = new StockLLM();
        const result = await llm.quickChat('You are a stock analyst', 'Analyze FPT stock');
        assert.ok(result.includes('Mock quick reply'));
        const call = llm._quick.calls[0];
        assert.ok(call.model.includes('flash'));
    });

    it('deepChat should call LLMClient.chat', async () => {
        const llm = new StockLLM();
        const result = await llm.deepChat('You are a deep analyst', 'Deep dive FPT');
        assert.ok(result.includes('Mock deep reply'));
        assert.strictEqual(llm._deep.config.provider, 'gemini');
    });

    it('deepChat should accept Groq provider option', () => {
        const llm = new StockLLM({ deepProvider: 'groq' });
        assert.strictEqual(llm._deep.config.provider, 'groq');
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test packages/vn-stock/lib/llm.test.js`
Expected: FAIL with `MODULE_NOT_FOUND` or similar

- [ ] **Step 4: Create StockLLM implementation**

Create `packages/vn-stock/lib/llm.js`:
```javascript
const { GenAIClient } = require('@andy-toolforge/genai-tools');
const { LLMClient } = require('@andy-toolforge/core');

class StockLLM {
    constructor(config = {}) {
        this._quick = new GenAIClient(config.genaiKey);
        this._deep = new LLMClient({
            provider: config.deepProvider || 'gemini',
            apiKey: config.deepApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
            model: config.deepModel || 'gemini-2.5-flash',
        });
    }

    /**
     * Quick chat — lightweight response via GenAIClient (gemini-3.1-flash-lite).
     * @param {string} systemPrompt
     * @param {string} userContent
     * @returns {Promise<string>}
     */
    async quickChat(systemPrompt, userContent) {
        const prompt = `${systemPrompt}\n\n${userContent}`;
        const { text } = await this._quick.generateContent({
            model: 'gemini-3.1-flash-lite',
            prompt,
        });
        return text;
    }

    /**
     * Deep chat — full LLM response via core LLMClient (Google → Groq fallback).
     * @param {string} systemPrompt
     * @param {string} userContent
     * @returns {Promise<string>}
     */
    async deepChat(systemPrompt, userContent) {
        return this._deep.chat(systemPrompt, userContent);
    }
}

module.exports = { StockLLM };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test packages/vn-stock/lib/llm.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/vn-stock/package.json packages/vn-stock/lib/llm.js packages/vn-stock/lib/llm.test.js
git commit -m "feat(vn-stock): add StockLLM with quickChat/deepChat"
```

---

### Task 2: Create Analyst (lib/analyst.js)

**Files:**
- Create: `packages/vn-stock/lib/analyst.js`
- Test: `packages/vn-stock/lib/analyst.test.js`

**Interfaces:**
- Consumes: `StockLLM`, `StockScreener`, `StockScorer`, `SignalDetector`, `StockDB` (all from same package)
- Produces: `class Analyst { analyzeSymbol(symbol), compareSymbols(symbols), analyzeMarket(), deepDiveStrategy(symbol, timeframe), portfolioReview(holdings) }`

- [ ] **Step 1: Write failing test**

Create `packages/vn-stock/lib/analyst.test.js`:
```javascript
const { describe, it, before, mock } = require('node:test');
const assert = require('node:assert');
const { StockDB } = require('./db');
const { StockScreener } = require('./screener');
const { StockScorer } = require('./scorer');
const { SignalDetector } = require('./signals');

// Mock StockLLM
mock.module('./llm', {
    namedExports: {
        StockLLM: class {
            async quickChat(systemPrompt, userContent) {
                return JSON.stringify({
                    recommendation: 'MUA',
                    reasoning: 'Strong technical signals',
                    risks: ['Market volatility'],
                    score: 75,
                });
            }
            async deepChat(systemPrompt, userContent) {
                return JSON.stringify({
                    strategy: 'Buy on pullback to MA20',
                    entry: 120000,
                    stopLoss: 115000,
                    support: [118000, 115000],
                    resistance: [125000, 130000],
                    reasoning: 'Strong uptrend with accumulation',
                });
            }
        }
    }
});

const { Analyst } = require('./analyst');

describe('Analyst', () => {
    it('should construct', () => {
        const analyst = new Analyst();
        assert.ok(analyst);
        assert.ok(analyst.llm);
    });

    it('analyzeSymbol should return structured result', async () => {
        const analyst = new Analyst();
        const result = await analyst.analyzeSymbol('FPT');
        assert.ok(result.symbol, 'FPT');
        assert.ok(['MUA', 'BÁN', 'NẮM GIỮ', 'THEO DÕI'].includes(result.recommendation));
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.ok(Array.isArray(result.signals));
    });

    it('compareSymbols should compare and pick top', async () => {
        const analyst = new Analyst();
        const result = await analyst.compareSymbols(['FPT', 'VNM']);
        assert.ok(result.comparison);
        assert.ok(result.topPick);
    });

    it('analyzeMarket should return market overview', async () => {
        const analyst = new Analyst();
        const result = await analyst.analyzeMarket();
        assert.ok(result.marketSummary);
    });

    it('deepDiveStrategy should return entry/exit plan', async () => {
        const analyst = new Analyst();
        const result = await analyst.deepDiveStrategy('FPT', '1D');
        assert.ok(result.strategy);
        assert.ok(result.entry != null);
        assert.ok(result.stopLoss != null);
    });

    it('portfolioReview should return holdings review', async () => {
        const analyst = new Analyst();
        const result = await analyst.portfolioReview([
            { symbol: 'FPT', shares: 100, avgPrice: 110000 },
            { symbol: 'VNM', shares: 50, avgPrice: 75000 },
        ]);
        assert.ok(result.holdings);
        assert.ok(result.overallAssessment);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/vn-stock/lib/analyst.test.js`
Expected: FAIL with MODULE_NOT_FOUND

- [ ] **Step 3: Create Analyst implementation**

Create `packages/vn-stock/lib/analyst.js`:
```javascript
const { StockLLM } = require('./llm');
const { StockDB } = require('./db');
const { StockScreener } = require('./screener');
const { StockScorer } = require('./scorer');
const { SignalDetector } = require('./signals');

const RECOMMENDATIONS = ['MUA', 'BÁN', 'NẮM GIỮ', 'THEO DÕI'];

class Analyst {
    constructor(config = {}) {
        this.llm = new StockLLM(config);
    }

    /**
     * Analyze a single stock symbol.
     * @param {string} symbol
     * @returns {Promise<object>} { symbol, signals, score, recommendation, analysis, risks }
     */
    async analyzeSymbol(symbol) {
        const db = new StockDB();
        try {
            await db.connect();
            const screener = new StockScreener();
            const info = await screener.getSymbolInfo(symbol);
            if (!info.daily && !info.intraday) {
                return { symbol, error: `No data for ${symbol}`, recommendation: 'THEO DÕI' };
            }

            // Score
            const scorer = new StockScorer();
            const scoreResult = scorer.scoreCandle(
                info.daily || info.intraday,
                info.fundamentals,
                null
            );

            // Signals
            const detector = new SignalDetector();
            const dailySignals = info.daily ? detector.getSignals(info.daily, null) : [];
            const groupedSignals = detector.getSignalsGrouped(dailySignals);

            // AI summary
            const systemPrompt = 'Bạn là chuyên gia phân tích chứng khoán Việt Nam. Phân tích mã cổ phiếu dựa trên dữ liệu kỹ thuật và cơ bản. Trả về JSON với các trường: recommendation (MUA|BÁN|NẮM GIỮ|THEO DÕI), reasoning, risks (array).';
            const userContent = JSON.stringify({
                symbol,
                score: scoreResult.total,
                breakdown: scoreResult.breakdown,
                signals: dailySignals,
                fundamentals: info.fundamentals,
            });

            let analysis;
            try {
                const raw = await this.llm.quickChat(systemPrompt, userContent);
                analysis = JSON.parse(raw);
            } catch {
                analysis = { recommendation: this._fallbackRecommendation(scoreResult.total), reasoning: 'Based on technical analysis only', risks: [] };
            }

            if (!RECOMMENDATIONS.includes(analysis.recommendation)) {
                analysis.recommendation = this._fallbackRecommendation(scoreResult.total);
            }

            return {
                symbol,
                date: info.dailyDate || info.intraday?.date,
                score: scoreResult.total,
                breakdown: scoreResult.breakdown,
                signals: dailySignals,
                signalsGrouped: groupedSignals,
                recommendation: analysis.recommendation,
                reasoning: analysis.reasoning || '',
                risks: analysis.risks || [],
                fundamentals: info.fundamentals,
            };
        } finally {
            await db.close();
        }
    }

    /**
     * Compare multiple symbols.
     * @param {string[]} symbols
     * @returns {Promise<object>} { comparison, topPick }
     */
    async compareSymbols(symbols) {
        const results = await Promise.allSettled(
            symbols.map(s => this.analyzeSymbol(s))
        );
        const analyzed = results
            .filter(r => r.status === 'fulfilled' && r.value && !r.value.error)
            .map(r => r.value)
            .sort((a, b) => b.score - a.score);

        const topPick = analyzed[0] || null;
        const systemPrompt = 'Bạn là chuyên gia phân tích. So sánh các mã sau và chọn mã tốt nhất. Trả về JSON với: summary, reasoning.';
        const userContent = JSON.stringify(analyzed.map(a => ({
            symbol: a.symbol, score: a.score, recommendation: a.recommendation,
        })));

        let aiComparison;
        try {
            const raw = await this.llm.quickChat(systemPrompt, userContent);
            aiComparison = JSON.parse(raw);
        } catch {
            aiComparison = { summary: 'Comparison based on technical scores', reasoning: '' };
        }

        return {
            comparison: analyzed,
            topPick,
            aiSummary: aiComparison.summary || '',
            reasoning: aiComparison.reasoning || '',
        };
    }

    /**
     * Analyze overall market conditions.
     * @returns {Promise<object>} { marketSummary, topGainers, recommendations }
     */
    async analyzeMarket() {
        const screener = new StockScreener();
        const scorer = new StockScorer();
        try {
            const scored = await scorer.scoreAll({ limit: 20 });
            const bullish = scored.filter(s => s.score >= 60);
            const bearish = scored.filter(s => s.score <= 40);

            const systemPrompt = 'Bạn là chuyên gia phân tích thị trường chứng khoán Việt Nam. Dựa vào dữ liệu điểm số kỹ thuật, hãy nhận xét tổng quan thị trường. Trả về JSON: marketSummary, sentiment (Tích cực|Trung tính|Tiêu cực), notableStocks, advice.';
            const userContent = JSON.stringify({
                totalAnalyzed: scored.length,
                bullishCount: bullish.length,
                bearishCount: bearish.length,
                top5: scored.slice(0, 5),
            });

            let analysis;
            try {
                const raw = await this.llm.quickChat(systemPrompt, userContent);
                analysis = JSON.parse(raw);
            } catch {
                analysis = { marketSummary: 'Market analysis based on technical scores', sentiment: 'Trung tính', notableStocks: [], advice: '' };
            }

            return {
                marketSummary: analysis.marketSummary || '',
                sentiment: analysis.sentiment || 'Trung tính',
                topStocks: scored.slice(0, 10),
                notableStocks: analysis.notableStocks || [],
                advice: analysis.advice || '',
                bullishCount: bullish.length,
                bearishCount: bearish.length,
            };
        } finally {
            await screener.close();
        }
    }

    /**
     * Deep dive strategy analysis.
     * @param {string} symbol
     * @param {string} timeframe
     * @returns {Promise<object>} { strategy, entry, stopLoss, support, resistance, reasoning }
     */
    async deepDiveStrategy(symbol, timeframe = '1D') {
        const screener = new StockScreener();
        try {
            const info = await screener.getSymbolInfo(symbol);
            if (!info.daily && !info.intraday) {
                return { symbol, error: `No data for ${symbol}` };
            }

            const candle = info.daily || info.intraday;
            const systemPrompt = 'Bạn là chuyên gia phân tích kỹ thuật chứng khoán. Đưa ra chiến lược giao dịch cụ thể. Trả về JSON: strategy, entry (number), stopLoss (number), support (number[]), resistance (number[]), reasoning, riskReward (number).';
            const userContent = JSON.stringify({
                symbol,
                timeframe,
                currentPrice: candle.close || candle.price,
                rsi: candle.rsi,
                ema20: candle.ema20,
                ema50: candle.ema50,
                bb_upper: candle.bb_upper,
                bb_lower: candle.bb_lower,
                atr: candle.atr,
            });

            let analysis;
            try {
                const raw = await this.llm.deepChat(systemPrompt, userContent);
                analysis = JSON.parse(raw);
            } catch {
                const price = candle.close || candle.price || 0;
                analysis = {
                    strategy: 'Unable to generate deep analysis',
                    entry: price,
                    stopLoss: price * 0.95,
                    support: [price * 0.95, price * 0.90],
                    resistance: [price * 1.05, price * 1.10],
                    reasoning: 'Based on current price levels',
                    riskReward: 2,
                };
            }

            return {
                symbol,
                timeframe,
                strategy: analysis.strategy || '',
                entry: analysis.entry,
                stopLoss: analysis.stopLoss,
                support: analysis.support || [],
                resistance: analysis.resistance || [],
                reasoning: analysis.reasoning || '',
                riskReward: analysis.riskReward || 1,
            };
        } finally {
            await screener.close();
        }
    }

    /**
     * Review a portfolio of holdings.
     * @param {Array<{symbol:string, shares:number, avgPrice:number}>} holdings
     * @returns {Promise<object>} { holdings, overallAssessment }
     */
    async portfolioReview(holdings) {
        const analyzed = [];
        for (const h of holdings) {
            try {
                const analysis = await this.analyzeSymbol(h.symbol);
                const currentPrice = 0; // Price would come from StockDB
                analyzed.push({
                    symbol: h.symbol,
                    shares: h.shares,
                    avgPrice: h.avgPrice,
                    currentPrice,
                    pnl: currentPrice ? (currentPrice - h.avgPrice) * h.shares : null,
                    recommendation: analysis.recommendation,
                    score: analysis.score,
                });
            } catch {
                analyzed.push({ symbol: h.symbol, shares: h.shares, avgPrice: h.avgPrice, error: 'Analysis failed' });
            }
        }

        const systemPrompt = 'Bạn là chuyên gia tư vấn đầu tư. Đánh giá danh mục đầu tư dựa trên phân tích từng mã. Trả về JSON: overallAssessment, concerns (array), suggestions (array), riskLevel (Cao|Trung bình|Thấp).';
        const userContent = JSON.stringify(analyzed.map(a => ({
            symbol: a.symbol, recommendation: a.recommendation, score: a.score,
        })));

        let assessment;
        try {
            const raw = await this.llm.quickChat(systemPrompt, userContent);
            assessment = JSON.parse(raw);
        } catch {
            assessment = { overallAssessment: 'Portfolio review based on technical analysis', concerns: [], suggestions: [], riskLevel: 'Trung bình' };
        }

        return {
            holdings: analyzed,
            overallAssessment: assessment.overallAssessment || '',
            concerns: assessment.concerns || [],
            suggestions: assessment.suggestions || [],
            riskLevel: assessment.riskLevel || 'Trung bình',
            totalValue: analyzed.reduce((sum, h) => sum + (h.currentPrice || 0) * h.shares, 0),
        };
    }

    _fallbackRecommendation(score) {
        if (score >= 70) return 'MUA';
        if (score >= 55) return 'THEO DÕI';
        if (score >= 40) return 'NẮM GIỮ';
        return 'BÁN';
    }
}

module.exports = { Analyst, RECOMMENDATIONS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/vn-stock/lib/analyst.test.js`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/vn-stock/lib/analyst.js packages/vn-stock/lib/analyst.test.js
git commit -m "feat(vn-stock): add Analyst with 5 analysis methods"
```

---

### Task 3: Create vn-stock-analyst skill file

**Files:**
- Create: `packages/vn-stock/skills/vn-stock-analyst.md`

- [ ] **Step 1: Create skill file**

Create `packages/vn-stock/skills/vn-stock-analyst.md`:
```markdown
# VN Stock Analyst — AI-Powered Stock Analysis

> Skill file for AI agents doing stock analysis via @andy-toolforge/vn-stock.

## Available Methods

### `analyzeSymbol(symbol)`
Phân tích 1 mã cổ phiếu. Trả về: signals, score (0-100), recommendation (MUA/BÁN/NẮM GIỮ/THEO DÕI), reasoning, risks.

### `compareSymbols(symbols)`
So sánh nhiều mã cổ phiếu. Xếp hạng theo score, trả về topPick với AI summary.

### `analyzeMarket()`
Tổng quan thị trường. Điểm số trung bình, số mã tăng/giảm, top 10 mã tốt nhất, nhận xét từ AI.

### `deepDiveStrategy(symbol, timeframe)`
Phân tích sâu 1 mã: chiến lược entry/exit, stop-loss, support/resistance, risk/reward. Dùng deepChat (model mạnh hơn).

### `portfolioReview(holdings)`
Đánh giá danh mục đầu tư. Phân tích từng mã, tổng quan rủi ro, gợi ý tái cân bằng.

## Workflow Examples

**Phân tích nhanh 1 mã:**
```
const { Analyst } = require('@andy-toolforge/vn-stock');
const analyst = new Analyst();
const result = await analyst.analyzeSymbol('FPT');
console.log(result.recommendation, result.reasoning);
```

**So sánh và chọn top pick:**
```
const result = await analyst.compareSymbols(['FPT', 'HPG', 'VNM']);
console.log('Top pick:', result.topPick.symbol);
```

**Deep dive với chiến lược:**
```
const strategy = await analyst.deepDiveStrategy('FPT', '1D');
console.log('Entry:', strategy.entry, 'SL:', strategy.stopLoss);
```

## Notes
- StockLLM cần `GEMINI_API_KEY` hoặc `GOOGLE_API_KEY` env var
- `deepDiveStrategy` dùng deepChat (LLMClient) — cần provider key tương ứng
- Nếu AI call fail, analyst fallback về technical-score-based recommendation
```

- [ ] **Step 2: Commit**

```bash
git add packages/vn-stock/skills/vn-stock-analyst.md
git commit -m "docs(vn-stock): add vn-stock-analyst skill file"
```

---

### Task 4: Add 3 MCP tools to mcp-tools.js

**Files:**
- Modify: `packages/vn-stock/mcp-tools.js`

- [ ] **Step 1: Write failing test for MCP tools**

Append tests to `packages/vn-stock/lib/mcp-tools.test.js` (new file):
```javascript
const { describe, it, before, mock } = require('node:test');
const assert = require('node:assert');

// Mock Analyst
mock.module('./analyst', {
    namedExports: {
        Analyst: class {
            async analyzeSymbol(symbol) {
                return { symbol, recommendation: 'MUA', score: 75, signals: ['rsi_oversold'], analysis: 'Strong' };
            }
            async compareSymbols(symbols) {
                return { comparison: [{ symbol: 'FPT', score: 75 }], topPick: { symbol: 'FPT' } };
            }
            async analyzeMarket() {
                return { marketSummary: 'Bullish market', sentiment: 'Tích cực', topStocks: [] };
            }
            async deepDiveStrategy(symbol) {
                return { symbol, strategy: 'Buy dip', entry: 120000, stopLoss: 115000 };
            }
            async portfolioReview() {
                return { holdings: [], overallAssessment: 'Good' };
            }
        }
    }
});

const pluginFn = require('../mcp-tools');

describe('vn-stock MCP tools', () => {
    let tools;

    before(() => {
        tools = pluginFn();
    });

    it('should export array of tools', () => {
        assert.ok(Array.isArray(tools));
        assert.ok(tools.length >= 7); // 4 existing + 3 new
    });

    it('should have analyze tool', () => {
        const analyze = tools.find(t => t.definition.name === 'toolforge_vn_stock_analyze');
        assert.ok(analyze, 'analyze tool missing');
        assert.ok(analyze.handler);
    });

    it('should have deep_dive tool', () => {
        const deep = tools.find(t => t.definition.name === 'toolforge_vn_stock_deep_dive');
        assert.ok(deep, 'deep_dive tool missing');
    });

    it('should have compare tool', () => {
        const compare = tools.find(t => t.definition.name === 'toolforge_vn_stock_compare');
        assert.ok(compare, 'compare tool missing');
    });

    it('analyze handler should return stock analysis', async () => {
        const analyze = tools.find(t => t.definition.name === 'toolforge_vn_stock_analyze');
        const result = await analyze.handler(null, { symbol: 'FPT', timeframe: '1D' });
        assert.ok(result.symbol);
        assert.ok(result.recommendation);
    });

    it('compare handler should compare symbols', async () => {
        const compare = tools.find(t => t.definition.name === 'toolforge_vn_stock_compare');
        const result = await compare.handler(null, { symbols: ['FPT', 'VNM'], timeframe: '1D' });
        assert.ok(result.topPick);
    });
});
```

- [ ] **Step 2: Add 3 new MCP tools to mcp-tools.js**

Edit `packages/vn-stock/mcp-tools.js`:

Add requires at top:
```javascript
const { Analyst } = require('./lib/analyst');
```

Add after `scoreIntradayDefinition`:
```javascript
const analyzeDefinition = {
    name: 'toolforge_vn_stock_analyze',
    description: 'Analyze a VN stock symbol — technical signals, AI score, recommendation (MUA/BÁN/NẮM GIỮ/THEO DÕI)',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string', description: 'Stock symbol (e.g. FPT, VNM, HPG)' },
            timeframe: { type: 'string', enum: ['1D', '1h', '15m'], description: 'Analysis timeframe', default: '1D' },
        },
        required: ['symbol'],
    },
};

const deepDiveDefinition = {
    name: 'toolforge_vn_stock_deep_dive',
    description: 'Deep dive strategy for a VN stock — entry/exit, stop-loss, support/resistance, risk/reward',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string', description: 'Stock symbol (e.g. FPT, VNM, HPG)' },
            timeframe: { type: 'string', enum: ['1D', '1h', '15m'], description: 'Analysis timeframe', default: '1D' },
        },
        required: ['symbol'],
    },
};

const compareDefinition = {
    name: 'toolforge_vn_stock_compare',
    description: 'Compare multiple VN stock symbols — ranking, top pick, AI summary',
    inputSchema: {
        type: 'object',
        properties: {
            symbols: { type: 'array', items: { type: 'string' }, description: 'Stock symbols to compare (e.g. ["FPT","VNM","HPG"])' },
            timeframe: { type: 'string', enum: ['1D', '1h', '15m'], description: 'Analysis timeframe', default: '1D' },
        },
        required: ['symbols'],
    },
};
```

Add handlers after `scoreIntradayHandler`:
```javascript
async function analyzeHandler(llm, args) {
    const analyst = new Analyst();
    return await analyst.analyzeSymbol(args.symbol);
}

async function deepDiveHandler(llm, args) {
    const analyst = new Analyst();
    return await analyst.deepDiveStrategy(args.symbol, args.timeframe || '1D');
}

async function compareHandler(llm, args) {
    const analyst = new Analyst();
    return await analyst.compareSymbols(args.symbols, args.timeframe || '1D');
}
```

Add to module.exports return array:
```javascript
{ definition: analyzeDefinition, handler: analyzeHandler },
{ definition: deepDiveDefinition, handler: deepDiveHandler },
{ definition: compareDefinition, handler: compareHandler },
```

- [ ] **Step 3: Run test to verify it passes**

Run: `node --test packages/vn-stock/lib/mcp-tools.test.js`
Expected: PASS (all 6 tests)

- [ ] **Step 4: Commit**

```bash
git add packages/vn-stock/mcp-tools.js packages/vn-stock/lib/mcp-tools.test.js
git commit -m "feat(vn-stock): add 3 MCP tools (analyze, deep_dive, compare)"
```

---

### Task 5: Wire into index.js + update AGENTS.md

**Files:**
- Modify: `packages/vn-stock/lib/index.js`
- Modify: `packages/vn-stock/AGENTS.md`

- [ ] **Step 1: Update index.js exports**

Edit `packages/vn-stock/lib/index.js`:
```javascript
const { StockLLM } = require('./llm');
const { Analyst, RECOMMENDATIONS } = require('./analyst');
```

Add to `module.exports`:
```javascript
StockLLM,
Analyst,
RECOMMENDATIONS,
```

- [ ] **Step 2: Update AGENTS.md**

Edit `packages/vn-stock/AGENTS.md`:

Add to exports table:
```
| `StockLLM` | `lib/llm.js` | LLM wrapper: quickChat (GenAIClient) + deepChat (LLMClient) |
| `Analyst` | `lib/analyst.js` | 5 analysis methods (analyzeSymbol, compareSymbols, analyzeMarket, deepDiveStrategy, portfolioReview) |
```

Add usage section for Analyst after existing Scorer section.

- [ ] **Step 3: Run existing tests**

Run: `npm test -w @andy-toolforge/vn-stock`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/vn-stock/lib/index.js packages/vn-stock/AGENTS.md
git commit -m "docs(vn-stock): wire StockLLM + Analyst into index.js, update AGENTS.md"
```

---

### Task 6: Run npm install + full suite verification

**Files:** (none)

- [ ] **Step 1: Run npm install to pick up new genai-tools dep**

Run: `npm install`
Expected: Success

- [ ] **Step 2: Run full test suite**

Run: `npm test -w @andy-toolforge/vn-stock`
Expected: All tests pass

- [ ] **Step 3: Verify MCP tools discoverability**

Run: `node -e "const fn = require('./packages/vn-stock/mcp-tools'); const tools = fn(); console.log(tools.map(t => t.definition.name).join('\n'))"`
Expected: Lists all 7 tools including `toolforge_vn_stock_analyze`, `toolforge_vn_stock_deep_dive`, `toolforge_vn_stock_compare`

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore(vn-stock): npm install / final wiring for AI Analyst"
```

---

### Task 7: Full suite verification

- [ ] **Step 1: Run all vn-stock tests**

Run: `node --test packages/vn-stock/lib/*.test.js`
Expected: All tests pass

- [ ] **Step 2: Run all package tests**

Run: `npm test --workspaces`
Expected: All workspace tests pass
