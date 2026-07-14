from __future__ import annotations

import numpy as np
import pytest
from vn_stock_indicators.trend import (
    sma, ema, wema, wma, dema, tema, macd, adx, psar, ichimoku,
)


def test_sma_basic():
    v = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], dtype=np.float64)
    r = sma(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    assert r[2] == pytest.approx(2.0)
    assert r[9] == pytest.approx(9.0)


def test_sma_constant():
    v = np.full(10, 5.0, dtype=np.float64)
    r = sma(v, period=3)
    assert r[9] == pytest.approx(5.0)


def test_ema_basic():
    v = np.arange(1, 11, dtype=np.float64)
    r = ema(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    assert not np.isnan(r[2])
    assert r[9] > 0


def test_wema():
    v = np.arange(1, 11, dtype=np.float64)
    r = wema(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    assert not np.isnan(r[2])


def test_wma():
    v = np.array([1, 2, 3, 4, 5], dtype=np.float64)
    r = wma(v, period=3)
    assert np.isnan(r[0]) and np.isnan(r[1])
    # weights: [1,2,3], sum=6, value for idx2 = (1*1 + 2*2 + 3*3)/6 = 14/6 approx 2.333
    assert r[2] == pytest.approx(14 / 6)


def test_dema():
    v = np.arange(1, 21, dtype=np.float64)
    r = dema(v, period=5)
    assert np.isnan(r[0])
    assert not np.isnan(r[-1])


def test_tema():
    v = np.arange(1, 21, dtype=np.float64)
    r = tema(v, period=5)
    assert np.isnan(r[0])
    assert not np.isnan(r[-1])


def test_macd_basic():
    v = np.arange(1, 51, dtype=np.float64)
    r = macd(v)
    assert "macd" in r and "signal" in r and "histogram" in r
    assert len(r["macd"]) == 50
    assert np.isnan(r["macd"][0])
    assert not np.isnan(r["macd"][-1])


def test_adx_basic():
    h = np.array([10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 11, 10, 9], dtype=np.float64)
    l = np.array([8, 9, 10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7], dtype=np.float64)
    c = np.array([9, 10, 11, 10, 9, 8, 9, 10, 11, 12, 13, 12, 11, 10, 9, 8], dtype=np.float64)
    r = adx(h, l, c, period=5)
    assert "adx" in r and "plus_di" in r and "minus_di" in r
    assert np.isnan(r["adx"][:9]).all()
    assert not np.isnan(r["adx"][-1])


def test_psar_basic():
    h = np.array([10, 11, 12, 11, 10], dtype=np.float64)
    l = np.array([8, 9, 10, 9, 8], dtype=np.float64)
    c = np.array([9, 10, 11, 10, 9], dtype=np.float64)
    r = psar(h, l, c)
    assert "psar" in r and "direction" in r
    assert len(r["psar"]) == 5


def test_ichimoku_basic():
    h = np.array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65], dtype=np.float64)
    l = h - 2
    c = h - 1
    r = ichimoku(h, l, c)
    assert "tenkan" in r and "kijun" in r and "senkou_a" in r and "senkou_b" in r and "chikou" in r
    assert len(r["tenkan"]) == len(h)


def test_validation_empty():
    with pytest.raises(ValueError):
        sma(np.array([], dtype=np.float64))


def test_validation_short():
    with pytest.raises(ValueError):
        sma(np.array([1.0, 2.0]), period=5)
