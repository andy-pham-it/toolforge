# VN Stock Skills

Bộ skill cho `@andy-toolforge/vn-stock` — phân tích cổ phiếu Việt Nam (screening, scoring, signal detection).

## Available Skill Files

| Skill | Mô tả |
|-------|-------|
| vn-stock-analyst | Phân tích chuyên sâu một mã cổ phiếu (technical + fundamental) |
| vn-stock-screener | Lọc cổ phiếu theo điều kiện kỹ thuật + giải thích score factors |
| vn-stock-trading-workflow | Workflow end-to-end: screen -> score -> detect -> watchlist |

## Data Collections

- `stock_1d` — nến daily kèm indicators (54 symbols, ~1330 candles/symbol)
- `stock_15m`, `stock_1h` — nến intraday (OHLCV)
- `intraday_indicators` — indicators intraday
- `stock_fundamentals` — PE/PB/ROE/market cap/EPS/growth

## Related

- `@andy-toolforge/vn-stock` — StockDB, StockScreener, StockScorer, SignalDetector
- `py-packages/vn-stock-indicators` — 29 indicators thuần numpy