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


def support_resistance(
    high: np.ndarray, low: np.ndarray, close: np.ndarray, bins: int = 10
) -> dict[str, np.ndarray]:
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(close)

    all_prices = np.concatenate([high, low, close])
    if bins <= 0 or bins > n:
        bins = max(1, n // 10)

    hist, edges = np.histogram(all_prices, bins=bins)
    threshold = float(np.mean(hist) + 0.5 * np.std(hist))
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


def pivot_points(
    high: np.ndarray, low: np.ndarray, close: np.ndarray
) -> dict[str, np.ndarray]:
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
        pp[i] = float((high[i - 1] + low[i - 1] + close[i - 1]) / 3)
        r1[i] = float(2 * pp[i] - low[i - 1])
        r2[i] = float(pp[i] + (high[i - 1] - low[i - 1]))
        s1[i] = float(2 * pp[i] - high[i - 1])
        s2[i] = float(pp[i] - (high[i - 1] - low[i - 1]))
        r3[i] = float(high[i - 1] + 2 * (pp[i] - low[i - 1]))
        s3[i] = float(low[i - 1] - 2 * (high[i - 1] - pp[i]))

    return {
        "pp": pp.astype(np.float64),
        "r1": r1.astype(np.float64),
        "r2": r2.astype(np.float64),
        "s1": s1.astype(np.float64),
        "s2": s2.astype(np.float64),
        "r3": r3.astype(np.float64),
        "s3": s3.astype(np.float64),
    }


def detect_engulfing(
    open: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray
) -> np.ndarray:
    _validate(open, "open")
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(open)
    result = np.zeros(n, dtype=np.int8)

    for i in range(1, n):
        prev_bull = bool(close[i - 1] > open[i - 1])
        prev_body = float(abs(close[i - 1] - open[i - 1]))
        curr_body = float(abs(close[i] - open[i]))
        if prev_body == 0 or curr_body == 0:
            continue

        if prev_bull:
            if (
                close[i] < open[i]
                and close[i] < open[i - 1]
                and open[i] > close[i - 1]
            ):
                result[i] = -1
        else:
            if (
                close[i] > open[i]
                and close[i] > open[i - 1]
                and open[i] < close[i - 1]
            ):
                result[i] = 1

    return result


def detect_doji(
    open: np.ndarray, close: np.ndarray, body_pct: float = 0.1
) -> np.ndarray:
    _validate(open, "open")
    _validate(close, "close")
    n = len(open)
    result = np.zeros(n, dtype=bool)
    for i in range(n):
        body = float(abs(close[i] - open[i]))
        total = float(abs(close[i]) + abs(open[i]))
        if total > 0 and body / max(close[i], open[i]) < body_pct:
            result[i] = True
    return result


def detect_hammer(
    open: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    body_pct: float = 0.3,
    wick_ratio: float = 2.0,
) -> np.ndarray:
    _validate(open, "open")
    _validate(high, "high")
    _validate(low, "low")
    _validate(close, "close")
    n = len(open)
    result = np.zeros(n, dtype=np.int8)

    for i in range(n):
        body = float(abs(close[i] - open[i]))
        upper_wick = float(high[i] - max(open[i], close[i]))
        lower_wick = float(min(open[i], close[i]) - low[i])
        total_range = float(high[i] - low[i])

        if total_range == 0 or body > total_range * body_pct:
            continue

        if lower_wick > body * wick_ratio and upper_wick < body * 0.3:
            result[i] = 1
        elif upper_wick > body * wick_ratio and lower_wick < body * 0.3:
            result[i] = -1

    return result
