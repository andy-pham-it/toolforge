# @andy-toolforge/vn-stock

[![npm](https://img.shields.io/npm/v/@andy-toolforge/vn-stock)](https://npmjs.com/package/@andy-toolforge/vn-stock)
[![License](https://img.shields.io/npm/l/@andy-toolforge/vn-stock)](https://github.com/andy-pham-it/toolforge)

**VN stock market screening, scoring, signal detection, and technical indicator calculation.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Sàng lọc cổ phiếu VN theo điều kiện kỹ thuật (RSI, EMA, MACD, volume...)
- Chấm điểm đa yếu tố (technical, volume, momentum, fundamental)
- Phát hiện tín hiệu giao dịch (17+ patterns: trend, momentum, volatility, price action)
- Tính toán chỉ báo kỹ thuật qua Python engine (29 indicators)
- Tích hợp MCP server cho AI agent

## Installation

```bash
npm install @andy-toolforge/vn-stock
```

Yêu cầu `@andy-toolforge/core` và `mongodb` (tự động cài kèm).

Để sử dụng Indicator Calculation (Python bridge), cần cài thêm:

```bash
uv sync  # trong thư mục py-packages/vn-stock-indicators/
```

## API Reference

```javascript
const {
    StockDB,              // MongoDB connection & collection helpers
    StockScreener,        // Filter/screen stocks by technical conditions
    StockScorer,          // Multi-factor scoring engine (0-100)
    SignalDetector,       // Detect 17 technical signals
    IndicatorEngine,      // Python subprocess bridge — 29 indicators
    IndicatorEngineError, // Error class with code property
} = require('@andy-toolforge/vn-stock');
```

---

### StockDB

Kết nối MongoDB và truy vấn dữ liệu cổ phiếu. Dữ liệu được pre-fetched bởi fetch team — không gọi API trực tiếp.

**Constructor:** `new StockDB()`

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Kết nối MongoDB (stock_db) |
| `close()` | `Promise<void>` | Đóng kết nối |
| `getLatestCandles(symbols, limit)` | `Array` | Lấy N candle gần nhất cho từng symbol |
| `getIntradayIndicators(symbols?)` | `Array` | Lấy intraday indicators (15m/1h) |
| `getFundamentals(symbols)` | `Array` | Lấy dữ liệu cơ bản (PE, PB, ROE...) |

---

### StockScreener

Sàng lọc cổ phiếu theo điều kiện kỹ thuật — daily và intraday.

**Constructor:** `new StockScreener()`

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `screenDaily({ filters, sortBy, limit })` | `Array` | Screen daily với filter operators |
| `screenIntraday({ filters, interval, sortBy, limit })` | `Array` | Screen intraday (15m/1h) |
| `getSymbolInfo(symbol)` | `Object` | Full info: daily + intraday + fundamentals |

```javascript
const { StockScreener } = require('@andy-toolforge/vn-stock');
const screener = new StockScreener();

// RSI oversold + EMA uptrend
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

// Single symbol
const info = await screener.getSymbolInfo('FPT');
console.log(info.daily?.rsi, info.fundamentals?.pe);
```

**Filter Operators:**

| Operator | Mô tả |
|----------|-------|
| `gt` / `gte` | Lớn hơn / lớn hơn hoặc bằng |
| `lt` / `lte` | Nhỏ hơn / nhỏ hơn hoặc bằng |
| `eq` / `neq` | Bằng / không bằng |
| `crossAbove` | Cắt lên (field > compareToField, trước đó <=) |
| `crossBelow` | Cắt xuống (field < compareToField, trước đó >=) |

---

### StockScorer

Chấm điểm cổ phiếu 0-100 theo 4 yếu tố.

**Constructor:** `new StockScorer({ weights? })`

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `scoreCandle(candle, fundamentals?, prevCandle?)` | `{ total, breakdown }` | Chấm điểm một candle |
| `scoreAll({ limit })` | `Array` | Xếp hạng tất cả symbols (daily) |
| `scoreIntraday(symbol, interval?)` | `Object\|null` | Chấm điểm intraday 1 symbol |
| `scoreAllIntraday({ interval, limit })` | `Array` | Xếp hạng tất cả symbols (intraday) |

**Scoring Factors:**

| Factor | Weight | Indicators |
|--------|:------:|------------|
| **Technical** | 40% | RSI (30%), EMA20/50/100 alignment (40%), MACD cross + histogram (30%), Bollinger position + squeeze (bonus), ATR (bonus) |
| **Volume** | 20% | Volume vs vol_ma20 ratio (4 thresholds), OBV divergence |
| **Momentum** | 20% | Price change % (5 thresholds), MFI (4 zones), Stochastic crossover, VWAP distance |
| **Fundamental** | 20% | PE, PB, ROE, EPS growth (5 zones mỗi chỉ số); defaults to 50 nếu không có data |

```javascript
const { StockScorer } = require('@andy-toolforge/vn-stock');
const scorer = new StockScorer();

// Score all symbols (auto-ranked)
const ranked = await scorer.scoreAll({ limit: 20 });

// Intraday scoring
const intradayRanked = await scorer.scoreAllIntraday({ interval: '15m', limit: 20 });
const fpt15m = await scorer.scoreIntraday('FPT', '15m');

// Single candle with custom weights
const scorer2 = new StockScorer({ weights: { technical: 0.5, volume: 0.3, momentum: 0.2, fundamental: 0 } });
const result = scorer2.scoreCandle(
    { rsi: 72, ema20: 110, ema50: 100, volume: 2e6, vol_ma20: 500000, price_change_pct: 3.5, obv: 1500 },
    { pe: 12, pb: 1.5, roe: 18 },
    { obv: 1300 }
);
console.log(result.total, result.breakdown);
```

---

### SignalDetector

Phát hiện tín hiệu giao dịch từ dữ liệu nến + chỉ báo — 17 methods, 6 categories.

**Constructor:** `new SignalDetector(config?)`

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getSignals(candle, prevCandle?)` | `Array` | Tất cả tín hiệu phát hiện được |
| `getSignalsGrouped(candle, prevCandle?)` | `Object` | Tín hiệu grouped theo category |

**Detection Categories:**

| Category | Signals |
|----------|---------|
| **Trend** | MACD crossover, EMA crossover, EMA alignment |
| **Momentum** | RSI oversold/overbought, RSI divergence, Stochastic crossover |
| **Volatility** | Bollinger squeeze/breakout, ATR breakout |
| **Volume** | Volume spike, Volume SMA breakout, Volume divergence |
| **Flow / MCDX** | MFI (Money Flow Index) zones |
| **Price Action** | Engulfing, Doji, Hammer, Price reversal |

```javascript
const { SignalDetector } = require('@andy-toolforge/vn-stock');
const detector = new SignalDetector();

// Detect all signals
const signals = detector.getSignals(candle, prevCandle);
// → [{ type: 'EMA_CROSSOVER', direction: 'bullish', strength: 0.85, message: '...' }, ...]

// Grouped by category
const grouped = detector.getSignalsGrouped(candle, prevCandle);
// → { trend: [...], momentum: [...], volatility: [...], volume: [...], flow: [...], priceAction: [...] }

// Custom thresholds
const custom = new SignalDetector({
    rsi: { oversold: 25, overbought: 75 },
    volume: { spikeRatio: 3.0 },
});
```

---

### IndicatorEngine

Tính toán chỉ báo kỹ thuật bằng Python engine (`vn-stock-indicators`). Hỗ trợ 29 indicators qua 2 chế độ.

**Constructor:** `new IndicatorEngine({ mode?, pythonPath?, mongoUri? })`

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `compute({ indicators, ohlcv, params })` | `Object` | Tính indicators từ OHLCV data |
| `fetchAndCompute({ symbol, source, indicators, params, limit })` | `Object` | Fetch từ MongoDB + tính |
| `connect()` | `void` | Kết nối pool mode |
| `disconnect()` | `void` | Ngắt kết nối pool mode |

**Chế độ hoạt động:**

| Mode | Mô tả |
|------|-------|
| `spawn` (default) | Mỗi lần gọi spawn một Python process mới. Phù hợp gọi ít, không cần maintain state. |
| `pool` | Giữ Python process persistent, giao tiếp qua JSON-line protocol. Nhanh hơn khi gọi nhiều lần. |

**29 Indicators hỗ trợ:**

| Category | Functions |
|----------|-----------|
| **Trend** | sma, ema, wema, wma, dema, tema, macd, adx, psar, ichimoku |
| **Momentum** | rsi, stochastic, williams_r, cci, mfi, roc |
| **Volatility** | bollinger_bands, atr, keltner, volatility |
| **Volume** | obv, volume_sma, vwap, ad, adosc |
| **Price Action** | support_resistance, pivot_points, detect_engulfing, detect_doji, detect_hammer |

```javascript
const { IndicatorEngine } = require('@andy-toolforge/vn-stock');

// Spawn mode (one-off)
const engine = new IndicatorEngine();
const result = await engine.compute({
    indicators: ['sma', 'ema', 'rsi', 'macd', 'bbands'],
    ohlcv: { open: [...], high: [...], low: [...], close: [...], volume: [...] },
    params: { sma: [20, 50], ema: [20], rsi: [14] },
});

// Pool mode (reuse process)
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

---

## MCP Tools

Package này tự động đăng ký 4 tools với `@andy-toolforge/mcp` qua cơ chế discovery:

| Tool | Description |
|------|-------------|
| `toolforge_vn_stock_screen` | Screen cổ phiếu theo filter conditions (daily) |
| `toolforge_vn_stock_info` | Lấy full info symbol (daily + intraday + fundamentals) |
| `toolforge_vn_stock_score` | Xếp hạng tất cả stocks theo daily multi-factor score |
| `toolforge_vn_stock_score_intraday` | Xếp hạng intraday (15m/1h), không có fundamental |
| `toolforge_vn_stock_analyze` | AI analysis — recommendation, score, reasoning for a symbol |
| `toolforge_vn_stock_deep_dive` | Deep dive — entry/exit, SL, support/resistance, risk/reward |
| `toolforge_vn_stock_compare` | Compare multiple symbols — ranking, top pick, AI summary |

## Testing

```bash
npm test -w @andy-toolforge/vn-stock
```
