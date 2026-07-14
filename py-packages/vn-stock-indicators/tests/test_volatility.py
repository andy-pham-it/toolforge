from __future__ import annotations

import numpy as np
import pytest

from vn_stock_indicators.volatility import (
    atr,
    bollinger_bands,
    keltner,
    volatility,
)


def _series(*vals: float) -> np.ndarray:
    return np.array(vals, dtype=np.float64)


# ── Bollinger Bands ──


def test_bb_basic():
    close = _series(*range(20, 40))  # 0..19 → 20..39
    bb = bollinger_bands(close, period=5, std_dev=2)
    assert "upper" in bb
    assert "middle" in bb
    assert "lower" in bb
    assert "bandwidth" in bb
    assert "percent_b" in bb
    # Middle = SMA
    assert np.isclose(bb["middle"][-1], np.mean(close[-5:]))
    # Upper > Lower
    assert bb["upper"][-1] > bb["lower"][-1]
    # bandwidth > 0
    assert bb["bandwidth"][-1] > 0
    # percent_b between 0 and 1 for middle value
    assert 0.0 <= bb["percent_b"][-1] <= 1.0


def test_bb_constant():
    close = np.full(20, 50.0, dtype=np.float64)
    bb = bollinger_bands(close, period=10, std_dev=2)
    # Zero std → bandwidth=0, percent_b=0.5 (price at middle)
    assert bb["bandwidth"][-1] == 0.0
    assert bb["percent_b"][-1] == 0.5
    assert bb["upper"][-1] == 50.0
    assert bb["lower"][-1] == 50.0


def test_bb_single_period():
    close = _series(1.0, 2.0, 3.0)
    bb = bollinger_bands(close, period=5, std_dev=2)
    assert np.isnan(bb["upper"][-1])


# ── ATR ──


def test_atr_basic():
    high = _series(12, 13, 14, 15, 16, 17, 18, 19, 20, 21)
    low = _series(10, 11, 11, 12, 13, 14, 14, 15, 16, 17)
    close = _series(11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
    result = atr(high, low, close, period=5)
    assert len(result) == 10
    assert np.isnan(result[0])
    assert result[-1] > 0  # Some volatility present


def test_atr_constant_range():
    high = np.full(20, 15.0, dtype=np.float64)
    low = np.full(20, 10.0, dtype=np.float64)
    close = np.full(20, 12.5, dtype=np.float64)
    result = atr(high, low, close, period=5)
    # Constant range → ATR converges to 5 (high-low)
    assert np.isclose(result[-1], 5.0, rtol=0.3)


def test_atr_too_short():
    high = _series(1, 2, 3)
    low = _series(0, 1, 2)
    close = _series(1, 2, 3)
    result = atr(high, low, close, period=10)
    assert np.isnan(result[-1])


# ── Keltner Channels ──


def test_keltner_basic():
    high = _series(12, 13, 14, 15, 16, 17, 18, 19, 20, 21)
    low = _series(10, 11, 11, 12, 13, 14, 14, 15, 16, 17)
    close = _series(11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
    kc = keltner(high, low, close, period=5, atr_mult=2)
    assert "upper" in kc
    assert "middle" in kc
    assert "lower" in kc
    assert kc["upper"][-1] > kc["lower"][-1]
    assert not np.isnan(kc["middle"][-1])
    assert not np.isnan(kc["upper"][-1])


def test_keltner_constant():
    high = np.full(20, 15.0, dtype=np.float64)
    low = np.full(20, 15.0, dtype=np.float64)
    close = np.full(20, 15.0, dtype=np.float64)
    kc = keltner(high, low, close, period=5, atr_mult=2)
    assert np.isclose(kc["upper"][-1], 15.0)
    assert np.isclose(kc["lower"][-1], 15.0)


# ── Volatility (historic) ──


def test_vol_basic():
    close = _series(100, 102, 101, 103, 104, 106, 105, 107, 108, 110)
    result = volatility(close, period=5, annualize=False)
    assert len(result) == 10
    assert np.isnan(result[:5]).all()
    assert result[-1] > 0


def test_vol_annualize():
    close = _series(100, 102, 101, 103, 104, 106, 105, 107, 108, 110)
    raw = volatility(close, period=5, annualize=False)
    ann = volatility(close, period=5, annualize=True)
    assert np.isclose(ann[-1], raw[-1] * np.sqrt(252), rtol=1e-9)


def test_vol_constant():
    close = np.full(20, 50.0, dtype=np.float64)
    result = volatility(close, period=5, annualize=False)
    assert result[-1] == 0.0


def test_vol_too_short():
    close = _series(1, 2, 3)
    with pytest.raises(ValueError, match="needs >= 11"):
        volatility(close, period=10, annualize=False)


# ── Validation ──


def test_validation_empty():
    for fn in [atr, volatility]:
        with pytest.raises(ValueError, match="must not be empty"):
            fn(np.array([]), np.array([]), np.array([]))

    empty = np.array([], dtype=np.float64)
    with pytest.raises(ValueError):
        bollinger_bands(empty)
    with pytest.raises(ValueError):
        keltner(empty, empty, empty)
