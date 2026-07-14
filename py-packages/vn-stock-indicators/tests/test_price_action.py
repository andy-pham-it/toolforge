from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.price_action import (
    support_resistance,
    pivot_points,
    detect_engulfing,
    detect_doji,
    detect_hammer,
)


def test_support_resistance_basic():
    h = np.array(
        [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        dtype=np.float64,
    )
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
    assert np.isnan(r["pp"][0])
    assert not np.isnan(r["pp"][1])


def test_pivot_points_edge():
    """2 points only — should still produce pp from index 1."""
    h = np.array([10, 12], dtype=np.float64)
    l = np.array([8, 10], dtype=np.float64)
    c = np.array([9, 11], dtype=np.float64)
    r = pivot_points(h, l, c)
    assert np.isnan(r["pp"][0])
    assert not np.isnan(r["pp"][1])
    assert r["pp"][1] == pytest.approx((10 + 8 + 9) / 3)


def test_detect_engulfing_bullish():
    o = np.array([12, 10], dtype=np.float64)
    h = np.array([13, 14], dtype=np.float64)
    l = np.array([11, 9], dtype=np.float64)
    c = np.array([11, 13], dtype=np.float64)
    r = detect_engulfing(o, h, l, c)
    assert r[1] == 1


def test_detect_engulfing_bearish():
    """Previous bullish (o=10,c=12) → current bearish engulfs (o=14 > prev.c, c=9 < prev.o)."""
    o = np.array([10, 14], dtype=np.float64)
    h = np.array([12, 14], dtype=np.float64)
    l = np.array([9, 9], dtype=np.float64)
    c = np.array([12, 9], dtype=np.float64)
    r = detect_engulfing(o, h, l, c)
    assert r[1] == -1


def test_detect_engulfing_no_signal():
    """Consecutive bullish candles should not trigger engulfing."""
    o = np.array([10, 12], dtype=np.float64)
    h = np.array([12, 14], dtype=np.float64)
    l = np.array([9, 11], dtype=np.float64)
    c = np.array([12, 14], dtype=np.float64)
    r = detect_engulfing(o, h, l, c)
    assert r[1] == 0


def test_detect_doji():
    """idx0: body 0.01 vs max 10 ≈ 0.1% → doji (True); idx1: body 2 vs max 12 ≈ 16.7% → not doji (False); idx2: body 0.005 vs max 10 ≈ 0.05% → doji (True)."""
    o = np.array([10, 10, 10], dtype=np.float64)
    c = np.array([10.01, 12, 10.005], dtype=np.float64)
    r = detect_doji(o, c, body_pct=0.1)
    assert r[0] == True
    assert r[1] == False
    assert r[2] == True


def test_detect_doji_all_same():
    """All identical price → body=0, body/max=0 → doji by definition."""
    o = np.array([10, 10], dtype=np.float64)
    c = np.array([10, 10], dtype=np.float64)
    r = detect_doji(o, c, body_pct=0.1)
    assert r[0] == True
    assert r[1] == True


def test_detect_hammer():
    """idx0: o=10,c=10.3 (bullish), low wick=0.7 > body*2=0.6, upper wick=0.08 < body*0.3=0.09 → hammer=1.
    idx1: o=11,c=10 (bearish), upper wick=2.1 > body*2=2, lower wick=0.29 < body*0.3=0.3 → shooting star=-1."""
    o = np.array([10, 11], dtype=np.float64)
    h = np.array([10.38, 13.1], dtype=np.float64)
    l = np.array([9.3, 9.71], dtype=np.float64)
    c = np.array([10.3, 10], dtype=np.float64)
    r = detect_hammer(o, h, l, c, body_pct=0.3, wick_ratio=2.0)
    assert r[0] == 1
    assert r[1] == -1


def test_detect_hammer_no_signal():
    """Doji-like candle — should not trigger hammer."""
    o = np.array([10], dtype=np.float64)
    h = np.array([10.5], dtype=np.float64)
    l = np.array([9.5], dtype=np.float64)
    c = np.array([10], dtype=np.float64)
    r = detect_hammer(o, h, l, c, body_pct=0.3, wick_ratio=2.0)
    assert r[0] == 0
