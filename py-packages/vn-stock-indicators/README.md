# vn-stock-indicators

Pure Python technical indicators for VN stock market analysis. NumPy-based, stateless, batch CLI-ready.

## Installation

```bash
cd py-packages/vn-stock-indicators && uv sync
```

## Usage

### Python API

```python
import numpy as np
from vn_stock_indicators import sma, ema, rsi, bbands, macd

close = np.array([81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100], dtype=np.float64)

sma_20 = sma(close, period=20)
ema_20 = ema(close, period=20)
rsi_14 = rsi(close, period=14)
bb = bbands(close, period=20, std_dev=2.0)
m = macd(close)
```

### Batch CLI (for JS subprocess)

```bash
echo '{"close": [81,82,83,...], "indicators": ["rsi","ema","bbands"], "params": {"rsi":{"period":14}}}' \
  | uv run python -m vn_stock_indicators.batch
```

## Indicators (29 total)

### Trend (10)
sma, ema, wema, wma, dema, tema, macd, adx, psar, ichimoku

### Momentum (6)
rsi, stochastic, williams_r, cci, mfi, roc

### Volatility (4)
bbands, atr, keltner, donchian

### Volume (4)
obv, volume_sma, vwap, chaikin_mf

### Price Action (5)
support_resistance, pivot_points, detect_engulfing, detect_doji, detect_hammer

## Testing

```bash
cd py-packages/vn-stock-indicators && uv run pytest -v
```
