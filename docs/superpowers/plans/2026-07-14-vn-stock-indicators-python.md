# VN Stock Indicators (Python) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `py-packages/vn-stock-indicators/` — a pure Python package with 29 technical indicators across 5 categories, plus a batch CLI for JS subprocess calling.

**Architecture:** Stateless pure functions operating on `np.ndarray` OHLCV arrays. Each category is a separate module. Batch CLI reads JSON from stdin, dispatches to calculators, writes JSON results to stdout. TA-Lib convention: leading NaNs for insufficient window.

**Tech Stack:** Python 3.14+, uv, numpy>=2.0, pytest, ruff

## Global Constraints

- Python 3.14+ only (no 3.12/3.13 compat needed)
- Runtime dep: `numpy>=2.0` only (pandas is optional)
- All functions stateless pure — no classes, no side effects, no caching
- OHLCV arrays always `np.ndarray` dtype `float64`
- Leading NaNs for insufficient window (TA-Lib convention)
- Multi-output indicators return `dict[str, np.ndarray]`
- Single-output indicators return `np.ndarray`
- Never mutate input arrays — copy if modification needed
- Directory: `py-packages/vn-stock-indicators/`
- Test framework: pytest (no unittest)
- Linter/formatter: ruff (not in CI yet, but run `uv run ruff check`)
- Every function must validate input length >= period (raise `ValueError`)

---

### Task 1: Project Scaffold + Types

**Files:**
- Create: `py-packages/vn-stock-indicators/pyproject.toml`
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/__init__.py`
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/types.py`
- Create: `py-packages/vn-stock-indicators/tests/__init__.py`

**Interfaces:**
- Consumes: (nothing — first task)
- Produces: types.py (OHLCV, IndicatorResult), project scaffold that later tasks install into

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p py-packages/vn-stock-indicators/src/vn_stock_indicators
mkdir -p py-packages/vn-stock-indicators/tests
```

- [ ] **Step 2: Create `pyproject.toml`**

```toml
[project]
name = "vn-stock-indicators"
version = "0.1.0"
description = "Technical indicator calculations for VN stock market — pure numpy"
requires-python = ">=3.14"
dependencies = [
    "numpy>=2.0",
]
optional-dependencies = { pandas = ["pandas>=2.0"], dev = ["pytest>=8"] }

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]
```

- [ ] **Step 3: Run `uv sync` to install dependencies**

```bash
cd py-packages/vn-stock-indicators && uv sync && uv sync --group dev
```

Expected: Creates `.venv/`, installs numpy + pytest.

- [ ] **Step 4: Create `src/vn_stock_indicators/types.py`**

```python
from __future__ import annotations

from typing import TypedDict, Optional
import numpy as np


class OHLCV(TypedDict):
    open: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close: np.ndarray
    volume: np.ndarray


class IndicatorResult(TypedDict, total=False):
    value: float | np.ndarray
    upper: Optional[np.ndarray]
    lower: Optional[np.ndarray]
    middle: Optional[np.ndarray]
    signal: Optional[np.ndarray]
    histogram: Optional[np.ndarray]
    macd: Optional[np.ndarray]
    plus_di: Optional[np.ndarray]
    minus_di: Optional[np.ndarray]
    adx: Optional[np.ndarray]
    psar: Optional[np.ndarray]
    direction: Optional[np.ndarray]
    tenkan: Optional[np.ndarray]
    kijun: Optional[np.ndarray]
    senkou_a: Optional[np.ndarray]
    senkou_b: Optional[np.ndarray]
    chikou: Optional[np.ndarray]
    k: Optional[np.ndarray]
    d: Optional[np.ndarray]
    bandwidth: Optional[np.ndarray]
    pct_b: Optional[np.ndarray]
    levels: Optional[np.ndarray]
    strength: Optional[np.ndarray]
    pp: Optional[np.ndarray]
    r1: Optional[np.ndarray]
    r2: Optional[np.ndarray]
    s1: Optional[np.ndarray]
    s2: Optional[np.ndarray]
    r3: Optional[np.ndarray]
    s3: Optional[np.ndarray]
```

- [ ] **Step 5: Create `src/vn_stock_indicators/__init__.py`**

```python
# vn_stock_indicators — Technical indicators for VN stock market
```

- [ ] **Step 6: Create empty `tests/__init__.py`**

- [ ] **Step 7: Verify scaffold**

```bash
cd py-packages/vn-stock-indicators && uv run python -c "import numpy; print('numpy', numpy.__version__)"
```

Expected: `numpy 2.x.x`

- [ ] **Step 8: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): scaffold pyproject.toml, types, directory"
```

---

### Task 2: Trend Indicators (10 functions)

**Files:**
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/trend.py`
- Create: `py-packages/vn-stock-indicators/tests/test_trend.py`
- Modify: `py-packages/vn-stock-indicators/src/vn_stock_indicators/__init__.py`

**Interfaces:**
- Produces: `sma()`, `ema()`, `wema()`, `wma()`, `dema()`, `tema()`, `macd()`, `adx()`, `psar()`, `ichimoku()`

- [ ] **Step 1: Create `src/vn_stock_indicators/trend.py`**

```python
from __future__ import annotations

import numpy as np


def _validate(arr: np.ndarray, name: str, min_len: int = 1) -> None:
    if not isinstance(arr, np.ndarray):
        raise ValueError(f"{name} must be numpy array, got {type(arr).__name__}")
    if arr.size == 0:
        raise ValueError(f"{name} must not be empty")
    if arr.ndim != 1:
        raise ValueError(f"{name} must be 1D, got {arr.ndim}D")
    if len(arr) < min_len:
        raise ValueError(f"{name} needs >= {min_len} elements, got {len(arr)}")


def _ema(values: np.ndarray, period: int) -> np.ndarray:
    """Internal EMA helper."""
    result = np.full_like(values, np.nan, dtype=np.float64)
    if period <= 0 or len(values) < period:
        return result
    alpha = 2.0 / (period + 1)
    result[period - 1] = np.mean(values[:period])
    for i in range(period, len(values)):
        result[i] = alpha * values[i] + (1 - alpha) * result[i - 1]
    return result


def sma(values: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(values, "values", period)
    result = np.full_like(values, np.nan, dtype=np.float64)
    for i in range(period - 1, len(values)):
        result[i] = np.mean(values[i - period + 1 : i + 1])
    return result


def ema(values: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(values, "values", period)
    return _ema(values, period)


def wema(values: np.ndarray, period: int = 20) -> np.ndarray:
    """Wilder's EMA (alpha = 1/period)."""
    _validate(values, "values", period)
    result = np.full_like(values, np.nan, dtype=np.float64)
    alpha = 1.0 / period
    result[period - 1] = np.mean(values[:period])
    for i in range(period, len(values)):
        result[i] = alpha * values[i] + (1 - alpha) * result[i - 1]
    return result


def wma(values: np.ndarray, period: int = 20) -> np.ndarray:
    """Weighted Moving Average (linear weights, most recent heaviest)."""
    _validate(values, "values", period)
    result = np.full_like(values, np.nan, dtype=np.float64)
    weights = np.arange(1, period + 1, dtype=np.float64)
    wsum = weights.sum()
    for i in range(period - 1, len(values)):
        result[i] = np.dot(values[i - period + 1 : i + 1], weights) / wsum
    return result


def dema(values: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(values, "values", period)
    e1 = _ema(values, period)
    e2 = _ema(np.where(np.isnan(e1), np.nan, e1), period)
    result = 2 * e1 - e2
    result[:period - 1] = np.nan
    return result


def tema(values: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(values, "values", period)
    e1 = _ema(values, period)
    e2 = _ema(np.where(np.isnan(e1), np.nan, e1), period)
    e3 = _ema(np.where(np.isnan(e2), np.nan, e2), period)
    result = 3 * e1 - 3 * e2 + e3
    result[:period - 1] = np.nan
    return result


def macd(values: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> dict[str, np.ndarray]:
    _validate(values, "values", slow)
    ef = _ema(values, fast)
    es = _ema(values, slow)
    m = ef - es
    sig = _ema(m, signal)
    return {"macd": m.astype(np.float64), "signal": sig.astype(np.float64), "histogram": (m - sig).astype(np.float64)}


def adx(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> dict[str, np.ndarray]:
    _validate(high, "high", period + 1)
    _validate(low, "low", period + 1)
    _validate(close, "close", period + 1)
    n = len(close)

    up = np.zeros(n, dtype=np.float64)
    down = np.zeros(n, dtype=np.float64)
    tr = np.zeros(n, dtype=np.float64)

    for i in range(1, n):
        up_move = high[i] - high[i - 1]
        down_move = low[i - 1] - low[i]
        up[i] = up_move if up_move > down_move and up_move > 0 else 0.0
        down[i] = down_move if down_move > up_move and down_move > 0 else 0.0
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))

    # Wilder's smoothing
    alpha = 1.0 / period
    str = np.full(n, np.nan, dtype=np.float64)
    sup = np.full(n, np.nan, dtype=np.float64)
    sdown = np.full(n, np.nan, dtype=np.float64)

    str[period] = np.sum(tr[1:period+1])
    sup[period] = np.sum(up[1:period+1])
    sdown[period] = np.sum(down[1:period+1])

    for i in range(period + 1, n):
        str[i] = str[i-1] + alpha * (tr[i] - str[i-1])
        sup[i] = sup[i-1] + alpha * (up[i] - sup[i-1])
        sdown[i] = sdown[i-1] + alpha * (down[i] - sdown[i-1])

    pdi = np.full(n, np.nan, dtype=np.float64)
    mdi = np.full(n, np.nan, dtype=np.float64)
    adx_val = np.full(n, np.nan, dtype=np.float64)

    for i in range(period, n):
        if str[i] > 0:
            pdi[i] = 100 * sup[i] / str[i]
            mdi[i] = 100 * sdown[i] / str[i]

    dx = np.full(n, np.nan, dtype=np.float64)
    for i in range(period, n):
        s = pdi[i] + mdi[i]
        if s > 0:
            dx[i] = 100 * abs(pdi[i] - mdi[i]) / s

    adx_val[2*period-1] = np.mean(dx[period:2*period])
    for i in range(2*period, n):
        adx_val[i] = (adx_val[i-1] * (period - 1) + dx[i]) / period

    return {"adx": adx_val.astype(np.float64), "plus_di": pdi.astype(np.float64), "minus_di": mdi.astype(np.float64)}


def psar(high: np.ndarray, low: np.ndarray, close: np.ndarray, accel: float = 0.02, max_accel: float = 0.2) -> dict[str, np.ndarray]:
    """Parabolic SAR."""
    _validate(high, "high", 2)
    _validate(low, "low", 2)
    _validate(close, "close", 2)
    n = len(high)

    psar_val = np.full(n, np.nan, dtype=np.float64)
    direction = np.full(n, np.nan, dtype=np.float64)
    af = np.full(n, np.nan, dtype=np.float64)
    ep = np.full(n, np.nan, dtype=np.float64)

    # Determine initial trend
    is_up = close[1] > close[0]

    if is_up:
        psar_val[0] = min(low[0], low[1])
        direction[0] = 1.0
        ep[0] = high[0]
        af[0] = accel
    else:
        psar_val[0] = max(high[0], high[1])
        direction[0] = -1.0
        ep[0] = low[0]
        af[0] = accel

    for i in range(1, n):
        prev_psar = psar_val[i - 1]
        prev_ep = ep[i - 1]
        prev_af = af[i - 1]
        prev_dir = direction[i - 1]

        # Calculate PSAR
        psar_val[i] = prev_psar + prev_dir * prev_af * (prev_ep - prev_psar)

        # Clamp
        if prev_dir > 0:
            psar_val[i] = min(psar_val[i], min(low[i - 1], low[i] if i + 1 < n else low[i]))
        else:
            psar_val[i] = max(psar_val[i], max(high[i - 1], high[i] if i + 1 < n else high[i]))

        # Check reversal
        if prev_dir > 0 and low[i] < psar_val[i]:
            direction[i] = -1.0
            psar_val[i] = prev_ep  # SAR = previous EP
            ep[i] = low[i]
            af[i] = accel
        elif prev_dir < 0 and high[i] > psar_val[i]:
            direction[i] = 1.0
            psar_val[i] = prev_ep
            ep[i] = high[i]
            af[i] = accel
        else:
            direction[i] = prev_dir
            # Extend EP
            if prev_dir > 0 and high[i] > prev_ep:
                ep[i] = high[i]
                af[i] = min(prev_af + accel, max_accel)
            elif prev_dir < 0 and low[i] < prev_ep:
                ep[i] = low[i]
                af[i] = min(prev_af + accel, max_accel)
            else:
                ep[i] = prev_ep
                af[i] = prev_af

    return {"psar": psar_val.astype(np.float64), "direction": direction.astype(np.float64)}


def ichimoku(high: np.ndarray, low: np.ndarray, close: np.ndarray, tenkan_period: int = 9, kijun_period: int = 26, senkou_period: int = 52) -> dict[str, np.ndarray]:
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(high)

    def _mm(p: int):
        mx = np.full(n, np.nan, dtype=np.float64)
        mn = np.full(n, np.nan, dtype=np.float64)
        for i in range(p - 1, n):
            mx[i] = np.max(high[i - p + 1 : i + 1])
            mn[i] = np.min(low[i - p + 1 : i + 1])
        return mx, mn

    tmax, tmin = _mm(tenkan_period)
    tenkan = (tmax + tmin) / 2

    kmax, kmin = _mm(kijun_period)
    kijun = (kmax + kmin) / 2

    smax, smin = _mm(senkou_period)
    senkou_b = (smax + smin) / 2

    senkou_a = np.full(n, np.nan, dtype=np.float64)
    for i in range(kijun_period - 1, n):
        senkou_a[i] = (tenkan[i] + kijun[i]) / 2

    chikou = np.full(n, np.nan, dtype=np.float64)
    for i in range(n - kijun_period):
        chikou[i] = close[i + kijun_period]

    return {
        "tenkan": tenkan.astype(np.float64),
        "kijun": kijun.astype(np.float64),
        "senkou_a": senkou_a.astype(np.float64),
        "senkou_b": senkou_b.astype(np.float64),
        "chikou": chikou.astype(np.float64),
    }
```

- [ ] **Step 2: Create `tests/test_trend.py`**

```python
from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.trend import (
    sma, ema, wema, wma, dema, tema, macd, adx, psar, ichimoku,
)


def test_sma_basic():
    v = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], dtype=np.float64)
    r = sma(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    assert r[2] == pytest.approx(2.0)
    assert r[9] == pytest.approx(9.0)


def test_sma_constant():
    v = np.full(10, 5.0, dtype=np.float64)
    r = sma(v, period=3)
    assert r[9] == pytest.approx(5.0)


def test_ema_basic():
    v = np.arange(1, 11, dtype=np.float64)
    r = ema(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    assert not np.isnan(r[2])
    assert r[9] > 0


def test_wema():
    v = np.arange(1, 11, dtype=np.float64)
    r = wema(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    assert not np.isnan(r[2])


def test_wma():
    v = np.array([1, 2, 3, 4, 5], dtype=np.float64)
    r = wma(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    # weights: [1,2,3], sum=6, value for idx2 = (1*1 + 2*2 + 3*3)/6 = 14/6 ≈ 2.333
    assert r[2] == pytest.approx(14 / 6)


def test_dema():
    v = np.arange(1, 21, dtype=np.float64)
    r = dema(v, period=5)
    assert np.isnan(r[0])
    assert not np.isnan(r[-1])


def test_tema():
    v = np.arange(1, 21, dtype=np.float64)
    r = tema(v, period=5)
    assert np.isnan(r[0])
    assert not np.isnan(r[-1])


def test_macd_basic():
    v = np.arange(1, 51, dtype=np.float64)
    r = macd(v)
    assert "macd" in r and "signal" in r and "histogram" in r
    assert len(r["macd"]) == 50
    assert np.isnan(r["macd"][0])
    assert not np.isnan(r["macd"][-1])


def test_adx_basic():
    h = np.array([10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 11, 10, 9], dtype=np.float64)
    l = np.array([8, 9, 10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7], dtype=np.float64)
    c = np.array([9, 10, 11, 10, 9, 8, 9, 10, 11, 12, 13, 12, 11, 10, 9, 8], dtype=np.float64)
    r = adx(h, l, c, period=5)
    assert "adx" in r and "plus_di" in r and "minus_di" in r
    assert np.isnan(r["adx"][:9]).all()
    assert not np.isnan(r["adx"][-1])


def test_psar_basic():
    h = np.array([10, 11, 12, 11, 10], dtype=np.float64)
    l = np.array([8, 9, 10, 9, 8], dtype=np.float64)
    c = np.array([9, 10, 11, 10, 9], dtype=np.float64)
    r = psar(h, l, c)
    assert "psar" in r and "direction" in r
    assert len(r["psar"]) == 5


def test_ichimoku_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65], dtype=np.float64)  # noqa: E501
    l = h - 2
    c = h - 1
    r = ichimoku(h, l, c)
    assert "tenkan" in r and "kijun" in r and "senkou_a" in r and "senkou_b" in r and "chikou" in r
    assert len(r["tenkan"]) == len(h)


def test_validation_empty():
    with pytest.raises(ValueError):
        sma(np.array([], dtype=np.float64))


def test_validation_short():
    with pytest.raises(ValueError):
        sma(np.array([1.0, 2.0]), period=5)
```

- [ ] **Step 3: Run trend tests**

```bash
cd py-packages/vn-stock-indicators && uv run pytest tests/test_trend.py -v
```

Expected: All ~13 tests PASS.

- [ ] **Step 4: Re-export in `__init__.py`**

Replace the contents of `src/vn_stock_indicators/__init__.py` with:

```python
from vn_stock_indicators.trend import (
    sma, ema, wema, wma, dema, tema, macd, adx, psar, ichimoku,
)

__all__ = [
    "sma", "ema", "wema", "wma", "dema", "tema", "macd", "adx", "psar", "ichimoku",
]
```

- [ ] **Step 5: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): add trend indicators (10 functions) + tests"
```

---

### Task 3: Momentum Indicators (6 functions)

**Files:**
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/momentum.py`
- Create: `py-packages/vn-stock-indicators/tests/test_momentum.py`
- Modify: `py-packages/vn-stock-indicators/src/vn_stock_indicators/__init__.py`

**Interfaces:**
- Produces: `rsi()`, `stochastic()`, `williams_r()`, `cci()`, `mfi()`, `roc()`

- [ ] **Step 1: Create `src/vn_stock_indicators/momentum.py`**

```python
from __future__ import annotations

import numpy as np


def _validate(arr: np.ndarray, name: str, min_len: int = 1) -> None:
    if not isinstance(arr, np.ndarray):
        raise ValueError(f"{name} must be numpy array, got {type(arr).__name__}")
    if arr.size == 0:
        raise ValueError(f"{name} must not be empty")
    if arr.ndim != 1:
        raise ValueError(f"{name} must be 1D, got {arr.ndim}D")
    if len(arr) < min_len:
        raise ValueError(f"{name} needs >= {min_len} elements, got {len(arr)}")


def _ema(values: np.ndarray, period: int) -> np.ndarray:
    result = np.full_like(values, np.nan, dtype=np.float64)
    if period <= 0 or len(values) < period:
        return result
    alpha = 2.0 / (period + 1)
    result[period - 1] = np.mean(values[:period])
    for i in range(period, len(values)):
        result[i] = alpha * values[i] + (1 - alpha) * result[i - 1]
    return result


def rsi(close: np.ndarray, period: int = 14) -> np.ndarray:
    _validate(close, "close", period + 1)
    n = len(close)
    gains = np.maximum(close[1:] - close[:-1], 0)
    losses = np.maximum(close[:-1] - close[1:], 0)

    avg_gain = np.full(n, np.nan, dtype=np.float64)
    avg_loss = np.full(n, np.nan, dtype=np.float64)
    rsi_val = np.full(n, np.nan, dtype=np.float64)

    avg_gain[period] = np.mean(gains[:period])
    avg_loss[period] = np.mean(losses[:period])

    for i in range(period + 1, n):
        avg_gain[i] = (avg_gain[i - 1] * (period - 1) + gains[i - 1]) / period
        avg_loss[i] = (avg_loss[i - 1] * (period - 1) + losses[i - 1]) / period

    for i in range(period, n):
        if avg_loss[i] == 0:
            rsi_val[i] = 100.0
        else:
            rs = avg_gain[i] / avg_loss[i]
            rsi_val[i] = 100 - 100 / (1 + rs)

    return rsi_val


def stochastic(high: np.ndarray, low: np.ndarray, close: np.ndarray, k_period: int = 14, d_period: int = 3) -> dict[str, np.ndarray]:
    _validate(high, "high", k_period)
    _validate(low, "low", k_period)
    _validate(close, "close", k_period)
    n = len(close)

    k_raw = np.full(n, np.nan, dtype=np.float64)
    for i in range(k_period - 1, n):
        hh = np.max(high[i - k_period + 1 : i + 1])
        ll = np.min(low[i - k_period + 1 : i + 1])
        if hh - ll > 0:
            k_raw[i] = 100 * (close[i] - ll) / (hh - ll)
        else:
            k_raw[i] = 50.0

    # %K = SMA of raw K over d_period (or just raw if d_period=1)
    if d_period > 1:
        k_line = np.full(n, np.nan, dtype=np.float64)
        for i in range(d_period - 1, n):
            k_line[i] = np.mean(k_raw[i - d_period + 1 : i + 1])
    else:
        k_line = k_raw.copy()

    # %D = SMA of %K over d_period
    d_line = np.full(n, np.nan, dtype=np.float64)
    for i in range(d_period - 1, n):
        d_line[i] = np.mean(k_line[i - d_period + 1 : i + 1])

    return {"k": k_line.astype(np.float64), "d": d_line.astype(np.float64)}


def williams_r(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> np.ndarray:
    _validate(high, "high", period)
    _validate(low, "low", period)
    _validate(close, "close", period)
    n = len(close)
    result = np.full(n, np.nan, dtype=np.float64)
    for i in range(period - 1, n):
        hh = np.max(high[i - period + 1 : i + 1])
        ll = np.min(low[i - period + 1 : i + 1])
        if hh - ll > 0:
            result[i] = -100 * (hh - close[i]) / (hh - ll)
        else:
            result[i] = -50.0
    return result


def cci(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(high, "high", period)
    _validate(low, "low", period)
    _validate(close, "close", period)
    n = len(close)
    tp = (high + low + close) / 3
    result = np.full(n, np.nan, dtype=np.float64)
    for i in range(period - 1, n):
        sma_tp = np.mean(tp[i - period + 1 : i + 1])
        md = np.mean(np.abs(tp[i - period + 1 : i + 1] - sma_tp))
        if md > 0:
            result[i] = (tp[i] - sma_tp) / (0.015 * md)
    return result


def mfi(high: np.ndarray, low: np.ndarray, close: np.ndarray, volume: np.ndarray, period: int = 14) -> np.ndarray:
    _validate(high, "high", period + 1)
    _validate(low, "low", period + 1)
    _validate(close, "close", period + 1)
    _validate(volume, "volume", period + 1)
    n = len(close)
    tp = (high + low + close) / 3
    mfv = tp * volume

    pos = np.zeros(n, dtype=np.float64)
    neg = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        if tp[i] > tp[i - 1]:
            pos[i] = mfv[i]
            neg[i] = 0.0
        elif tp[i] < tp[i - 1]:
            pos[i] = 0.0
            neg[i] = mfv[i]
        else:
            pos[i] = 0.0
            neg[i] = 0.0

    result = np.full(n, np.nan, dtype=np.float64)
    for i in range(period, n):
        ps = np.sum(pos[i - period + 1 : i + 1])
        ns = np.sum(neg[i - period + 1 : i + 1])
        if ns > 0:
            mfr = ps / ns
            result[i] = 100 - 100 / (1 + mfr)
        else:
            result[i] = 100.0
    return result


def roc(close: np.ndarray, period: int = 12) -> np.ndarray:
    _validate(close, "close", period + 1)
    n = len(close)
    result = np.full(n, np.nan, dtype=np.float64)
    for i in range(period, n):
        if close[i - period] != 0:
            result[i] = 100 * (close[i] - close[i - period]) / close[i - period]
    return result
```

- [ ] **Step 2: Create `tests/test_momentum.py`**

```python
from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.momentum import rsi, stochastic, williams_r, cci, mfi, roc


def test_rsi_known():
    close = np.array([44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60], dtype=np.float64)
    r = rsi(close, period=5)
    assert np.isnan(r[:5]).all()
    assert r[-1] > 50  # uptrend → RSI > 50


def test_rsi_constant():
    close = np.full(20, 50.0, dtype=np.float64)
    r = rsi(close, period=5)
    assert r[-1] == 50.0


def test_stochastic_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], dtype=np.float64)
    l = h - 2
    c = h - 1
    r = stochastic(h, l, c, k_period=5, d_period=3)
    assert "k" in r and "d" in r
    assert np.isnan(r["k"][:4]).all()
    assert not np.isnan(r["k"][-1])


def test_williams_r_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], dtype=np.float64)
    l = h - 2
    c = h - 1
    r = williams_r(h, l, c, period=5)
    assert np.isnan(r[:4]).all()
    assert not np.isnan(r[-1])


def test_cci_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], dtype=np.float64)
    l = h - 2
    c = h - 1
    r = cci(h, l, c, period=5)
    assert np.isnan(r[:4]).all()
    assert not np.isnan(r[-1])


def test_mfi_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], dtype=np.float64)
    l = h - 2
    c = h - 1
    v = np.full(len(h), 1000.0, dtype=np.float64)
    r = mfi(h, l, c, v, period=5)
    assert np.isnan(r[:5]).all()
    assert not np.isnan(r[-1])


def test_roc_basic():
    c = np.arange(10, 30, dtype=np.float64)
    r = roc(c, period=5)
    assert np.isnan(r[:5]).all()
    assert r[-1] == pytest.approx(100 * (29 - 24) / 24)


def test_validation_empty():
    with pytest.raises(ValueError):
        rsi(np.array([], dtype=np.float64))
```

- [ ] **Step 3: Run momentum tests**

```bash
cd py-packages/vn-stock-indicators && uv run pytest tests/test_momentum.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Update `__init__.py`**

Add to imports:

```python
from vn_stock_indicators.momentum import rsi, stochastic, williams_r, cci, mfi, roc
```

Add to `__all__`:

```python
    "rsi", "stochastic", "williams_r", "cci", "mfi", "roc",
```

- [ ] **Step 5: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): add momentum indicators (6 functions) + tests"
```

---

### Task 4: Volatility Indicators (4 functions)

**Files:**
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/volatility.py`
- Create: `py-packages/vn-stock-indicators/tests/test_volatility.py`
- Modify: `py-packages/vn-stock-indicators/src/vn_stock_indicators/__init__.py`

**Interfaces:**
- Produces: `bbands()`, `atr()`, `keltner()`, `donchian()`

- [ ] **Step 1: Create `src/vn_stock_indicators/volatility.py`**

```python
from __future__ import annotations

import numpy as np


def _validate(arr: np.ndarray, name: str, min_len: int = 1) -> None:
    if not isinstance(arr, np.ndarray):
        raise ValueError(f"{name} must be numpy array, got {type(arr).__name__}")
    if arr.size == 0:
        raise ValueError(f"{name} must not be empty")
    if arr.ndim != 1:
        raise ValueError(f"{name} must be 1D, got {arr.ndim}D")
    if len(arr) < min_len:
        raise ValueError(f"{name} needs >= {min_len} elements, got {len(arr)}")


def _sma(values: np.ndarray, period: int) -> np.ndarray:
    result = np.full_like(values, np.nan, dtype=np.float64)
    for i in range(period - 1, len(values)):
        result[i] = np.mean(values[i - period + 1 : i + 1])
    return result


def bbands(close: np.ndarray, period: int = 20, std_dev: float = 2.0) -> dict[str, np.ndarray]:
    _validate(close, "close", period)
    n = len(close)
    middle = np.full(n, np.nan, dtype=np.float64)
    upper = np.full(n, np.nan, dtype=np.float64)
    lower = np.full(n, np.nan, dtype=np.float64)
    bandwidth = np.full(n, np.nan, dtype=np.float64)
    pct_b = np.full(n, np.nan, dtype=np.float64)

    for i in range(period - 1, n):
        window = close[i - period + 1 : i + 1]
        m = np.mean(window)
        s = np.std(window, ddof=0)
        middle[i] = m
        upper[i] = m + std_dev * s
        lower[i] = m - std_dev * s
        bandwidth[i] = 2 * std_dev * s / m if m != 0 else 0
        if upper[i] - lower[i] > 0:
            pct_b[i] = (close[i] - lower[i]) / (upper[i] - lower[i])

    return {
        "upper": upper.astype(np.float64),
        "middle": middle.astype(np.float64),
        "lower": lower.astype(np.float64),
        "bandwidth": bandwidth.astype(np.float64),
        "pct_b": pct_b.astype(np.float64),
    }


def atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> np.ndarray:
    _validate(high, "high", period + 1)
    _validate(low, "low", period + 1)
    _validate(close, "close", period + 1)
    n = len(close)
    tr = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))

    result = np.full(n, np.nan, dtype=np.float64)
    result[period] = np.mean(tr[1 : period + 1])
    alpha = 1.0 / period
    for i in range(period + 1, n):
        result[i] = result[i - 1] + alpha * (tr[i] - result[i - 1])
    return result


def keltner(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 20, multiplier: float = 1.5) -> dict[str, np.ndarray]:
    _validate(high, "high", period)
    _validate(low, "low", period)
    _validate(close, "close", period)
    n = len(close)
    middle = _sma(close, period)
    atr_val = atr(high, low, close, period)
    upper = middle + multiplier * atr_val
    lower = middle - multiplier * atr_val
    return {
        "upper": upper.astype(np.float64),
        "middle": middle.astype(np.float64),
        "lower": lower.astype(np.float64),
    }


def donchian(high: np.ndarray, low: np.ndarray, period: int = 20) -> dict[str, np.ndarray]:
    _validate(high, "high", period)
    _validate(low, "low", period)
    n = len(high)
    upper = np.full(n, np.nan, dtype=np.float64)
    lower = np.full(n, np.nan, dtype=np.float64)
    middle = np.full(n, np.nan, dtype=np.float64)
    for i in range(period - 1, n):
        upper[i] = np.max(high[i - period + 1 : i + 1])
        lower[i] = np.min(low[i - period + 1 : i + 1])
        middle[i] = (upper[i] + lower[i]) / 2
    return {
        "upper": upper.astype(np.float64),
        "middle": middle.astype(np.float64),
        "lower": lower.astype(np.float64),
    }
```

- [ ] **Step 2: Create `tests/test_volatility.py`**

```python
from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.volatility import bbands, atr, keltner, donchian


def test_bbands_basic():
    c = np.arange(1, 31, dtype=np.float64)
    r = bbands(c, period=5)
    assert "upper" in r and "middle" in r and "lower" in r
    assert np.isnan(r["middle"][:4]).all()
    assert r["upper"][-1] > r["middle"][-1] > r["lower"][-1]


def test_bbands_constant():
    c = np.full(20, 50.0, dtype=np.float64)
    r = bbands(c, period=5)
    assert r["upper"][-1] == r["middle"][-1] == r["lower"][-1] == 50.0


def test_atr_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], dtype=np.float64)
    l = h - 2
    c = h - 1
    r = atr(h, l, c, period=5)
    assert np.isnan(r[:5]).all()
    assert r[-1] > 0


def test_keltner_basic():
    h = np.arange(10, 40, dtype=np.float64)
    l = h - 2
    c = h - 1
    r = keltner(h, l, c, period=5)
    assert "upper" in r and "middle" in r and "lower" in r
    assert r["upper"][-1] > r["middle"][-1] > r["lower"][-1]


def test_donchian_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], dtype=np.float64)
    l = h - 2
    r = donchian(h, l, period=5)
    assert "upper" in r and "middle" in r and "lower" in r
    assert r["upper"][-1] > r["middle"][-1] > r["lower"][-1]
```

- [ ] **Step 3: Run volatility tests**

```bash
cd py-packages/vn-stock-indicators && uv run pytest tests/test_volatility.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Update `__init__.py`**

Add to imports:

```python
from vn_stock_indicators.volatility import bbands, atr, keltner, donchian
```

Add to `__all__`:

```python
    "bbands", "atr", "keltner", "donchian",
```

- [ ] **Step 5: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): add volatility indicators (4 functions) + tests"
```

---

### Task 5: Volume Indicators (4 functions)

**Files:**
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/volume.py`
- Create: `py-packages/vn-stock-indicators/tests/test_volume.py`
- Modify: `py-packages/vn-stock-indicators/src/vn_stock_indicators/__init__.py`

**Interfaces:**
- Produces: `obv()`, `volume_sma()`, `vwap()`, `chaikin_mf()`

- [ ] **Step 1: Create `src/vn_stock_indicators/volume.py`**

```python
from __future__ import annotations

import numpy as np


def _validate(arr: np.ndarray, name: str, min_len: int = 1) -> None:
    if not isinstance(arr, np.ndarray):
        raise ValueError(f"{name} must be numpy array, got {type(arr).__name__}")
    if arr.size == 0:
        raise ValueError(f"{name} must not be empty")
    if arr.ndim != 1:
        raise ValueError(f"{name} must be 1D, got {arr.ndim}D")
    if len(arr) < min_len:
        raise ValueError(f"{name} needs >= {min_len} elements, got {len(arr)}")


def obv(close: np.ndarray, volume: np.ndarray) -> np.ndarray:
    _validate(close, "close")
    _validate(volume, "volume")
    n = len(close)
    if len(volume) != n:
        raise ValueError(f"close ({n}) and volume ({len(volume)}) must have same length")
    result = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        if close[i] > close[i - 1]:
            result[i] = result[i - 1] + volume[i]
        elif close[i] < close[i - 1]:
            result[i] = result[i - 1] - volume[i]
        else:
            result[i] = result[i - 1]
    return result


def volume_sma(volume: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(volume, "volume", period)
    result = np.full_like(volume, np.nan, dtype=np.float64)
    for i in range(period - 1, len(volume)):
        result[i] = np.mean(volume[i - period + 1 : i + 1])
    return result


def vwap(high: np.ndarray, low: np.ndarray, close: np.ndarray, volume: np.ndarray) -> np.ndarray:
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    _validate(volume, "volume")
    n = len(close)
    tp = (high + low + close) / 3
    cum_pv = np.cumsum(tp * volume)
    cum_v = np.cumsum(volume)
    result = cum_pv / cum_v
    return result.astype(np.float64)


def chaikin_mf(high: np.ndarray, low: np.ndarray, close: np.ndarray, volume: np.ndarray, period: int = 20) -> np.ndarray:
    _validate(high, "high", period)
    _validate(low, "low", period)
    _validate(close, "close", period)
    _validate(volume, "volume", period)
    n = len(close)
    # Money Flow Multiplier
    mfm = np.zeros(n, dtype=np.float64)
    for i in range(n):
        hl = high[i] - low[i]
        if hl > 0:
            mfm[i] = ((close[i] - low[i]) - (high[i] - close[i])) / hl

    mfv = mfm * volume
    result = np.full(n, np.nan, dtype=np.float64)
    for i in range(period - 1, n):
        result[i] = np.sum(mfv[i - period + 1 : i + 1]) / np.sum(volume[i - period + 1 : i + 1])

    return result
```

- [ ] **Step 2: Create `tests/test_volume.py`**

```python
from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.volume import obv, volume_sma, vwap, chaikin_mf


def test_obv_basic():
    c = np.array([10, 11, 12, 13, 14], dtype=np.float64)
    v = np.array([100, 200, 150, 300, 250], dtype=np.float64)
    r = obv(c, v)
    assert len(r) == 5
    assert r[0] == 0.0
    assert r[1] == 200  # price up → +200
    assert r[2] == 350  # price up → +150
    assert r[3] == 650  # price up → +300


def test_obv_down():
    c = np.array([14, 13, 12, 11, 10], dtype=np.float64)
    v = np.array([100, 200, 150, 300, 250], dtype=np.float64)
    r = obv(c, v)
    assert r[1] == -200  # price down → -200


def test_obv_flat():
    c = np.full(5, 10.0, dtype=np.float64)
    v = np.array([100, 200, 150, 300, 250], dtype=np.float64)
    r = obv(c, v)
    assert all(r == 0)


def test_volume_sma():
    v = np.array([100, 200, 300, 400, 500], dtype=np.float64)
    r = volume_sma(v, period=3)
    assert np.isnan(r[:2]).all()
    assert r[2] == pytest.approx(200.0)
    assert r[4] == pytest.approx(400.0)


def test_vwap():
    h = np.array([12, 14, 16], dtype=np.float64)
    l = np.array([10, 12, 14], dtype=np.float64)
    c = np.array([11, 13, 15], dtype=np.float64)
    v = np.array([100, 200, 300], dtype=np.float64)
    r = vwap(h, l, c, v)
    # tp = [11, 13, 15], cum_pv = [1100, 1100+2600=3700, 3700+4500=8200]
    # cum_v = [100, 300, 600]
    # r = [11, 12.33, 13.67]
    assert r[0] == pytest.approx(11.0)
    assert r[1] == pytest.approx(3700 / 300)
    assert r[2] == pytest.approx(8200 / 600)


def test_chaikin_mf():
    h = np.array([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52], dtype=np.float64)
    l = h - 2
    c = h - 1
    v = np.full(len(h), 1000.0, dtype=np.float64)
    r = chaikin_mf(h, l, c, v, period=5)
    assert np.isnan(r[:4]).all()
    assert not np.isnan(r[-1])
```

- [ ] **Step 3: Run volume tests**

```bash
cd py-packages/vn-stock-indicators && uv run pytest tests/test_volume.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Update `__init__.py`**

Add to imports:

```python
from vn_stock_indicators.volume import obv, volume_sma, vwap, chaikin_mf
```

Add to `__all__`:

```python
    "obv", "volume_sma", "vwap", "chaikin_mf",
```

- [ ] **Step 5: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): add volume indicators (4 functions) + tests"
```

---

### Task 6: Price Action Indicators (5 functions)

**Files:**
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/price_action.py`
- Create: `py-packages/vn-stock-indicators/tests/test_price_action.py`
- Modify: `py-packages/vn-stock-indicators/src/vn_stock_indicators/__init__.py`

**Interfaces:**
- Produces: `support_resistance()`, `pivot_points()`, `detect_engulfing()`, `detect_doji()`, `detect_hammer()`

- [ ] **Step 1: Create `src/vn_stock_indicators/price_action.py`**

```python
from __future__ import annotations

import numpy as np


def _validate(arr: np.ndarray, name: str, min_len: int = 1) -> None:
    if not isinstance(arr, np.ndarray):
        raise ValueError(f"{name} must be numpy array, got {type(arr).__name__}")
    if arr.size == 0:
        raise ValueError(f"{name} must not be empty")
    if arr.ndim != 1:
        raise ValueError(f"{name} must be 1D, got {arr.ndim}D")
    if len(arr) < min_len:
        raise ValueError(f"{name} needs >= {min_len} elements, got {len(arr)}")


def support_resistance(high: np.ndarray, low: np.ndarray, close: np.ndarray, bins: int = 10) -> dict[str, np.ndarray]:
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(close)

    all_prices = np.concatenate([high, low, close])
    if bins <= 0 or bins > n:
        bins = max(1, n // 10)

    hist, edges = np.histogram(all_prices, bins=bins)
    # Find clusters (bins with above-average density)
    threshold = np.mean(hist) + 0.5 * np.std(hist)
    cluster_mask = hist > threshold

    levels = []
    strength_arr = []
    for i in range(len(hist)):
        if cluster_mask[i]:
            level = (edges[i] + edges[i + 1]) / 2
            levels.append(level)
            strength_arr.append(float(hist[i]))

    return {
        "levels": np.array(levels, dtype=np.float64),
        "strength": np.array(strength_arr, dtype=np.float64),
    }


def pivot_points(high: np.ndarray, low: np.ndarray, close: np.ndarray) -> dict[str, np.ndarray]:
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(close)

    pp = np.full(n, np.nan, dtype=np.float64)
    r1 = np.full(n, np.nan, dtype=np.float64)
    r2 = np.full(n, np.nan, dtype=np.float64)
    s1 = np.full(n, np.nan, dtype=np.float64)
    s2 = np.full(n, np.nan, dtype=np.float64)
    r3 = np.full(n, np.nan, dtype=np.float64)
    s3 = np.full(n, np.nan, dtype=np.float64)

    for i in range(1, n):
        pp[i] = (high[i - 1] + low[i - 1] + close[i - 1]) / 3
        r1[i] = 2 * pp[i] - low[i - 1]
        r2[i] = pp[i] + (high[i - 1] - low[i - 1])
        s1[i] = 2 * pp[i] - high[i - 1]
        s2[i] = pp[i] - (high[i - 1] - low[i - 1])
        r3[i] = high[i - 1] + 2 * (pp[i] - low[i - 1])
        s3[i] = low[i - 1] - 2 * (high[i - 1] - pp[i])

    return {
        "pp": pp.astype(np.float64),
        "r1": r1.astype(np.float64),
        "r2": r2.astype(np.float64),
        "s1": s1.astype(np.float64),
        "s2": s2.astype(np.float64),
        "r3": r3.astype(np.float64),
        "s3": s3.astype(np.float64),
    }


def detect_engulfing(open: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray) -> np.ndarray:
    _validate(open, "open")
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(open)
    result = np.zeros(n, dtype=np.int8)  # 0=no, 1=bullish, -1=bearish

    for i in range(1, n):
        prev_bull = close[i - 1] > open[i - 1]
        prev_body = abs(close[i - 1] - open[i - 1])
        curr_body = abs(close[i] - open[i])
        if prev_body == 0 or curr_body == 0:
            continue

        if prev_bull:
            # Bearish engulfing: bearish candle body engulfs previous bullish body
            if close[i] < open[i] and close[i] < open[i - 1] and open[i] > close[i - 1]:
                result[i] = -1  # bearish
        else:
            # Bullish engulfing: bullish candle body engulfs previous bearish body
            if close[i] > open[i] and close[i] > open[i - 1] and open[i] < close[i - 1]:
                result[i] = 1  # bullish

    return result


def detect_doji(open: np.ndarray, close: np.ndarray, body_pct: float = 0.1) -> np.ndarray:
    _validate(open, "open")
    _validate(close, "close")
    n = len(open)
    result = np.zeros(n, dtype=bool)
    for i in range(n):
        body = abs(close[i] - open[i])
        total = abs(close[i]) + abs(open[i])
        if total > 0 and body / max(close[i], open[i]) < body_pct:
            result[i] = True
    return result


def detect_hammer(open: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray, body_pct: float = 0.3, wick_ratio: float = 2.0) -> np.ndarray:
    _validate(open, "open")
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(open)
    result = np.zeros(n, dtype=np.int8)  # 0=no, 1=hammer, -1=shooting star

    for i in range(n):
        body = abs(close[i] - open[i])
        upper_wick = high[i] - max(open[i], close[i])
        lower_wick = min(open[i], close[i]) - low[i]
        total_range = high[i] - low[i]

        if total_range == 0 or body > total_range * body_pct:
            continue

        # Hammer: small body at upper end, long lower wick
        if lower_wick > body * wick_ratio and upper_wick < body * 0.3:
            result[i] = 1  # hammer
        # Shooting star: small body at lower end, long upper wick
        elif upper_wick > body * wick_ratio and lower_wick < body * 0.3:
            result[i] = -1  # shooting star

    return result
```

- [ ] **Step 2: Create `tests/test_price_action.py`**

```python
from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.price_action import (
    support_resistance, pivot_points, detect_engulfing, detect_doji, detect_hammer,
)


def test_support_resistance_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], dtype=np.float64)
    l = h - 2
    c = h - 1
    r = support_resistance(h, l, c, bins=5)
    assert "levels" in r and "strength" in r
    assert len(r["levels"]) > 0


def test_pivot_points_basic():
    h = np.array([12, 13, 14], dtype=np.float64)
    l = np.array([10, 11, 12], dtype=np.float64)
    c = np.array([11, 12, 13], dtype=np.float64)
    r = pivot_points(h, l, c)
    assert "pp" in r and "r1" in r and "s1" in r
    assert np.isnan(r["pp"][0])  # no prev day for idx 0
    assert not np.isnan(r["pp"][1])


def test_detect_engulfing_bullish():
    o = np.array([12, 10], dtype=np.float64)
    h = np.array([13, 14], dtype=np.float64)
    l = np.array([11, 9], dtype=np.float64)
    c = np.array([11, 13], dtype=np.float64)
    r = detect_engulfing(o, h, l, c)
    assert r[1] == 1  # bullish engulfing


def test_detect_engulfing_bearish():
    o = np.array([10, 12], dtype=np.float64)
    h = np.array([12, 13], dtype=np.float64)
    l = np.array([9, 10], dtype=np.float64)
    c = np.array([12, 10], dtype=np.float64)
    r = detect_engulfing(o, h, l, c)
    assert r[1] == -1  # bearish engulfing


def test_detect_doji():
    o = np.array([10, 10, 10], dtype=np.float64)
    c = np.array([10.01, 11, 10.005], dtype=np.float64)
    r = detect_doji(o, c, body_pct=0.1)
    assert r[0] == True   # small body
    assert r[1] == False  # big move
    assert r[2] == True   # tiny body


def test_detect_hammer():
    o = np.array([10, 10], dtype=np.float64)
    h = np.array([10.5, 12], dtype=np.float64)
    l = np.array([9, 9], dtype=np.float64)
    c = np.array([10.3, 10], dtype=np.float64)
    r = detect_hammer(o, h, l, c, body_pct=0.3, wick_ratio=2.0)
    assert r[0] == 1  # hammer (long lower wick)
    assert r[1] == -1  # shooting star (long upper wick)
```

- [ ] **Step 3: Run price action tests**

```bash
cd py-packages/vn-stock-indicators && uv run pytest tests/test_price_action.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Update `__init__.py`**

Add to imports:

```python
from vn_stock_indicators.price_action import (
    support_resistance, pivot_points, detect_engulfing, detect_doji, detect_hammer,
)
```

Add to `__all__`:

```python
    "support_resistance", "pivot_points", "detect_engulfing", "detect_doji", "detect_hammer",
```

- [ ] **Step 5: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): add price action indicators (5 functions) + tests"
```

---

### Task 7: Batch CLI Mode

**Files:**
- Create: `py-packages/vn-stock-indicators/src/vn_stock_indicators/batch.py`
- Create: `py-packages/vn-stock-indicators/tests/test_batch.py`

**Interfaces:**
- Consumes: all indicator functions from trend, momentum, volatility, volume, price_action
- Produces: CLI entry point reading stdin JSON → stdout JSON

- [ ] **Step 1: Create `src/vn_stock_indicators/batch.py`**

```python
#!/usr/bin/env python3
"""Batch CLI: reads OHLCV JSON from stdin, computes requested indicators, writes JSON to stdout."""

from __future__ import annotations

import json
import sys
from typing import Any

import numpy as np

from vn_stock_indicators import trend, momentum, volatility, volume, price_action

INDICATOR_MAP: dict[str, tuple[Any, list[str]]] = {
    # name -> (function, [param_names])
    "sma": (trend.sma, ["period"]),
    "ema": (trend.ema, ["period"]),
    "wema": (trend.wema, ["period"]),
    "wma": (trend.wma, ["period"]),
    "dema": (trend.dema, ["period"]),
    "tema": (trend.tema, ["period"]),
    "macd": (trend.macd, ["fast", "slow", "signal"]),
    "adx": (trend.adx, ["period"]),
    "psar": (trend.psar, ["accel", "max_accel"]),
    "ichimoku": (trend.ichimoku, ["tenkan_period", "kijun_period", "senkou_period"]),
    "rsi": (momentum.rsi, ["period"]),
    "stochastic": (momentum.stochastic, ["k_period", "d_period"]),
    "williams_r": (momentum.williams_r, ["period"]),
    "cci": (momentum.cci, ["period"]),
    "mfi": (momentum.mfi, ["period"]),
    "roc": (momentum.roc, ["period"]),
    "bbands": (volatility.bbands, ["period", "std_dev"]),
    "atr": (volatility.atr, ["period"]),
    "keltner": (volatility.keltner, ["period", "multiplier"]),
    "donchian": (volatility.donchian, ["period"]),
    "obv": (volume.obv, []),
    "volume_sma": (volume.volume_sma, ["period"]),
    "vwap": (volume.vwap, []),
    "chaikin_mf": (volume.chaikin_mf, ["period"]),
    "support_resistance": (price_action.support_resistance, ["bins"]),
    "pivot_points": (price_action.pivot_points, []),
    "detect_engulfing": (price_action.detect_engulfing, []),
    "detect_doji": (price_action.detect_doji, ["body_pct"]),
    "detect_hammer": (price_action.detect_hammer, ["body_pct", "wick_ratio"]),
}


def _to_jsonable(obj: Any) -> Any:
    """Convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(x) for x in obj]
    return obj


def _to_array(v: list[float]) -> np.ndarray:
    return np.array(v, dtype=np.float64)


def _nan_to_none(v: Any) -> Any:
    """Replace NaN with None for JSON."""
    if isinstance(v, np.ndarray):
        return [_nan_to_none(x) for x in v]
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, dict):
        return {k: _nan_to_none(v) for k, v in v.items()}
    if isinstance(v, (list, tuple)):
        return [_nan_to_none(x) for x in v]
    return v


def process_request(request: dict) -> dict:
    """Process a batch request and return results."""
    required = ["close"]
    for field in required:
        if field not in request:
            return {"error": f"Missing required field: {field}"}

    indicators = request.get("indicators", [])
    if not indicators:
        return {"error": "No indicators requested"}

    params = request.get("params", {})

    # Build OHLCV arrays
    close = _to_array(request["close"])
    high = _to_array(request.get("high", request["close"]))
    low = _to_array(request.get("low", request["close"]))
    open_arr = _to_array(request.get("open", request["close"]))
    volume_arr = _to_array(request.get("volume", np.ones(len(close))))

    results: dict[str, Any] = {}

    for name in indicators:
        if name not in INDICATOR_MAP:
            return {"error": f"Unknown indicator: {name}"}

        func, param_names = INDICATOR_MAP[name]
        ind_params = params.get(name, {})

        try:
            # Gather per-indicator params with defaults
            kwargs: dict[str, Any] = {}
            req_ohlcv = {
                "sma": ("close",), "ema": ("close",), "wema": ("close",), "wma": ("close",),
                "dema": ("close",), "tema": ("close",), "macd": ("close",),
                "adx": ("high", "low", "close"), "psar": ("high", "low", "close"),
                "ichimoku": ("high", "low", "close"),
                "rsi": ("close",), "stochastic": ("high", "low", "close"),
                "williams_r": ("high", "low", "close"), "cci": ("high", "low", "close"),
                "mfi": ("high", "low", "close", "volume"), "roc": ("close",),
                "bbands": ("close",), "atr": ("high", "low", "close"),
                "keltner": ("high", "low", "close"), "donchian": ("high", "low"),
                "obv": ("close", "volume"), "volume_sma": ("volume",),
                "vwap": ("high", "low", "close", "volume"),
                "chaikin_mf": ("high", "low", "close", "volume"),
                "support_resistance": ("high", "low", "close"),
                "pivot_points": ("high", "low", "close"),
                "detect_engulfing": ("open", "high", "low", "close"),
                "detect_doji": ("open", "close"),
                "detect_hammer": ("open", "high", "low", "close"),
            }

            arr_map = {
                "open": open_arr, "high": high, "low": low,
                "close": close, "volume": volume_arr,
            }

            args = [arr_map[f] for f in req_ohlcv.get(name, ("close",))]

            for pn in param_names:
                if pn in ind_params:
                    kwargs[pn] = ind_params[pn]

            raw = func(*args, **kwargs)
            clean = _nan_to_none(_to_jsonable(raw))
            results[name] = clean

        except Exception as e:
            return {"error": f"Error computing {name}: {e}"}

    return results


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            json.dump({"error": "Empty input"}, sys.stdout)
            sys.exit(1)
        request = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"error": f"Invalid JSON: {e}"}, sys.stdout)
        sys.exit(1)

    result = process_request(request)
    json.dump(result, sys.stdout, indent=2)
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create `tests/test_batch.py`**

```python
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

BATCH_SCRIPT = Path(__file__).resolve().parents[1] / "src" / "vn_stock_indicators" / "batch.py"


def _run_batch(input_data: dict) -> dict:
    result = subprocess.run(
        [sys.executable, str(BATCH_SCRIPT)],
        input=json.dumps(input_data),
        capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def test_batch_basic():
    close = list(range(1, 31))
    result = _run_batch({
        "close": close,
        "indicators": ["sma", "rsi"],
        "params": {"sma": {"period": 5}, "rsi": {"period": 5}},
    })
    assert "sma" in result
    assert "rsi" in result
    assert len(result["sma"]) == 30
    assert len(result["rsi"]) == 30


def test_batch_unknown_indicator():
    result = _run_batch({
        "close": [1, 2, 3],
        "indicators": ["nonexistent"],
    })
    assert "error" in result


def test_batch_missing_close():
    result = _run_batch({
        "indicators": ["sma"],
    })
    assert "error" in result


def test_batch_empty_indicators():
    result = _run_batch({
        "close": [1, 2, 3],
        "indicators": [],
    })
    assert "error" in result
    assert "No indicators requested" in result["error"]


def test_batch_macd():
    close = list(range(1, 51))
    result = _run_batch({
        "close": close,
        "indicators": ["macd"],
    })
    assert "macd" in result
    assert "macd" in result["macd"] or isinstance(result["macd"], dict)
    # macd returns dict, so batch should return dict
    assert isinstance(result["macd"], dict)


def test_batch_invalid_json():
    result = subprocess.run(
        [sys.executable, str(BATCH_SCRIPT)],
        input="not json",
        capture_output=True, text=True,
    )
    output = json.loads(result.stdout)
    assert "error" in output
    assert "Invalid JSON" in output["error"]
```

- [ ] **Step 3: Run all tests to verify nothing broken**

```bash
cd py-packages/vn-stock-indicators && uv run pytest -v
```

Expected: All 40+ tests PASS.

- [ ] **Step 4: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "feat(vn-stock-indicators): add batch CLI mode + integration tests"
```

---

### Task 8: README + Finalize

**Files:**
- Create: `py-packages/vn-stock-indicators/README.md`
- Modify: (root) `README.md` (add Python section)

- [ ] **Step 1: Create `py-packages/vn-stock-indicators/README.md`**

```markdown
# vn-stock-indicators

Pure Python technical indicators for VN stock market analysis. Numpy-based, stateless, batch CLI-ready.

## Installation

```bash
cd py-packages/vn-stock-indicators && uv sync
```

## Usage

### Python API

```python
import numpy as np
from vn_stock_indicators import sma, ema, rsi, bbands, macd

close = np.array([...], dtype=np.float64)

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
```

- [ ] **Step 2: Run final test suite + ruff check**

```bash
cd py-packages/vn-stock-indicators && uv run pytest -v && uv run ruff check src/
```

Expected: All tests PASS, ruff reports no issues.

- [ ] **Step 3: Commit**

```bash
git add py-packages/vn-stock-indicators/
git commit -m "docs(vn-stock-indicators): add README with usage examples"
```

---

## Self-Review

After writing all 8 tasks, verify:

1. **Spec coverage:** Every indicator from the spec is implemented:
   - Trend (10): sma ✓, ema ✓, wema ✓, wma ✓, dema ✓, tema ✓, macd ✓, adx ✓, psar ✓, ichimoku ✓
   - Momentum (6): rsi ✓, stochastic ✓, williams_r ✓, cci ✓, mfi ✓, roc ✓
   - Volatility (4): bbands ✓, atr ✓, keltner ✓, donchian ✓
   - Volume (4): obv ✓, volume_sma ✓, vwap ✓, chaikin_mf ✓
   - Price Action (5): support_resistance ✓, pivot_points ✓, detect_engulfing ✓, detect_doji ✓, detect_hammer ✓
   - Batch CLI ✓, Error handling (ValueError, NaN, batch JSON parse) ✓

2. **Placeholder scan:** No TBD, TODO, "implement later", or missing code blocks.

3. **Type consistency:** All functions follow same signature pattern. `np.ndarray` inputs, `np.ndarray | dict[str, np.ndarray]` outputs. Validation function `_validate()` used consistently.
