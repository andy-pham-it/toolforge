from __future__ import annotations

import numpy as np
import pytest

from vn_stock_indicators.volume import ad, adosc, obv, volume_profile


def _series(*vals: float) -> np.ndarray:
    return np.array(vals, dtype=np.float64)


# ── OBV ──


def test_obv_basic():
    close = _series(10, 12, 11, 13, 15)
    volume = _series(1000, 1500, 1200, 1800, 2000)
    result = obv(close, volume)
    # OBV[0] = volume[0]
    assert result[0] == 1000.0
    # close[1] > close[0] → add
    assert result[1] == 1000 + 1500
    # close[2] < close[1] → subtract
    assert result[2] == 1000 + 1500 - 1200
    # close[3] > close[2] → add
    assert result[3] == 1000 + 1500 - 1200 + 1800


def test_obv_identical_close():
    close = np.full(5, 10.0, dtype=np.float64)
    volume = _series(100, 200, 300, 400, 500)
    result = obv(close, volume)
    assert result[0] == 100.0
    # No change → all subsequent OBV = same as first
    assert result[-1] == 100.0


def test_obv_empty():
    with pytest.raises(ValueError):
        obv(np.array([]), np.array([]))


# ── Volume Profile (VWAP + VWAP bands) ──


def test_vwap_basic():
    close = _series(10, 11, 12, 13, 14, 15, 16, 17, 18, 19)
    volume = _series(1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900)
    vp = volume_profile(close, volume, period=5)
    assert "vwap" in vp
    assert "vwap_high" in vp
    assert "vwap_low" in vp
    assert len(vp["vwap"]) == 10
    assert np.isnan(vp["vwap"][:4]).all()
    # VWAP = sum(price * volume) / sum(volume)
    seg_close = close[:5]
    seg_vol = volume[:5]
    expected = np.average(seg_close, weights=seg_vol)
    assert np.isclose(vp["vwap"][4], expected)


def test_vwap_constant():
    close = np.full(10, 10.0, dtype=np.float64)
    volume = np.full(10, 1000.0, dtype=np.float64)
    vp = volume_profile(close, volume, period=5)
    assert np.isclose(vp["vwap"][-1], 10.0)


def test_vwap_too_short():
    close = _series(1, 2, 3)
    volume = _series(100, 200, 300)
    with pytest.raises(ValueError, match="needs >= 6"):
        volume_profile(close, volume, period=5)


# ── Accumulation/Distribution ──


def test_ad_basic():
    high = _series(12, 13, 14, 15, 16)
    low = _series(10, 11, 11, 12, 13)
    close = _series(11, 12, 13, 14, 15)
    volume = _series(1000, 1500, 1200, 1800, 2000)
    result = ad(high, low, close, volume)
    assert len(result) == 5
    assert not np.isnan(result[-1])


def test_ad_high_eq_low():
    high = np.full(5, 10.0, dtype=np.float64)
    low = np.full(5, 10.0, dtype=np.float64)
    close = np.full(5, 10.0, dtype=np.float64)
    volume = _series(1000, 1500, 1200, 1800, 2000)
    result = ad(high, low, close, volume)
    # When high=low, MF multiplier = (2*close - high - low)/(high-low) would
    # be division by zero → MF = 0 → no change in A/D
    assert result[-1] == 1000.0  # Only initial volume


# ── A/D Oscillator ──


def test_adosc_basic():
    high = _series(12, 13, 14, 15, 16, 17, 18, 19, 20, 21)
    low = _series(10, 11, 11, 12, 13, 14, 14, 15, 16, 17)
    close = _series(11, 12, 13, 14, 15, 16, 17, 18, 19, 20)
    volume = _series(1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900)
    result = adosc(high, low, close, volume, fast_period=3, slow_period=5)
    assert len(result) == 10
    assert np.isnan(result[:4]).all()  # slow_period - 1 = 4 NaN
    assert not np.isnan(result[-1])


def test_adosc_too_short():
    high = _series(12, 13, 14)
    low = _series(10, 11, 11)
    close = _series(11, 12, 13)
    volume = _series(1000, 1100, 1200)
    with pytest.raises(ValueError):
        adosc(high, low, close, volume, fast_period=3, slow_period=5)


# ── Validation ──


def test_validation_empty():
    for fn in [obv]:
        with pytest.raises(ValueError):
            fn(np.array([]), np.array([]))
    empty = np.array([], dtype=np.float64)
    with pytest.raises(ValueError):
        ad(empty, empty, empty, empty)
