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
