# vn-stock-indicators — Python Technical Analysis Library

> **Python package** (the only non-JS package in the toolforge monorepo).
> Pure numpy-based technical indicator library for Vietnamese stock analysis.
> Used by `@andy-toolforge/vn-stock` (IndicatorEngine spawns Python subprocesses).
>
> All functions accept numpy arrays and return numpy arrays. No pandas dependency.

## Structure

```
py-packages/vn-stock-indicators/
  src/vn_stock_indicators/
    __init__.py          — Exports all indicator functions (5 categories)
    trend.py             — Trend indicators: sma, ema, wema, wma, dema, tema, macd, adx, psar, ichimoku
    momentum.py          — Momentum oscillators: rsi, stochastic, williams_r, cci, mfi, roc
    volatility.py        — Volatility: atr, bollinger_bands, keltner, volatility
    volume.py            — Volume-based: ad, adosc, obv, volume_profile
    price_action.py      — Price action patterns: support_resistance, pivot_points,
                           detect_engulfing, detect_doji, detect_hammer
    batch.py             — Bulk computation helpers
  tests/
    test_trend.py
    test_momentum.py
    test_volatility.py
    test_volume.py
    test_price_action.py
  pyproject.toml         — Python package config (install via pip)
  requirements.txt       — Deps: numpy
```

## Exports

### Trend indicators (`trend.py`)

| Function | Returns | Description |
|----------|---------|-------------|
| `sma(close, period)` | Array | Simple Moving Average |
| `ema(close, period)` | Array | Exponential Moving Average |
| `wema(close, period)` | Array | Weighted Exponential Moving Average |
| `wma(close, period)` | Array | Weighted Moving Average |
| `dema(close, period)` | Array | Double Exponential Moving Average |
| `tema(close, period)` | Array | Triple Exponential Moving Average |
| `macd(close, fast, slow, signal)` | (macd, signal, hist) | MACD + Signal + Histogram |
| `adx(high, low, close, period)` | (adx, plus_di, minus_di) | Average Directional Index |
| `psar(high, low, accel, max_accel)` | (psar, trend) | Parabolic SAR |
| `ichimoku(high, low, close)` | (tenkan, kijun, senkou_a, senkou_b, chikou) | Ichimoku Cloud |

### Momentum indicators (`momentum.py`)

| Function | Returns | Description |
|----------|---------|-------------|
| `rsi(close, period)` | Array | Relative Strength Index |
| `stochastic(high, low, close, k_period, d_period)` | (k, d) | Stochastic Oscillator |
| `williams_r(high, low, close, period)` | Array | Williams %R |
| `cci(high, low, close, period)` | Array | Commodity Channel Index |
| `mfi(high, low, close, volume, period)` | Array | Money Flow Index |
| `roc(close, period)` | Array | Rate of Change |

### Volatility indicators (`volatility.py`)

| Function | Returns | Description |
|----------|---------|-------------|
| `atr(high, low, close, period)` | Array | Average True Range |
| `bollinger_bands(close, period, std)` | (upper, mid, lower) | Bollinger Bands |
| `keltner(high, low, close, period, atr_period, multiplier)` | (upper, mid, lower) | Keltner Channels |
| `volatility(close, period)` | Array | Historical Volatility |

### Volume indicators (`volume.py`)

| Function | Returns | Description |
|----------|---------|-------------|
| `ad(high, low, close, volume)` | Array | Accumulation/Distribution Line |
| `adosc(high, low, close, volume, fast, slow)` | Array | A/D Oscillator |
| `obv(close, volume)` | Array | On-Balance Volume |
| `volume_profile(close, volume, num_bins)` | Array | Volume Profile |

### Price action patterns (`price_action.py`)

| Function | Returns | Description |
|----------|---------|-------------|
| `support_resistance(high, low, close, window)` | (support, resistance) | S/R levels |
| `pivot_points(high, low, close)` | (pp, r1-r3, s1-s3) | Pivot Points |
| `detect_engulfing(open, high, low, close)` | Array | Bullish/bearish engulfing flags |
| `detect_doji(open, high, low, close, threshold)` | Array | Doji candle flags |
| `detect_hammer(open, high, low, close)` | Array | Hammer/shammer flags |

## Conventions

- **Pure numpy** — no pandas, no scipy. Zero heavy dependencies.
- All functions accept `np.ndarray` and return `np.ndarray` (or tuple of arrays).
- NaN/None handling: leading NaN for window-based calculations (first `period-1` values).
- Not a proper Python package on PyPI — installed locally via `pip install -e py-packages/vn-stock-indicators`.
- Called from `@andy-toolforge/vn-stock` via child process (Python subprocess, not JS binding).
- `batch.py` provides bulk computation helper for running multiple indicators efficiently.

## Testing

```bash
cd py-packages/vn-stock-indicators && python -m pytest tests/
```

## See also

- `packages/vn-stock/` — JavaScript package that uses this library via subprocess
- `packages/vn-stock/lib/indicator-engine.js` — IndicatorEngine spawn logic
