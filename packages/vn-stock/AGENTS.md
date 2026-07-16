# @andy-toolforge/vn-stock — VN Stock Screener & Scanner

> Domain package for VN stock market screening and analysis. Reads from MongoDB (stock_db) — no direct API calls. Data is pre-fetched by the fetch team.

## Structure

```
packages/vn-stock/
  lib/
    index.js     — Entry: exports { StockDB, StockScreener, StockScorer, SignalDetector, IndicatorEngine, IndicatorEngineError }
    db.js        — StockDB  MongoDB connection & collection helpers
    screener.js  — StockScreener  Filter/screen stocks by technical conditions
    scorer.js    — StockScorer  Multi-factor scoring engine (technical, volume, momentum, fundamental)
    signals.js    — SignalDetector  Detect 17 technical signals (trend, momentum, volatility, volume, flow, price action)
    indicators.js — IndicatorEngine  Python subprocess bridge for technical indicator calculation
  skills/
    postinstall.js
    vn-stock-screener.md
  package.json   — deps: @andy-toolforge/core, mongodb
```

## Exports

| Class | File | Purpose |
|-------|------|---------|
| `StockDB` | `lib/db.js` | MongoDB connection, latest candle extraction, intraday/fundamentals queries |
| `StockScreener` | `lib/screener.js` | Filter stocks by indicator conditions, multi-timeframe screening |
| `StockScorer` | `lib/scorer.js` | Score stocks 0–100 across four factors (technical, volume, momentum, fundamental) |
| `SignalDetector` | `lib/signals.js` | Detect 17 technical signals (trend, momentum, volatility, volume, flow, price action) |
| `IndicatorEngine` | `lib/indicators.js` | Python subprocess bridge — compute 29 indicators via `vn-stock-indicators` CLI |
| `IndicatorEngineError` | `lib/indicators.js` | Error class with `code` property for Python/bridge error handling |
| `StockLLM` | `lib/llm.js` | LLM wrapper: quickChat (GenAIClient) + deepChat (LLMClient) |
| `Analyst` | `lib/analyst.js` | 5 analysis methods: analyzeSymbol, compareSymbols, analyzeMarket, deepDiveStrategy, portfolioReview |
| `RECOMMENDATIONS` | `lib/analyst.js` | `['MUA', 'BÁN', 'NẮM GIỮ', 'THEO DÕI']` |

## Usage

### Screening (StockScreener)

```javascript
const { StockScreener } = require('@andy-toolforge/vn-stock');
const screener = new StockScreener();

// Daily: RSI oversold + EMA uptrend
const results = await screener.screenDaily({
    filters: [
        { field: 'rsi', operator: 'lt', value: 30 },
        { field: 'ema20', operator: 'gt', compareToField: 'ema50' },
    ],
    sortBy: 'rsi',
    limit: 20,
});

// Intraday: 15m RSI oversold
const intraday = await screener.screenIntraday({
    filters: [{ field: 'rsi', operator: 'lt', value: 25 }],
    interval: '15m',
});

// Single symbol lookup
const info = await screener.getSymbolInfo('FPT');
console.log(info.daily?.rsi, info.fundamentals?.pe);
```

### Scoring (StockScorer)

```javascript
const { StockScorer } = require('@andy-toolforge/vn-stock');
const scorer = new StockScorer();

// Score all symbols (auto-ranked by total score)
const ranked = await scorer.scoreAll({ limit: 20 });

// Score all symbols on intraday 15m interval
const intradayRanked = await scorer.scoreAllIntraday({ interval: '15m', limit: 20 });

// Score a single symbol's intraday indicators
const fpt15m = await scorer.scoreIntraday('FPT', '15m');

// Score a single candle with custom weights
const result = scorer.scoreCandle(
    { rsi: 72, ema20: 110, ema50: 100, volume: 2e6, vol_ma20: 500000, price_change_pct: 3.5, obv: 1500 },
    { pe: 12, pb: 1.5, roe: 18 },
    { obv: 1300 } // prevCandle for OBV divergence detection
);
console.log(result.total, result.breakdown); // { total: 78.5, breakdown: { technical, volume, momentum, fundamental } }
```

### Signal Detection (SignalDetector)

```javascript
const { SignalDetector } = require('@andy-toolforge/vn-stock');
const detector = new SignalDetector();

// Check a single candle against all 16 detectors
const candle = { rsi: 25, ema20: 105, ema50: 100, macd: 1.5, signal: 1.0, ... };
const prevCandle = { ema20: 98, ema50: 100, macd: 0.8, signal: 1.0, ... };

const signals = detector.getSignals(candle, prevCandle);
// → [{ type: 'EMA_CROSSOVER', direction: 'bullish', strength: 0.85, message: '...' },
//     { type: 'RSI_OVERSOLD', direction: 'bullish', strength: 0.5, message: '...' }]

const grouped = detector.getSignalsGrouped(candle, prevCandle);
// → { trend: [...], momentum: [...], volatility: [...], volume: [...], flow: [...], priceAction: [...] }

// Custom thresholds
const custom = new SignalDetector({
    rsi: { oversold: 25, overbought: 75 },
    volume: { spikeRatio: 3.0 },
});
```

### Indicator Calculation (IndicatorEngine)

```javascript
const { IndicatorEngine } = require('@andy-toolforge/vn-stock');
const engine = new IndicatorEngine();

// Spawn mode (one-off calculation)
const result = await engine.compute({
    indicators: ['sma', 'ema', 'rsi', 'macd', 'bbands'],
    ohlcv: { open: [...], high: [...], low: [...], close: [...], volume: [...] },
    params: { sma: [20, 50], ema: [20], rsi: [14] },
});
// → { sma: {...}, ema: {...}, rsi: {...}, macd: {...}, bbands: {...} }

// Pool mode (reuse Python process for multiple calls)
const pool = new IndicatorEngine({ mode: 'pool', pythonPath: 'uv' });
await pool.connect();
const r1 = await pool.compute({ indicators: ['sma'], ohlcv: {...}, params: { sma: [20] } });
const r2 = await pool.compute({ indicators: ['rsi'], ohlcv: {...}, params: { rsi: [14] } });
await pool.disconnect();

// Fetch from MongoDB + compute
const mongo = new IndicatorEngine({ mongoUri: 'mongodb://localhost:27017' });
const fromDb = await mongo.fetchAndCompute({
    symbol: 'FPT', source: 'daily',
    indicators: ['sma', 'ema', 'rsi'],
    params: { sma: [20, 50], ema: [20], rsi: [14] },
});
```

### AI Analysis (Analyst)

```javascript
const { Analyst } = require('@andy-toolforge/vn-stock');
const analyst = new Analyst();

// Analyze a single symbol
const result = await analyst.analyzeSymbol('FPT');
console.log(result.recommendation, result.score, result.reasoning);

// Compare multiple symbols
const cmp = await analyst.compareSymbols(['FPT', 'VNM', 'HPG']);
console.log('Top pick:', cmp.topPick.symbol);

// Market overview
const market = await analyst.analyzeMarket();
console.log(market.sentiment, market.marketSummary);

// Deep dive strategy
const strat = await analyst.deepDiveStrategy('FPT', '1D');
console.log('Entry:', strat.entry, 'SL:', strat.stopLoss, 'R/R:', strat.riskReward);

// Portfolio review
const portfolio = await analyst.portfolioReview([
    { symbol: 'FPT', shares: 100, avgPrice: 110000 },
    { symbol: 'VNM', shares: 50, avgPrice: 75000 },
]);
console.log(portfolio.overallAssessment, portfolio.riskLevel);
```

## Scoring Factors

| Factor | Weight | Indicators |
|--------|--------|------------|
| **Technical** | 40% | RSI (30%), EMA20/50/100 alignment (40%), MACD cross + histogram (30%), Bollinger position + squeeze (bonus), ATR volatility (bonus) |
| **Volume** | 20% | Volume vs vol_ma20 ratio (4 thresholds), OBV divergence (price vs OBV direction) |
| **Momentum** | 20% | Price change % (5 thresholds), MFI (4 zones), Stochastic crossover, VWAP distance |
| **Fundamental** | 20% | PE (5 zones), PB (5 zones), ROE (5 zones), EPS growth (5 zones); defaults to 50 if no data |

Custom weights: `new StockScorer({ weights: { technical: 0.5, volume: 0.3, momentum: 0.2, fundamental: 0 } })`

## Filter Operators

| Operator | Description |
|----------|-------------|
| `gt` | Field > Value (or field1 > field2 if compareToField) |
| `gte` | >= |
| `lt` | < |
| `lte` | <= |
| `eq` | === |
| `neq` | !== |
| `crossAbove` | Crosses above (field > compareToField, was <=) |
| `crossBelow` | Crosses below (field < compareToField, was >=) |

## MCP Tools

Registered automatically by `@andy-toolforge/mcp` discovery mechanism:

| Tool | Description |
|------|-------------|
| `toolforge_vn_stock_screen` | Screen stocks by filter conditions (daily) |
| `toolforge_vn_stock_info` | Get full symbol info (daily + intraday + fundamentals) |
| `toolforge_vn_stock_score` | Rank all stocks by daily multi-factor score (0-100) |
| `toolforge_vn_stock_score_intraday` | Rank all stocks by intraday multi-factor score (no fundamental) |
| `toolforge_vn_stock_analyze` | AI analysis of a symbol — recommendation, score, reasoning |
| `toolforge_vn_stock_deep_dive` | Deep dive strategy — entry/exit, SL, support/resistance, R/R |
| `toolforge_vn_stock_compare` | Compare multiple symbols — ranking, top pick, AI summary |

## Testing

```bash
npm test -w @andy-toolforge/vn-stock
```
