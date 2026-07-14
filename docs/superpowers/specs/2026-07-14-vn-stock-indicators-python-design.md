# VN Stock Indicators — Python Package Design

> **Domain:** `@andy-toolforge/vn-stock` companion package for technical indicator calculation
> **Language:** Python 3.14+
> **Package manager:** uv
> **Layout:** `py-packages/vn-stock-indicators/`

---

## 1. Why Python?

Approach 1 (JS-only) bị từ chối vì stock analytics trong thực tế dùng Python là chính — numpy cho performance, ecosystem rộng (pandas, ta-lib, scipy), và dễ tích hợp với data science workflow.

**Chiến lược:** Hybrid — standalone Python package có CLI mode, JS bên `@andy-toolforge/vn-stock` gọi qua subprocess khi cần.

---

## 2. Package Structure

```
py-packages/vn-stock-indicators/
├── pyproject.toml            — uv project config (name = "vn-stock-indicators")
├── README.md
├── tests/
│   ├── __init__.py
│   ├── test_trend.py
│   ├── test_momentum.py
│   ├── test_volatility.py
│   ├── test_volume.py
│   ├── test_price_action.py
│   └── test_batch.py
└── src/
    └── vn_stock_indicators/
        ├── __init__.py          — re-export all public functions
        ├── types.py             — OHLCV typed dict / dataclass
        ├── trend.py             — SMA, EMA, WEMA, WMA, DEMA, TEMA, MACD, ADX, PSAR, Ichimoku
        ├── momentum.py          — RSI, Stochastic, Williams %R, CCI, MFI, ROC
        ├── volatility.py        — Bollinger Bands, ATR, Keltner Channels, Donchian Channels
        ├── volume.py            — OBV, Volume SMA, VWAP, Chaikin Money Flow
        ├── price_action.py      — Support/Resistance, Pivot Points, Candlestick Patterns
        └── batch.py             — CLI entry: stdin JSON → calc → stdout JSON
```

## 3. Architecture

### 3.1. Stateless Pure Functions

Mỗi function nhận OHLCV array và trả về kết quả. Không state, không caching, không side effects.

```python
def ema(close: np.ndarray, period: int = 20) -> np.ndarray:
    """Exponential Moving Average — TA-Lib style, leading NaNs."""
    ...

def rsi(close: np.ndarray, period: int = 14) -> np.ndarray:
    """Relative Strength Index."""
    ...
```

**Prior state handling:** TA-Lib convention — kết quả trả về array cùng length với input, giá trị không đủ window là `np.nan`. Sau này nếu cần warm start thì thêm `prior_state` optional parameter.

### 3.2. Types

```python
from typing import TypedDict, Optional
import numpy as np

class OHLCV(TypedDict):
    open: np.ndarray      # float64
    high: np.ndarray      # float64
    low: np.ndarray       # float64
    close: np.ndarray     # float64
    volume: np.ndarray    # float64 (int64)

class IndicatorResult(TypedDict, total=False):
    value: float | np.ndarray
    upper: Optional[np.ndarray]    # Bollinger upper, etc.
    lower: Optional[np.ndarray]    # Bollinger lower, etc.
    signal: Optional[np.ndarray]   # MACD signal line
    histogram: Optional[np.ndarray]
```

### 3.3. Batch CLI Mode

JS gọi Python qua subprocess, truyền OHLCV JSON qua stdin, nhận kết quả JSON qua stdout:

```bash
echo '{"close": [81, 82, 83, ...], "indicators": ["rsi", "ema", "bbands"], "params": {"rsi_period": 14}}' \
  | uv run --directory py-packages/vn-stock-indicators python -m vn_stock_indicators.batch
```

Output:
```json
{
  "rsi": [null, null, ..., 45.2, 48.7, ...],
  "ema": [null, ..., 82.3, 82.5, ...],
  "bbands": {
    "upper": [...],
    "middle": [...],
    "lower": [...]
  }
}
```

**Data contract:**
- Input: JSON object với OHLCV arrays + indicator names + optional per-indicator params
- Output: JSON object với kết quả theo indicator
- Error: JSON `{"error": "message"}` + exit code 1

### 3.4. JS Bridge (tương lai, không nằm trong spec này)

Sau này thêm `lib/indicators.js` trong `@andy-toolforge/vn-stock`:

```javascript
const { spawn } = require('child_process');
function calcIndicators(ohlcv, indicatorNames, params = {}) {
    // spawn uv run python -m vn_stock_indicators.batch
    // pipe stdin, collect stdout, parse JSON
    // return { rsi: [...], ema: [...] }
}
```

Không implement trong phase này — spec này chỉ cho Python package.

---

## 4. Indicator Catalog (29 indicators)

### 4.1. Trend (10)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `sma(close, period)` | period=20 | np.ndarray | Simple Moving Average |
| `ema(close, period)` | period=20 | np.ndarray | Exponential Moving Average |
| `wema(close, period)` | period=20 | np.ndarray | Wilder's EMA (alpha=1/period) |
| `wma(close, period)` | period=20 | np.ndarray | Weighted Moving Average |
| `dema(close, period)` | period=20 | np.ndarray | Double EMA |
| `tema(close, period)` | period=20 | np.ndarray | Triple EMA |
| `macd(close, fast, slow, signal)` | 12, 26, 9 | {macd, signal, histogram} | MACD |
| `adx(high, low, close, period)` | period=14 | {adx, plus_di, minus_di} | Average Directional Index |
| `psar(high, low, accel, max_accel)` | 0.02, 0.2 | {psar, direction} | Parabolic SAR |
| `ichimoku(high, low, close, ...)` | 9, 26, 52 | {tenkan, kijun, senkou_a, senkou_b, chikou} | Ichimoku Cloud |

### 4.2. Momentum (6)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `rsi(close, period)` | period=14 | np.ndarray | Relative Strength Index |
| `stochastic(high, low, close, k, d)` | 14, 3 | {k, d} | Stochastic Oscillator |
| `williams_r(high, low, close, period)` | period=14 | np.ndarray | Williams %R |
| `cci(high, low, close, period)` | period=20 | np.ndarray | Commodity Channel Index |
| `mfi(high, low, close, volume, period)` | period=14 | np.ndarray | Money Flow Index |
| `roc(close, period)` | period=12 | np.ndarray | Rate of Change |

### 4.3. Volatility (4)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `bbands(close, period, std_dev)` | 20, 2 | {upper, middle, lower, bandwidth, %b} | Bollinger Bands |
| `atr(high, low, close, period)` | period=14 | np.ndarray | Average True Range |
| `keltner(high, low, close, period, multiplier)` | 20, 1.5 | {upper, middle, lower} | Keltner Channels |
| `donchian(high, low, period)` | period=20 | {upper, middle, lower} | Donchian Channels |

### 4.4. Volume (4)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `obv(close, volume)` | — | np.ndarray | On-Balance Volume |
| `volume_sma(volume, period)` | period=20 | np.ndarray | Volume Simple Moving Average |
| `vwap(high, low, close, volume)` | — | np.ndarray | Volume-Weighted Average Price |
| `chaikin_mf(high, low, close, volume, period)` | period=20 | np.ndarray | Chaikin Money Flow (AD Line + MF) |

### 4.5. Price Action (5)

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `support_resistance(high, low, close, bins)` | bins=10 | {levels, strength} | Cluster-based S/R levels |
| `pivot_points(high, low, close)` | — | {pp, r1, r2, s1, s2, r3, s3} | Classic Pivot Points |
| `detect_engulfing(open, high, low, close)` | — | np.ndarray (int) | Bullish/Bearish Engulfing |
| `detect_doji(open, close, body_pct)` | body_pct=0.1 | np.ndarray (bool) | Doji detection |
| `detect_hammer(open, high, low, close, body_pct, wick_ratio)` | 0.3, 2.0 | np.ndarray (bool) | Hammer / Shooting Star |

---

## 5. Function Signature Convention

```python
def indicator_name(
    ohlcv_arrays: ...,
    period: int = <default>,
    *,
    # optional params only
) -> np.ndarray | dict[str, np.ndarray]:
    ...
```

- OHLCV arrays luôn là `np.ndarray` dtype `float64`
- Period parameters luôn có default value
- Giá trị thiếu dữ liệu = `np.nan` (leading NaNs)
- Multi-output indicators return dict of arrays
- Không mutate input arrays

---

## 6. Error Handling

- **Invalid input:** `ValueError` với message rõ ràng (e.g., "close array must have at least 20 elements for period=20")
- **NaN propagation:** input có NaN → output có NaN ở cùng vị trí (numpy behavior mặc định)
- **Zero-length array:** `ValueError("Input array must not be empty")`
- **Batch JSON parse error:** `{"error": "Invalid JSON: <detail>"}`, exit code 1
- **Unknown indicator:** `{"error": "Unknown indicator: xxx"}`, exit code 1

---

## 7. Dependencies

```toml
[project]
dependencies = [
    "numpy>=2.0",
]
[project.optional-dependencies]
pandas = ["pandas>=2.0"]
dev = ["pytest>=8", "pytest-benchmark"]
```

- **Runtime:** `numpy` (bắt buộc)
- **Optional:** `pandas` (chỉ cần nếu muốn nhận DataFrame thay vì array)
- **Dev:** `pytest`, `pytest-benchmark`

---

## 8. Testing Strategy

- pytest, không dùng unittest
- 3-5 test cases per indicator function:
  - Known values (so sánh với công thức thủ công)
  - Edge cases (single element, empty, NaN, constant values)
  - Leading NaNs đúng số lượng
- Batch integration test: pipe JSON → verify output
- Benchmark tests cho critical paths (rsi, ema, bbands)

---

## 9. Development Commands

```bash
# Setup
cd py-packages/vn-stock-indicators
uv venv
uv sync

# Test
uv run pytest

# Single indicator via CLI
echo '{"close": [81,82,83,84,85], "indicators": ["rsi"]}' \
  | uv run --directory py-packages/vn-stock-indicators python -m vn_stock_indicators.batch

# Lint (uv tool)
uv tool install ruff
uv run ruff check src/
```

---

## 10. Out of Scope

- JS bridge (`lib/indicators.js`) — sẽ làm sau
- TALib wrapper — pure numpy implementation
- Real-time / streaming — batch mode only
- Data fetching — package nhận dữ liệu, không fetch
- Visualization / charting
- Machine learning features

---

## 11. Future Considerations

- **Performance:** Nếu cần nhanh hơn nữa, có thể thêm `numba` JIT cho critical paths
- **WebAssembly:** Future option để chạy indicators trong browser
- **WebSocket streaming:** Real-time indicator updates
- **TALib comparison:** Test fixture sinh reference values từ TA-Lib để verify
