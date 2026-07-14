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
    _validate(close, "close", 1)
    _validate(volume, "volume", 1)
    n = len(close)
    result = np.empty(n, dtype=np.float64)
    result[0] = volume[0]
    for i in range(1, n):
        if close[i] > close[i - 1]:
            result[i] = result[i - 1] + volume[i]
        elif close[i] < close[i - 1]:
            result[i] = result[i - 1] - volume[i]
        else:
            result[i] = result[i - 1]
    return result


def volume_profile(
    close: np.ndarray,
    volume: np.ndarray,
    period: int = 20,
) -> dict[str, np.ndarray]:
    _validate(close, "close", period + 1)
    _validate(volume, "volume", period + 1)
    n = len(close)
    vwap = np.full(n, np.nan, dtype=np.float64)

    for i in range(period - 1, n):
        seg_close = close[i - period + 1 : i + 1]
        seg_vol = volume[i - period + 1 : i + 1]
        total_vol = np.sum(seg_vol)
        if total_vol > 0:
            vwap[i] = np.sum(seg_close * seg_vol) / total_vol

    # VWAP high/low = max/min close within the window (simple proxy)
    vwap_high = np.full(n, np.nan, dtype=np.float64)
    vwap_low = np.full(n, np.nan, dtype=np.float64)
    for i in range(period - 1, n):
        seg_close = close[i - period + 1 : i + 1]
        vwap_high[i] = np.max(seg_close)
        vwap_low[i] = np.min(seg_close)

    return {"vwap": vwap, "vwap_high": vwap_high, "vwap_low": vwap_low}


def ad(
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    volume: np.ndarray,
) -> np.ndarray:
    _validate(high, "high", 1)
    _validate(low, "low", 1)
    _validate(close, "close", 1)
    _validate(volume, "volume", 1)
    n = len(close)
    result = np.empty(n, dtype=np.float64)
    result[0] = volume[0]
    for i in range(1, n):
        hl = high[i] - low[i]
        if hl > 0:
            mf_mult = ((close[i] - low[i]) - (high[i] - close[i])) / hl
            mfv = mf_mult * volume[i]
        else:
            mfv = 0.0
        result[i] = result[i - 1] + mfv
    return result


def adosc(
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    volume: np.ndarray,
    fast_period: int = 3,
    slow_period: int = 10,
) -> np.ndarray:
    _validate(high, "high", slow_period)
    _validate(low, "low", slow_period)
    _validate(close, "close", slow_period)
    _validate(volume, "volume", slow_period)
    n = len(close)
    ad_vals = ad(high, low, close, volume)
    result = np.full(n, np.nan, dtype=np.float64)

    # Fast EMA
    fast_alpha = 2.0 / (fast_period + 1)
    fast_ema = np.full(n, np.nan, dtype=np.float64)
    fast_ema[fast_period - 1] = np.mean(ad_vals[:fast_period])
    for i in range(fast_period, n):
        fast_ema[i] = fast_alpha * ad_vals[i] + (1 - fast_alpha) * fast_ema[i - 1]

    # Slow EMA
    slow_alpha = 2.0 / (slow_period + 1)
    slow_ema = np.full(n, np.nan, dtype=np.float64)
    slow_ema[slow_period - 1] = np.mean(ad_vals[:slow_period])
    for i in range(slow_period, n):
        slow_ema[i] = slow_alpha * ad_vals[i] + (1 - slow_alpha) * slow_ema[i - 1]

    # Difference = A/D Oscillator
    for i in range(slow_period - 1, n):
        result[i] = fast_ema[i] - slow_ema[i]

    return result
