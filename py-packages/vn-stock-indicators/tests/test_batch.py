from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

BATCH_SCRIPT = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "vn_stock_indicators"
    / "batch.py"
)


def _run_batch(input_data: dict) -> dict:
    result = subprocess.run(
        [sys.executable, str(BATCH_SCRIPT)],
        input=json.dumps(input_data),
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_batch_basic():
    close = list(range(1, 31))
    result = _run_batch(
        {
            "close": close,
            "indicators": ["sma", "rsi"],
            "params": {"sma": {"period": 5}, "rsi": {"period": 5}},
        }
    )
    assert "sma" in result
    assert "rsi" in result
    assert len(result["sma"]) == 30
    assert len(result["rsi"]) == 30


def test_batch_unknown_indicator():
    result = _run_batch({"close": [1, 2, 3], "indicators": ["nonexistent"]})
    assert "error" in result


def test_batch_missing_close():
    result = _run_batch({"indicators": ["sma"]})
    assert "error" in result


def test_batch_empty_indicators():
    result = _run_batch({"close": [1, 2, 3], "indicators": []})
    assert "error" in result
    assert "No indicators requested" in result["error"]


def test_batch_macd():
    close = list(range(1, 51))
    result = _run_batch({"close": close, "indicators": ["macd"]})
    assert "macd" in result
    assert isinstance(result["macd"], dict)


def test_batch_invalid_json():
    proc = subprocess.run(
        [sys.executable, str(BATCH_SCRIPT)],
        input="not json",
        capture_output=True,
        text=True,
    )
    output = json.loads(proc.stdout)
    assert "error" in output
    assert "Invalid JSON" in output["error"]


def test_batch_obv():
    close = [10, 11, 10, 12, 11]
    volume = [100, 150, 120, 200, 180]
    result = _run_batch(
        {"close": close, "volume": volume, "indicators": ["obv"]}
    )
    assert "obv" in result
    assert len(result["obv"]) == 5


def test_batch_bollinger_bands():
    close = list(range(1, 31))
    result = _run_batch(
        {
            "close": close,
            "indicators": ["bollinger_bands"],
        }
    )
    assert "bollinger_bands" in result
    assert isinstance(result["bollinger_bands"], dict)
    assert "upper" in result["bollinger_bands"]
    assert "middle" in result["bollinger_bands"]
    assert "lower" in result["bollinger_bands"]


def test_json_line_single():
    from io import StringIO
    from vn_stock_indicators.batch import main_json_line

    close = list(range(1, 31))
    inp = json.dumps({"close": close, "indicators": ["rsi"]})
    out = StringIO()
    err = main_json_line(StringIO(inp + "\n"), out, timeout=10)
    assert err is None
    lines = out.getvalue().strip().split("\n")
    assert len(lines) == 1
    result = json.loads(lines[0])
    assert "rsi" in result
    assert result["rsi"] is not None


def test_json_line_multiple():
    from io import StringIO
    from vn_stock_indicators.batch import main_json_line

    close1 = list(range(1, 31))
    close2 = list(range(100, 115))
    inp1 = json.dumps({"close": close1, "indicators": ["rsi"]})
    inp2 = json.dumps({"close": close2, "indicators": ["sma"], "params": {"sma": {"period": 2}}})
    out = StringIO()
    err = main_json_line(StringIO(inp1 + "\n" + inp2 + "\n"), out, timeout=10)
    assert err is None
    lines = out.getvalue().strip().split("\n")
    assert len(lines) == 2
    r1, r2 = json.loads(lines[0]), json.loads(lines[1])
    assert "rsi" in r1
    assert "sma" in r2


def test_json_line_error_isolation():
    from io import StringIO
    from vn_stock_indicators.batch import main_json_line

    close = list(range(1, 31))
    good = json.dumps({"close": close, "indicators": ["rsi"]})
    bad = "not-json"
    out = StringIO()
    err = main_json_line(StringIO(good + "\n" + bad + "\n"), out, timeout=10)
    assert err is None
    lines = out.getvalue().strip().split("\n")
    assert len(lines) == 2
    r1, r2 = json.loads(lines[0]), json.loads(lines[1])
    assert "rsi" in r1
    assert "error" in r2
