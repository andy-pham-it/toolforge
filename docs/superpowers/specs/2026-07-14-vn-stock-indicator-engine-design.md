# VN Stock Indicator Engine — JS↔Python Subprocess Bridge

> **Design spec** — bridges `@andy-toolforge/vn-stock` (JS) with `vn-stock-indicators` (Python) via subprocess.

## Goal

Provide a JS class `IndicatorEngine` that calls Python technical indicator calculations via subprocess, so JS packages and MCP tools can use all 29 indicators without reimplementing them.

## Architecture

```
┌─ JS (Node.js) ─────────────────────┐
│                                     │
│  StockDB (MongoDB)                  │
│    ↓ fetch OHLCV                    │
│  IndicatorEngine                     │
│    ↓ JSON via stdin/stdout          │
│    ↑ parsed results                 │
│                                     │
└──────────┬──────────────────────────┘
           │ spawn/pool uv run python
           ▼
┌─ Python ────────────────────────────┐
│                                     │
│  vn_stock_indicators.batch          │
│    → 29 indicators (numpy)          │
│    → JSON output                    │
│                                     │
└─────────────────────────────────────┘
```

### Key design decisions

- **Single class** (`IndicatorEngine`) with configurable mode — not a two-layer architecture
- **`mode: 'spawn'`** (default): spawn Python per call; simple, no state mgmt
- **`mode: 'pool'`**: keep-alive Python process for lower latency; communicates via JSON-line protocol
- **Optional MongoDB integration**: pass `mongoUri` to enable `fetchAndCompute()`; otherwise works as pure bridge
- **Configurable caching**: optional result cache keyed by OHLCV hash + indicator names

## File Changes

### Create
- `packages/vn-stock/lib/indicators.js` — IndicatorEngine class (~220 lines)
- `packages/vn-stock/lib/indicators.test.js` — tests (~150 lines)

### Modify
- `packages/vn-stock/lib/index.js` — add `IndicatorEngine` to exports
- `py-packages/vn-stock-indicators/src/vn_stock_indicators/batch.py` — add `--json-line` mode for pool
- `packages/vn-stock/AGENTS.md` — add IndicatorEngine usage section
- `packages/vn-stock/package.json` — ensure `@andy-toolforge/vn-stock` has no extra deps needed (child_process is built-in)

## IndicatorEngine API

### Constructor

```js
new IndicatorEngine({
  mode: 'spawn',              // 'spawn' | 'pool'
  pythonCmd: 'uv run python', // Python command (uv preferred)
  pythonPath: null,           // Alternative: absolute path to python binary
  projectDir: null,           // Path to py-packages/vn-stock-indicators/ (auto-detected)
  mongoUri: null,             // Optional MongoDB URI for fetchAndCompute
  timeout: 30000,             // Spawn mode timeout (ms)
  cacheMaxAge: 0,             // Result cache TTL (0 = disabled)
})
```

### Methods

#### `async compute(ohlcv, indicators, params = {})`

Pure bridge — no MongoDB needed.

```js
const engine = new IndicatorEngine();
const result = await engine.compute(
  {
    open: [81, 82, 83, ...],
    high: [83, 84, 85, ...],
    low: [80, 81, 82, ...],
    close: [82, 83, 84, ...],
    volume: [1000000, 1200000, ...],
  },
  ['rsi', 'ema', 'macd'],
  {
    rsi: { period: 14 },
    ema: { period: 20 },
  }
);
// → { rsi: [null, ..., 65.2], ema: [...], macd: { macd: [...], ... } }
```

#### `async fetchAndCompute(symbol, indicators, params = {}, source = 'daily', candleCount = 100)`

Requires `mongoUri` to be set in constructor. Fetches from MongoDB, then computes.

```js
const engine = new IndicatorEngine({ mongoUri: 'mongodb://localhost:27017' });
const result = await engine.fetchAndCompute('FPT', ['rsi', 'bbands']);
// → { symbol: 'FPT', date: '2026-07-10', candleCount: 100,
//     indicators: { rsi: [...], bbands: { upper: [...], ... } } }
```

#### `async connect()`

- Spawn pool process (if `mode: 'pool'`)
- Connect MongoDB (if `mongoUri` set)

#### `async disconnect()`

- Kill pool process
- Close MongoDB connection

## Spawn Mode Detail

```
compute()
  → validate ohlcv arrays (all same length)
  → build JSON: { open, high, low, close, volume, indicators, params }
  → spawn: uv run python -m vn_stock_indicators.batch
  → pipe JSON to stdin
  → read stdout (with timeout)
  → parse JSON response
  → return results
  → on error: throw IndicatorEngineError with stderr
```

**Timeout handling:** If Python takes > `timeout` ms, kill subprocess and throw.

## Pool Mode Detail

```
connect()
  → spawn: uv run python -m vn_stock_indicators.batch --json-line
  → wait for ready signal: {"status": "ready"}
  → store process reference

compute()
  → writeline(JSON.stringify(request))
  → readline() — wait for matching id response
  → parse + return

disconnect()
  → writeline(JSON.stringify({ command: "shutdown" }))
  → wait 2s
  → SIGTERM if still alive
```

**Protocol additions to `batch.py`:**

When `--json-line` flag is passed, the batch module enters a loop:
1. Print `{"status": "ready"}` on startup
2. Read one JSON line from stdin
3. Process the request
4. Write one JSON result line to stdout
5. Go to step 2
6. On receiving `{"command": "shutdown"}` — exit cleanly

**Crash recovery:** If pool process exits unexpectedly, `connect()` automatically respawns on next `compute()` call.

## MongoDB Integration Detail

```
fetchAndCompute(symbol, indicators, params, source, candleCount)
  → if not connected, lazy-connect to MongoDB
  → if source === 'daily':
      → getLatestCandles() — fetch all symbols
      → find symbol match
      → extract last candleCount candles
      → build OHLCV arrays: open[], high[], low[], close[], volume[]
  → if source === 'intraday':
      → getIntradayIndicators([symbol])
      → find match with interval (first available)
      → extract candle data
  → call this.compute(ohlcv, indicators, params)
  → wrap result with { symbol, date, candleCount }
```

**Lazy initialization:** MongoDB connection is created on first `fetchAndCompute()` call, not in constructor.

## Error Handling

| Scenario | Result |
|----------|--------|
| `compute()` with missing OHLCV fields | Throw `IndicatorEngineError` with code `INVALID_INPUT` |
| Python not found / uv not found | Throw `IndicatorEngineError` with code `PYTHON_NOT_FOUND` |
| Subprocess timeout | Kill process, throw `IndicatorEngineError` with code `TIMEOUT` |
| Python returns `{"error": "..."}` | Throw `IndicatorEngineError` with code `PYTHON_ERROR` containing the message |
| Pool process dies unexpectedly | Auto-restart on next `compute()`, retry once |
| MongoDB connection fails | Native error propagates (not caught) |
| No data for symbol | `fetchAndCompute()` returns `null` |

```js
class IndicatorEngineError extends Error {
  constructor(message, { code = 'UNKNOWN', stderr = '' } = {}) {
    super(message);
    this.name = 'IndicatorEngineError';
    this.code = code;
    this.stderr = stderr;
  }
}
```

## Cache (Optional)

When `cacheMaxAge > 0`, `compute()` results are cached using a key derived from:
- SHA-256 hash of concatenated OHLCV values
- Sorted indicator names + params JSON

Cache lives in a plain `Map` with TTL cleanup on read. Cache is NOT shared across instances.

## Testing

### Unit tests (mock subprocess)

| Test | Description |
|------|-------------|
| `compute()` sends correct JSON to stdin | Mock spawn, verify written JSON |
| `compute()` parses stdout correctly | Mock spawn stdout, verify return value |
| `compute()` handles timeout | Mock spawn, don't write, verify timeout error |
| `compute()` handles Python error | Mock stderr with error, verify error thrown |
| `compute()` validates OHLCV input | Missing fields, mismatched lengths |
| `fetchAndCompute()` no MongoDB | Without mongoUri set, verify it throws |

### Integration tests (real uv + MongoDB)

| Test | Description |
|------|-------------|
| `compute()` with RSI | Real subprocess, verify RSI values |
| `compute()` with EMA+MACD+BBANDS | Multiple indicators, verify structure |
| `compute()` with unknown indicator | Verify error thrown |
| Pool mode basic flow | `connect()` → `compute()` → `disconnect()` |
| Pool mode auto-restart | Kill pool process, verify next `compute()` works |
| `fetchAndCompute()` with real data | MongoDB → fetch FPT → compute RSI |
| `fetchAndCompute()` unknown symbol | Return null |

**Test data:** Use `py-packages/vn-stock-indicators/tests/` fixtures for Python-side testing.

## Out of Scope

- Python indicator implementation (already done — 29 indicators in `vn-stock-indicators`)
- MCP tool registration (follows in a separate step)
- WebSocket / HTTP server mode for the bridge
- Distributed/remote Python workers
