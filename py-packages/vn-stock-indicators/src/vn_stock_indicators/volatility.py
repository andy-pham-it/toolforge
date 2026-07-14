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


def bollinger_bands(
    close: np.ndarray,
    period: int = 20,
    std_dev: float = 2.0,
) -> dict[str, np.ndarray]:
    _validate(close, "close", 1)
    n = len(close)
    upper = np.full(n, np.nan, dtype=np.float64)
    middle = np.full(n, np.nan, dtype=np.float64)
    lower = np.full(n, np.nan, dtype=np.float64)
    bandwidth = np.full(n, np.nan, dtype=np.float64)
    percent_b = np.full(n, np.nan, dtype=np.float64)

    for i in range(period - 1, n):
        seg = close[i - period + 1 : i + 1]
        mu = np.mean(seg)
        sigma = np.std(seg, ddof=0)
        middle[i] = mu
        upper[i] = mu + std_dev * sigma
        lower[i] = mu - std_dev * sigma
        bandwidth[i] = (upper[i] - lower[i]) / mu if mu != 0 else 0.0
        if upper[i] - lower[i] > 0:
            percent_b[i] = (close[i] - lower[i]) / (upper[i] - lower[i])
        else:
            percent_b[i] = 0.5  # Flat band → price at middle

    return {
        "upper": upper,
        "middle": middle,
        "lower": lower,
        "bandwidth": bandwidth,
        "percent_b": percent_b,
    }


def atr(
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    period: int = 14,
) -> np.ndarray:
    _validate(high, "high", 2)
    _validate(low, "low", 2)
    _validate(close, "close", 2)
    n = len(close)
    tr = np.full(n, np.nan, dtype=np.float64)
    # True Range at index 0 is just high-low (no prev close)
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        tr[i] = max(
            high[i] - low[i],
            abs(high[i] - close[i - 1]),
            abs(low[i] - close[i - 1]),
        )

    result = np.full(n, np.nan, dtype=np.float64)
    if n < period:
        return result

    result[period - 1] = np.mean(tr[:period])
    # Wilder's smoothing: ATR = (prev ATR * (period-1) + current TR) / period
    for i in range(period, n):
        result[i] = (result[i - 1] * (period - 1) + tr[i]) / period

    return result


def keltner(
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    period: int = 20,
    atr_mult: float = 2.0,
) -> dict[str, np.ndarray]:
    _validate(high, "high", period)
    _validate(low, "low", period)
    _validate(close, "close", period)
    n = len(close)

    # Middle = EMA of close
    alpha = 2.0 / (period + 1)
    middle = np.full(n, np.nan, dtype=np.float64)
    middle[period - 1] = np.mean(close[:period])
    for i in range(period, n):
        middle[i] = alpha * close[i] + (1 - alpha) * middle[i - 1]

    # ATR-based channel width
    atr_vals = atr(high, low, close, period)

    upper = middle + atr_mult * atr_vals
    lower = middle - atr_mult * atr_vals

    return {"upper": upper.astype(np.float64), "middle": middle, "lower": lower.astype(np.float64)}


def volatility(
    close: np.ndarray,
    period: int = 20,
    annualize: bool = False,
) -> np.ndarray:
    _validate(close, "close", period + 1)
    n = len(close)
    logs = np.diff(np.log(close))
    result = np.full(n, np.nan, dtype=np.float64)

    for i in range(period, n):
        seg = logs[i - period : i]
        sigma = np.std(seg, ddof=1)  # Sample standard deviation
        result[i] = sigma

    if annualize:
        result *= np.sqrt(252)

    return result
