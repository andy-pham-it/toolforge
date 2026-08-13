# VN Stock Trading Workflow

Workflow end-to-end: **screen -> score -> detect -> watchlist** dùng `@andy-toolforge/vn-stock`.

## 1. Screen — lọc ứng viên

Dùng `StockScreener.screenDaily()` với filters kỹ thuật. Ví dụ RSI oversold + EMA uptrend:

```javascript
const { StockScreener } = require('@andy-toolforge/vn-stock');

const screener = new StockScreener();
const candidates = await screener.screenDaily({
    filters: [
        { field: 'rsi', operator: 'lt', value: 35 },
        { field: 'ema20', operator: 'gt', compareToField: 'ema50' },
    ],
    sortBy: 'rsi',
    limit: 20,
});
```

Các screen phổ biến (chi tiết xem `vn-stock-screener`):

- RSI Oversold: `rsi < 30`, `ema20 > ema50`
- RSI Overbought: `rsi > 70`, volume spike
- Golden Cross: `ema20 crossAbove ema50`
- Death Cross: `ema20 crossBelow ema50`
- Bollinger Squeeze: `bb_width` thấp, volume thấp
- Momentum: `macd > signal`, `rsi > 50`

## 2. Score — chấm điểm đa yếu tố

Dùng `StockScorer.scoreAll()` — technical 40%, volume 20%, momentum 20%, fundamental 20%:

```javascript
const { StockScorer } = require('@andy-toolforge/vn-stock');

const scorer = new StockScorer();
const ranked = await scorer.scoreAll({ limit: 10 });
```

## 3. Detect — tín hiệu giao dịch

Dùng `SignalDetector.detectAll(symbol)` cho từng ứng viên:

```javascript
const { SignalDetector } = require('@andy-toolforge/vn-stock');

const detector = new SignalDetector();
for (const { symbol } of candidates) {
    const signals = await detector.detectAll(symbol);
    if (signals.filter((s) => s.direction === 'bullish').length >= 2) {
        console.log(`${symbol}: ${signals.length} signals detected`);
    }
}
```

## 4. Watchlist — kết hợp

Kết hợp screen -> score -> detect: giữ mã có score cao (top 10) VÀ >= 2 tín hiệu bullish. Ghi chú lý do vào watchlist để theo dõi.

## Related

- `vn-stock-screener` — chi tiết score factors & typical screens
- `vn-stock-analyst` — phân tích chuyên sâu từng mã