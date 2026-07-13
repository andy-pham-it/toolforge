# VN Stock Screener — Screening Conditions & Signals

## Collections
- `stock_1d` — Daily candles with full indicators (54 symbols, 1330 candles/symbol)
- `stock_15m` — 15-min candles (partial indicators, ~5 candles/ngày)
- `stock_1h` — 1h candles (OHLCV only, no indicators yet)
- `intraday_indicators` — Latest indicator values per symbol × interval
- `stock_fundamentals` — PE, PB, ROE, market cap, EPS, growth

## Key Indicators per Candle
- `ema20`, `ema50`, `ema100`, `ema200` — Exponential Moving Averages
- `rsi` — RSI 14
- `macd`, `signal`, `histogram` — MACD (12/26/9)
- `atr`, `atr_pct` — Average True Range
- `bb_upper`, `bb_lower`, `bb_width` — Bollinger Bands (20,2)
- `vol_ma20` — Volume MA 20
- `stoch_k`, `stoch_d` — Stochastic (14,3)
- `obv` — On-Balance Volume
- `vwap` — Volume-Weighted Average Price
- `mfi` — Money Flow Index
- `price_change_pct` — % change from previous candle

## Score Factors
- Technical (40%): RSI (3 zones), EMA20/50/100 alignment, MACD cross + histogram, Bollinger position (upper/lower band), Bollinger squeeze (bb_width < 2), ATR volatility (atr_pct > 3% / < 0.5%)
- Volume (20%): Volume vs MA (4 thresholds: >2x spike, >1.5x, <0.8x, <0.5x), OBV divergence (price direction vs OBV direction)
- Momentum (20%): Price change (5 thresholds: ±3%, ±1%, >0), MFI (4 zones: >80, >50, <50, <20), Stochastic cross (+ overbought/oversold), VWAP distance (>1% above/below)
- Fundamental (20%): PE (5 zones: <10, <15, <25, <40, >=40), PB (5 zones), ROE (5 zones: >20%, >15%, >10%, >5%, <=5%), EPS growth (5 zones: >30%, >15%, >5%, >0%, <0%); defaults to neutral 50 if no data available

## Typical Screens
1. **RSI Oversold**: rsi < 30, ema20 > ema50
2. **RSI Overbought**: rsi > 70, volume spike
3. **Golden Cross**: ema20 crossAbove ema50
4. **Death Cross**: ema20 crossBelow ema50
5. **Bollinger Squeeze**: bb_width low, volume low
6. **Momentum**: macd > signal, rsi > 50
