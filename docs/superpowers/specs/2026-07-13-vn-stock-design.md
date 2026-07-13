# @andy-toolforge/vn-stock Design Spec

> Package phân tích chứng khoán Việt Nam — kết hợp dữ liệu MongoDB + tín hiệu kỹ thuật + AI analysis.
> Brainstorming: Phase 2 của chiến lược Toolforge mở rộng.

## 1. Mục tiêu

- Xác định cổ phiếu tiềm năng dựa trên tín hiệu kỹ thuật (RSI, MACD, EMA, BB...), dòng tiền MCDX, và chỉ số cơ bản
- Đưa ra điểm mua/bán với xác nhận từ AI
- Hỗ trợ khung giao dịch 15m, 1H, 1D
- Tích hợp vào MCP server để dùng từ bất kỳ agent nào

## 2. Kiến trúc

### File structure

```
packages/vn-stock/
├── package.json
├── lib/
│   ├── index.js                # Export tất cả
│   ├── db.js                   # StockDB — MongoDB connection pool
│   ├── queries.js              # Query functions
│   ├── signals.js              # SignalDetector
│   ├── screener.js             # Screener
│   ├── scorer.js               # Scorer
│   ├── analyst.js              # Analyst
│   └── llm.js                  # StockLLM — provider routing
├── skills/
│   └── vn-stock-analyst.md     # Prompt template cho analyst
└── mcp-tools.js                # 4 MCP tools, auto-register via plugin
```

### Dependencies

```json
{
  "@andy-toolforge/core": "^1.0.0",
  "@andy-toolforge/genai-tools": "^0.1.0",
  "mongodb": "^6.0.0"
}
```

### Provider routing cho AI

| Tier | Model | Provider | Rate limit | Use case |
|---|---|---|---|---|
| Quick | gemma-4-9b-it | GenAIClient (genai-tools) | Free | Tóm tắt nhanh |
| Standard | gemini-3.1-flash-lite | GenAIClient (genai-tools) | 500+ rpd | Phân tích chi tiết |
| Deep | gemini-2.5-flash / Groq | core LLMClient | Theo API key | Strategy deep dive |

## 3. Data Layer

### `lib/db.js` — StockDB

```javascript
class StockDB {
  constructor(options = {})   // uri, dbName (default: stock_db)
  async connect()             // MongoClient.connect(srv)
  async getCollection(name)   // this.db.collection(name)
  async close()
}
```

### `lib/queries.js` — Query functions

| Function | Collection | Returns |
|---|---|---|
| `getCandles(symbol, timeframe, limit)` | stock_1d / stock_15m / stock_1h | OHLCV + indicators array |
| `getLatestCandle(symbol, timeframe)` | stock_1d / stock_15m / stock_1h | Candle gần nhất |
| `getAllLatestCandles(timeframe)` | stock_1d | 54 symbols, candle mới nhất |
| `getIntradayIndicators(symbol, interval)` | intraday_indicators | { indicators: {...} } |
| `getFundamentals(symbol)` | stock_fundamentals | P/E, P/B, ROE, industry... |
| `getAllFundamentals()` | stock_fundamentals | 54 symbols |
| `getStockBoard()` | stock_price_board | Bảng giá real-time |
| `getMarketState()` | market_state | Trạng thái thị trường |

### Data sources

- **stock_1d**: ✅ Đầy đủ indicators (EMA, RSI, MACD, BB, Stoch, OBV, VWAP, MFI, MCDX)
- **stock_15m / stock_1h**: ⚠️ OHLCV raw — cần chạy fetch script để compute indicators
- **intraday_indicators**: ⚠️ Thiếu stoch, BB, OBV, VWAP, MFI — cần bổ sung
- **stock_fundamentals**: ⚠️ Thiếu chi tiết tài chính (doanh thu, nợ/vốn) — optional

> Quest file chi tiết tại `_private/vn-stock-quest-fetch-db.md`

## 4. Analysis Engine

### `lib/signals.js` — SignalDetector

**Class interface:**
```javascript
class SignalDetector {
    constructor(config = {})
    // config thresholds (all optional):
    //   rsi: { oversold: 30, overbought: 70 }
    //   macd: { histogramThreshold: 0.1 }
    //   volume: { spikeRatio: 2.0 }
    //   bollinger: { squeezeThreshold: 1.5 }
    //   atr: { expansionRatio: 1.5 }
    //   pvsEma: { threshold: 2 } // Price vs EMA % threshold
    //   mcdx: { bankerThreshold: 20, speculatorThreshold: 15 }
    //   breakout: { pctThreshold: 2 } // % above/below range for breakout
    //   reversal: { minCandles: 2 }

    // Each detector returns signal | null (null = no signal = graceful degradation)
    detectEmaCrossover(candle, prevCandle)
    detectPriceVsEma(candle)
    detectMacdCrossover(candle, prevCandle)
    detectMacdDivergence(candle, prevCandle)
    detectRsi(candle)
    detectStochastic(candle)
    detectMfi(candle)
    detectBollinger(candle)
    detectAtrExpansion(candle, prevCandle)
    detectVolumeSpike(candle)
    detectObvDivergence(candle, prevCandle)
    detectVwapPosition(candle)
    detectMcdxFlow(candle)
    detectMcdxDivergence(candle, prevCandle)
    detectPriceBreakout(candle, prevCandle)
    detectPriceReversal(candle, prevCandle)

    // Composite — runs all detectors, returns non-null signals sorted by strength desc
    getSignals(candle, prevCandle = null)  // → signal[]
    // Optional: getSignalsGrouped(candle, prevCandle)  → { trend: [...], momentum: [...], ... }
}
```

**Signal output format:**
```javascript
{
  type: 'MACD_CROSSOVER',        // Unique signal identifier (SCREAMING_SNAKE)
  direction: 'bullish' | 'bearish' | 'neutral',
  strength: 0.0 - 1.0,          // 0.0 = weak, 1.0 = extreme
  message: 'MACD crossed above signal — bullish momentum',
  candle: { /* input candle reference */ },
  value: { /* indicator values at time of detection */ }
}
```

**17 detection methods — logic & strength:**

| Category | Method | Condition | Strength |
|---|---|---|---|
| **Trend** | `detectEmaCrossover` | EMA20 crosses above/below EMA50 (prev ≤ → > = bullish, prev ≥ → < = bearish) | 0.7 + 0.3 * min(gap%/5%, 1) |
| | `detectPriceVsEma` | Price > EMA20 by ≥ threshold% = bullish; < EMA20 by ≥ threshold% = bearish | abs(price/ema20-1) * 5 capped |
| | `detectMacdCrossover` | MACD crosses above/below signal line | 0.6 + 0.4 * min(histogram/0.5, 1) |
| | `detectMacdDivergence` | Price higher high but MACD lower high = bearish divergence; opposite = bullish | magnitude ratio comparison |
| **Momentum** | `detectRsi` | RSI < oversold (30) = bullish; RSI > overbought (70) = bearish | abs(rsi-50)/50 |
| | `detectStochastic` | %K < 20 + %K > %D = bullish oversold; %K > 80 + %K < %D = bearish | abs(k-50)/50 capped |
| | `detectMfi` | MFI < 20 = bullish; MFI > 80 = bearish | abs(mfi-50)/50 capped |
| **Volatility** | `detectBollinger` | Price ≤ bb_lower + 1% band = bullish squeeze; ≥ bb_upper - 1% = bearish | distance from band / bandwidth |
| | `detectAtrExpansion` | Current ATR > prev ATR × expansionRatio (1.5) | min(atr/(prev_atr*ratio), 1) |
| **Volume** | `detectVolumeSpike` | Volume > vol_ma20 × spikeRatio (2.0) | ratio/5 capped at 1.0 |
| | `detectObvDivergence` | Price direction opposite to OBV direction | magnitude delta ratio |
| | `detectVwapPosition` | Price > VWAP = bullish bias; < VWAP = bearish | abs(price/vwap-1) * 5 capped |
| **Flow** | `detectMcdxFlow` | MCDX banker flow ≥ bankerThreshold (20%) = accumulation; speculator ≥ speculatorThreshold (15%) = distribution | flow/50 capped |
| | `detectMcdxDivergence` | Price diverging from MCDX flow direction | divergence magnitude |
| **Price Action** | `detectPriceBreakout` | Price > prev high + breakout.pctThreshold% = bullish; < prev low - pctThreshold% = bearish | abs(change%)/5 capped |
| | `detectPriceReversal` | After N consecutive bearish candles, a bullish candle = reversal; vice versa | body ratio × recency factor |

**Edge cases (all methods handle gracefully):**
- Missing required field on candle → return `null` (no crash)
- `prevCandle` null for methods that need it → skip divergence/breakout/reversal detection
- Empty candle object → `getSignals` returns `[]`
- Threshold config validation — defaults applied per-method, missing values use defaults

### `lib/screener.js` — Screener

```javascript
class Screener {
  screen(filters)
  // filters: { rsi, macdCrossover, emaCrossover, volumeSpike,
  //            mcdxBanker, pe, pb, roe, industry, ... }

  screenTopMomentum(params)
  screenUndervalued(params)
  screenMcdxAccumulation()
  screenBreakoutCandidates()
}
```

**Output:** Array of `{ symbol, price, pct_change, signals, ta_signal, filters_matched, score }`

### `lib/scorer.js` — Scorer

| Component | Weight | Sub-scores |
|---|---|---|
| Technical | 40% | Trend 12%, Momentum 10%, Volatility 8%, Volume 10% |
| MCDX Flow | 35% | Banker 20%, Speculator 10%, Retail 5% |
| Fundamental | 25% | Valuation 10%, Growth 10%, Health 5% |

**Output:** `{ symbol, overall, technical, mcdx_flow, fundamental, signals_summary, strongest_signal }`

## 5. AI Analyst

### `lib/llm.js` — StockLLM

```javascript
class StockLLM {
  async quickChat(systemPrompt, userContent)  // GenAIClient (gemma-4-9b-it / gemini-3.1-flash-lite)
  async deepChat(systemPrompt, userContent)   // core LLMClient (Google → Groq fallback)
}
```

### `lib/analyst.js` — Analyst

| Method | Tier | Mô tả |
|---|---|---|
| `analyzeSymbol(symbol)` | Standard | Phân tích 1 mã: signals + score + AI summary + recommendation |
| `compareSymbols(symbols)` | Standard | So sánh nhiều mã, chọn top pick |
| `analyzeMarket()` | Standard | Tổng quan thị trường |
| `deepDiveStrategy(symbol, timeframe)` | Deep | Phân tích sâu: support/resistance, entry/exit/stop-loss |
| `portfolioReview(holdings)` | Deep | Review danh mục đầu tư |

**Recommendation:** `MUA | BÁN | NẮM GIỮ | THEO DÕI`

## 6. MCP Integration

### `mcp-tools.js`

Auto-registered via plugin architecture (`_loadPluginTools` in mcp-server.js). No changes to `packages/mcp` required.

| Tool | Input | Output |
|---|---|---|
| `vn_stock_screen` | `{ filters, limit }` | `{ results[], total, timestamp }` |
| `vn_stock_analyze` | `{ symbol, timeframe }` | `{ score, signals, analysis, recommendation }` |
| `vn_stock_deep_dive` | `{ symbol, timeframe }` | `{ strategy, entry, stoploss, support, resistance }` |
| `vn_stock_compare` | `{ symbols[], timeframe }` | `{ comparison, top_pick }` |

## 7. Skill File

`packages/vn-stock/skills/vn-stock-analyst.md` chứa prompt templates cho AI analyst. File được symlink/copy vào `.opencode/skills/` của client project với prefix `vn-stock-`.

## 8. Constraints

- **CommonJS** — không ESM
- **Phụ thuộc một chiều:** vn-stock → core, genai-tools. Không phụ thuộc chéo domain package
- **MCP plugin tự động** — không sửa packages/mcp
- **Data đọc từ MongoDB** — không gọi API trực tiếp từ package này
- **$STOCK_MONGO_URI** — biến môi trường bắt buộc để kết nối

## 9. Dữ liệu bổ sung (quest fetch DB)

Xem `_private/vn-stock-quest-fetch-db.md` — 4 scripts cần chạy ở dự án fetch DB:
1. **P0** Compute indicators cho stock_15m + stock_1h
2. **P0** Bổ sung intraday_indicators (thiếu stoch, BB, OBV, VWAP, MFI)
3. **P1** Báo cáo tài chính (stock_financials)
4. **P2** Tăng tần suất sync price board

## 10. Out of scope (v1)

- Web dashboard / UI
- Backtesting engine
- Real-time WebSocket streaming
- Order placement (chỉ phân tích)
- Tin tức / sentiment analysis
