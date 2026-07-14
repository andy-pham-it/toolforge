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
