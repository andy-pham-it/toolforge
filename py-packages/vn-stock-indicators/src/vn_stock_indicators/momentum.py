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
    result[period - 1] = np.nanmean(values[:period])
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
        if avg_loss[i] == 0 and avg_gain[i] == 0:
            rsi_val[i] = 50.0  # Neutral — no price movement
        elif avg_loss[i] == 0:
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


def roc(close: np.ndarray, period: int = 10) -> np.ndarray:
    _validate(close, "close", period + 1)
    n = len(close)
    result = np.full(n, np.nan, dtype=np.float64)
    for i in range(period, n):
        result[i] = 100 * (close[i] - close[i - period]) / close[i - period]
    return result
