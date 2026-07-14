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
    result[period - 1] = np.nanmean(values[:period])
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
    result[period - 1] = np.nanmean(values[:period])
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
    str_arr = np.full(n, np.nan, dtype=np.float64)
    sup = np.full(n, np.nan, dtype=np.float64)
    sdown = np.full(n, np.nan, dtype=np.float64)

    str_arr[period] = np.sum(tr[1:period+1])
    sup[period] = np.sum(up[1:period+1])
    sdown[period] = np.sum(down[1:period+1])

    for i in range(period + 1, n):
        str_arr[i] = str_arr[i-1] + alpha * (tr[i] - str_arr[i-1])
        sup[i] = sup[i-1] + alpha * (up[i] - sup[i-1])
        sdown[i] = sdown[i-1] + alpha * (down[i] - sdown[i-1])

    pdi = np.full(n, np.nan, dtype=np.float64)
    mdi = np.full(n, np.nan, dtype=np.float64)
    adx_val = np.full(n, np.nan, dtype=np.float64)

    for i in range(period, n):
        if str_arr[i] > 0:
            pdi[i] = 100 * sup[i] / str_arr[i]
            mdi[i] = 100 * sdown[i] / str_arr[i]

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
