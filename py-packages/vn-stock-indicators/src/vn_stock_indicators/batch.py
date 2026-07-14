#!/usr/bin/env python3
"""Batch CLI: reads OHLCV JSON from stdin, computes requested indicators, writes JSON to stdout."""

from __future__ import annotations

import importlib
import json
import sys
from typing import Any, TextIO

import numpy as np

trend = importlib.import_module("vn_stock_indicators.trend")
momentum = importlib.import_module("vn_stock_indicators.momentum")
volatility_mod = importlib.import_module("vn_stock_indicators.volatility")
volume_mod = importlib.import_module("vn_stock_indicators.volume")
price_action = importlib.import_module("vn_stock_indicators.price_action")

INDICATOR_MAP: dict[str, tuple[Any, list[str]]] = {
    "sma": (trend.sma, ["period"]),
    "ema": (trend.ema, ["period"]),
    "wema": (trend.wema, ["period"]),
    "wma": (trend.wma, ["period"]),
    "dema": (trend.dema, ["period"]),
    "tema": (trend.tema, ["period"]),
    "macd": (trend.macd, ["fast", "slow", "signal"]),
    "adx": (trend.adx, ["period"]),
    "psar": (trend.psar, ["accel", "max_accel"]),
    "ichimoku": (trend.ichimoku, ["tenkan_period", "kijun_period", "senkou_period"]),
    "rsi": (momentum.rsi, ["period"]),
    "stochastic": (momentum.stochastic, ["k_period", "d_period"]),
    "williams_r": (momentum.williams_r, ["period"]),
    "cci": (momentum.cci, ["period"]),
    "mfi": (momentum.mfi, ["period"]),
    "roc": (momentum.roc, ["period"]),
    "bollinger_bands": (volatility_mod.bollinger_bands, ["period", "std_dev"]),
    "atr": (volatility_mod.atr, ["period"]),
    "keltner": (volatility_mod.keltner, ["period", "multiplier"]),
    "volatility": (volatility_mod.volatility, []),
    "obv": (volume_mod.obv, []),
    "volume_profile": (volume_mod.volume_profile, ["period"]),
    "ad": (volume_mod.ad, []),
    "adosc": (volume_mod.adosc, ["period"]),
    "support_resistance": (price_action.support_resistance, ["bins"]),
    "pivot_points": (price_action.pivot_points, []),
    "detect_engulfing": (price_action.detect_engulfing, []),
    "detect_doji": (price_action.detect_doji, ["body_pct"]),
    "detect_hammer": (price_action.detect_hammer, ["body_pct", "wick_ratio"]),
}

REQUIRED_OHLCV: dict[str, tuple[str, ...]] = {
    "sma": ("close",),
    "ema": ("close",),
    "wema": ("close",),
    "wma": ("close",),
    "dema": ("close",),
    "tema": ("close",),
    "macd": ("close",),
    "adx": ("high", "low", "close"),
    "psar": ("high", "low", "close"),
    "ichimoku": ("high", "low", "close"),
    "rsi": ("close",),
    "stochastic": ("high", "low", "close"),
    "williams_r": ("high", "low", "close"),
    "cci": ("high", "low", "close"),
    "mfi": ("high", "low", "close", "volume"),
    "roc": ("close",),
    "bollinger_bands": ("close",),
    "atr": ("high", "low", "close"),
    "keltner": ("high", "low", "close"),
    "volatility": ("close",),
    "obv": ("close", "volume"),
    "volume_profile": ("close", "volume"),
    "ad": ("high", "low", "close", "volume"),
    "adosc": ("high", "low", "close", "volume"),
    "support_resistance": ("high", "low", "close"),
    "pivot_points": ("high", "low", "close"),
    "detect_engulfing": ("open", "high", "low", "close"),
    "detect_doji": ("open", "close"),
    "detect_hammer": ("open", "high", "low", "close"),
}


def _to_jsonable(obj: Any) -> Any:
    """Convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(x) for x in obj]
    return obj


def _to_array(v: list[float]) -> np.ndarray:
    return np.array(v, dtype=np.float64)


def _nan_to_none(v: Any) -> Any:
    """Replace NaN with None for JSON."""
    if isinstance(v, np.ndarray):
        return [_nan_to_none(x) for x in v]
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, dict):
        return {k_: _nan_to_none(v_) for k_, v_ in v.items()}
    if isinstance(v, (list, tuple)):
        return [_nan_to_none(x) for x in v]
    return v


def process_request(request: dict) -> dict:
    """Process a batch request and return results."""
    required = ["close"]
    for field in required:
        if field not in request:
            return {"error": f"Missing required field: {field}"}

    indicators = request.get("indicators", [])
    if not indicators:
        return {"error": "No indicators requested"}

    params = request.get("params", {})

    close = _to_array(request["close"])
    high = _to_array(request.get("high", request["close"]))
    low = _to_array(request.get("low", request["close"]))
    open_arr = _to_array(request.get("open", request["close"]))
    volume_arr = _to_array(request.get("volume", np.ones(len(close))))

    results: dict[str, Any] = {}

    for name in indicators:
        if name not in INDICATOR_MAP:
            return {"error": f"Unknown indicator: {name}"}

        func, param_names = INDICATOR_MAP[name]
        ind_params = params.get(name, {})

        try:
            kwargs: dict[str, Any] = {}
            req_fields = REQUIRED_OHLCV.get(name, ("close",))
            arr_map = {
                "open": open_arr,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume_arr,
            }
            args = [arr_map[f] for f in req_fields]

            for pn in param_names:
                if pn in ind_params:
                    kwargs[pn] = ind_params[pn]

            raw = func(*args, **kwargs)
            clean = _nan_to_none(_to_jsonable(raw))
            results[name] = clean

        except Exception as e:
            return {"error": f"Error computing {name}: {e}"}

    return results


def main_json_line(
    in_stream: TextIO = sys.stdin,
    out_stream: TextIO = sys.stdout,
    timeout: float = 30.0,
) -> str | None:
    """Read NDJSON, process each line, write NDJSON results.

    Each input line is a JSON request object; each output line is the
    corresponding result. An error on one line does not stop processing.
    Returns None on normal exit, or an error message string on fatal failure.
    """
    for raw in in_stream:
        raw = raw.strip()
        if not raw:
            continue
        try:
            request = json.loads(raw)
        except json.JSONDecodeError:
            out_stream.write(json.dumps({"error": "Invalid JSON input line"}) + "\n")
            out_stream.flush()
            continue
        result = process_request(request)
        out_stream.write(json.dumps(result) + "\n")
        out_stream.flush()
    return None


def main() -> None:
    if "--json-line" in sys.argv:
        sys.argv.remove("--json-line")
        err = main_json_line()
        if err:
            json.dump({"error": err}, sys.stdout)
            sys.exit(1)
        return

    try:
        raw = sys.stdin.read()
        if not raw.strip():
            json.dump({"error": "Empty input"}, sys.stdout)
            sys.exit(1)
        request = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"error": f"Invalid JSON: {e}"}, sys.stdout)
        sys.exit(1)

    result = process_request(request)
    json.dump(result, sys.stdout, indent=2)
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
