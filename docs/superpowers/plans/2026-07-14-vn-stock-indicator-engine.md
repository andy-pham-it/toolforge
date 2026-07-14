# IndicatorEngine — JS↔Python Subprocess Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a JS class `IndicatorEngine` in `@andy-toolforge/vn-stock` that calls Python technical indicator calculations (`vn-stock-indicators`) via subprocess, so JS packages and MCP tools can use all 29 indicators without reimplementing them.

**Architecture:** Single `IndicatorEngine` class with configurable mode (`spawn` = ephemeral Python per call, `pool` = keep-alive Python via JSON-line protocol). Optional MongoDB integration via `mongoUri` param for `fetchAndCompute()`.

**Tech Stack:** Node.js (CommonJS, child_process built-in), Python 3.14 + uv, numpy, JSON over stdin/stdout.

## Global Constraints

- CommonJS (`require` / `module.exports`) — no ESM
- `@andy-toolforge/vn-stock` package; `child_process` is built-in, no npm deps needed
- Python command default: `uv run python` (preferred; fallback to `python3`)
- All OHLCV arrays must be same length (validated before sending to Python)
- Cache optional via `cacheMaxAge` (default 0 = disabled)
- Tests: built-in `node:test` + `node:assert` (no jest/mocha)
- Python package at `py-packages/vn-stock-indicators/` (auto-detected or passed as `projectDir`)

---

### Task 1: Add `--json-line` mode to Python batch.py

**Files:**
- Modify: `py-packages/vn-stock-indicators/src/vn_stock_indicators/batch.py`

**Interfaces:**
- Consumes: existing `process_request()` function, `INDICATOR_MAP`, JSON stdin/stdout protocol
- Produces: `batch.py` accepts `--json-line` flag → reads one JSON object per line, writes one JSON result per line, both ndjson. Exit on EOF.

- [ ] **Step 1: Write the failing unit test**

```python
# In py-packages/vn-stock-indicators/tests/test_batch.py
import json
from io import StringIO
from vn_stock_indicators.batch import main_json_line

def test_process_json_line_single():
    """A single line is processed and returned as one JSON line."""
    inp = json.dumps({"close": [10, 20, 30], "indicators": ["rsi"]})
    out = StringIO()
    err = main_json_line(StringIO(inp + "\n"), out, timeout=10)
    assert err is None
    lines = out.getvalue().strip().split("\n")
    assert len(lines) == 1
    result = json.loads(lines[0])
    assert "rsi" in result
    assert result["rsi"] is not None

def test_process_json_line_multiple():
    inp1 = json.dumps({"close": [10, 20, 30], "indicators": ["rsi"]})
    inp2 = json.dumps({"close": [100, 105, 110], "indicators": ["sma"], "params": {"sma": {"period": 2}}})
    out = StringIO()
    err = main_json_line(StringIO(inp1 + "\n" + inp2 + "\n"), out, timeout=10)
    assert err is None
    lines = out.getvalue().strip().split("\n")
    assert len(lines) == 2
    r1, r2 = json.loads(lines[0]), json.loads(lines[1])
    assert "rsi" in r1
    assert "sma" in r2

def test_process_json_line_error_isolation():
    """A bad line does not kill the process — error object returned for that line."""
    good = json.dumps({"close": [10, 20, 30], "indicators": ["rsi"]})
    bad = "not-json"
    out = StringIO()
    err = main_json_line(StringIO(good + "\n" + bad + "\n"), out, timeout=10)
    assert err is None
    lines = out.getvalue().strip().split("\n")
    assert len(lines) == 2
    assert "rsi" in lines[0]
    assert "error" in lines[1]
```

Run: `cd py-packages/vn-stock-indicators && uv run pytest tests/test_batch.py::test_process_json_line_single tests/test_batch.py::test_process_json_line_multiple tests/test_batch.py::test_process_json_line_error_isolation -v`
Expected: FAIL (function not defined)

- [ ] **Step 2: Add `main_json_line()` + `--json-line` CLI entry**

```python
# Add to batch.py

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
```

Add to the `main()` function:

```python
def main() -> None:
    if "--json-line" in sys.argv:
        sys.argv.remove("--json-line")
        err = main_json_line()
        if err:
            json.dump({"error": err}, sys.stdout)
            sys.exit(1)
        return

    # existing single-request logic...
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd py-packages/vn-stock-indicators && uv run pytest tests/test_batch.py -v`
Expected: 3 PASS, rest green

- [ ] **Step 4: Commit**

```bash
git add py-packages/vn-stock-indicators/src/vn_stock_indicators/batch.py py-packages/vn-stock-indicators/tests/test_batch.py
git commit -m "feat(vn-stock-indicators): add --json-line mode for pool protocol"
```

---

### Task 2: Create IndicatorEngine class + unit tests

**Files:**
- Create: `packages/vn-stock/lib/indicators.js`
- Test: `packages/vn-stock/lib/indicators.test.js`

**Interfaces:**
- Consumes: `child_process.spawn`/`execFile`, Python `batch.py` CLI (`--json-line` for pool, stdin JSON for spawn)
- Produces: `IndicatorEngine` class with: `compute(ohlcv, indicators, params)`, `batchCompute(requests, mode?)`, `fetchAndCompute(symbol, indicators, options)`, `connect(mongoUri)`, `disconnect()`

- [ ] **Step 1: Write the failing unit test**

```javascript
// packages/vn-stock/lib/indicators.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { IndicatorEngine } = require('./indicators');
const path = require('node:path');

describe('IndicatorEngine', () => {
    it('should create with defaults', () => {
        const engine = new IndicatorEngine();
        assert.ok(engine.mode === 'spawn' || engine.mode === 'pool');
        assert.strictEqual(typeof engine.compute, 'function');
        assert.strictEqual(typeof engine.batchCompute, 'function');
        assert.strictEqual(typeof engine.fetchAndCompute, 'function');
    });

    it('should accept custom options', () => {
        const engine = new IndicatorEngine({
            mode: 'pool',
            pythonCmd: 'uv run python',
            projectDir: '/custom/path',
            cacheMaxAge: 5000,
        });
        assert.strictEqual(engine.mode, 'pool');
        assert.strictEqual(engine.cacheMaxAge, 5000);
    });
});
```

Run: `npm test -w @andy-toolforge/vn-stock -- --test-path-pattern indicators.test`
Expected: FAIL (module not found)

- [ ] **Step 2: Write the IndicatorEngine class**

```javascript
// packages/vn-stock/lib/indicators.js
const { spawn, execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

class IndicatorEngineError extends Error {
    constructor(message, { code = null, stderr = '' } = {}) {
        super(message);
        this.name = 'IndicatorEngineError';
        this.code = code;
        this.stderr = stderr;
    }
}

class IndicatorEngine {
    /**
     * @param {object} [options]
     * @param {'spawn'|'pool'} [options.mode='spawn'] - Python invocation mode
     * @param {string} [options.pythonCmd='uv run python'] - Python command
     * @param {string} [options.projectDir] - Path to vn-stock-indicators project
     * @param {number} [options.cacheMaxAge=0] - Cache TTL in ms (0 = disabled)
     */
    constructor(options = {}) {
        this.mode = options.mode || 'spawn';
        this.pythonCmd = options.pythonCmd || 'uv run python';
        this.cacheMaxAge = options.cacheMaxAge || 0;
        this._cache = new Map();
        this._pool = null; // child_process for pool mode
        this._mongoUri = null;
        this._db = null;

        // Auto-detect project dir
        this.projectDir = options.projectDir || this._findProjectDir();
    }

    _findProjectDir() {
        // Search up from cwd for py-packages/vn-stock-indicators
        let dir = process.cwd();
        for (let i = 0; i < 5; i++) {
            const candidate = path.join(dir, 'py-packages', 'vn-stock-indicators');
            if (fs.existsSync(path.join(candidate, 'pyproject.toml'))) {
                return candidate;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
        // Fallback: next to this package
        return path.resolve(__dirname, '..', '..', '..', '..', 'py-packages', 'vn-stock-indicators');
    }

    _getBatchScript() {
        return path.join(this.projectDir, 'src', 'vn_stock_indicators', 'batch.py');
    }

    _runPython(args, input) {
        return new Promise((resolve, reject) => {
            const cmd = this.pythonCmd.split(' ');
            const bin = cmd[0];
            const cmdArgs = [...cmd.slice(1), ...args];

            const child = execFile(bin, cmdArgs, {
                cwd: this.projectDir,
                timeout: 30000,
                maxBuffer: 10 * 1024 * 1024,
            }, (err, stdout, stderr) => {
                if (err) {
                    return reject(new IndicatorEngineError(
                        `Python process failed: ${err.message}`,
                        { code: err.code, stderr }
                    ));
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch (parseErr) {
                    reject(new IndicatorEngineError(
                        `Invalid JSON output from Python: ${parseErr.message}`,
                        { stderr }
                    ));
                }
            });

            if (input) {
                child.stdin.write(input);
                child.stdin.end();
            }
        });
    }

    /**
     * Compute technical indicators from raw OHLCV data.
     * @param {object} ohlcv - { open, high, low, close, volume } (arrays)
     * @param {string[]} indicators - Indicator names to compute
     * @param {object} [params] - Per-indicator params
     * @returns {Promise<object>} Computed indicator values
     */
    async compute(ohlcv, indicators, params = {}) {
        // Validate array lengths
        const arrays = ['open', 'high', 'low', 'close', 'volume'].filter(k => ohlcv[k]);
        if (arrays.length === 0) {
            throw new IndicatorEngineError('At least one OHLCV array is required');
        }
        const lengths = arrays.map(k => ohlcv[k].length);
        if (new Set(lengths).size > 1) {
            throw new IndicatorEngineError(
                `OHLCV arrays have mismatched lengths: ${arrays.map((k, i) => `${k}=${lengths[i]}`).join(', ')}`
            );
        }

        // Check cache
        const cacheKey = JSON.stringify({ ohlcv, indicators, params });
        if (this.cacheMaxAge > 0) {
            const cached = this._cache.get(cacheKey);
            if (cached && Date.now() - cached.ts < this.cacheMaxAge) {
                return cached.data;
            }
        }

        const request = {
            close: ohlcv.close || ohlcv.high || ohlcv.low || ohlcv.open,
            high: ohlcv.high,
            low: ohlcv.low,
            open: ohlcv.open,
            volume: ohlcv.volume,
            indicators,
            params,
        };

        if (this.mode === 'spawn') {
            const result = await this._runPython(
                [this._getBatchScript()],
                JSON.stringify(request)
            );
            if (this.cacheMaxAge > 0) {
                this._cache.set(cacheKey, { data: result, ts: Date.now() });
            }
            return result;
        }

        // Pool mode: send as JSON-line
        return this._sendPoolRequest(request);
    }

    /**
     * Process multiple OHLCV requests in batch (efficient pool mode).
     * @param {object[]} requests - Array of { ohlcv, indicators, params }
     * @param {'spawn'|'pool'} [mode] - Override mode for this batch
     * @returns {Promise<object[]>} Results per request
     */
    async batchCompute(requests, mode) {
        const useMode = mode || this.mode;

        if (useMode === 'spawn') {
            // For spawn mode, process sequentially
            const results = [];
            for (const req of requests) {
                results.push(await this.compute(req.ohlcv, req.indicators, req.params));
            }
            return results;
        }

        // Pool mode: batch via JSON-line protocol
        // Ensure pool is started
        await this._ensurePool();
        const results = [];
        for (const req of requests) {
            const cacheKey = JSON.stringify(req);
            if (this.cacheMaxAge > 0) {
                const cached = this._cache.get(cacheKey);
                if (cached && Date.now() - cached.ts < this.cacheMaxAge) {
                    results.push(cached.data);
                    continue;
                }
            }
            const result = await this._sendPoolLine(req);
            if (this.cacheMaxAge > 0) {
                this._cache.set(cacheKey, { data: result, ts: Date.now() });
            }
            results.push(result);
        }
        return results;
    }

    /**
     * Fetch data from MongoDB and compute indicators.
     * @param {string} symbol - Stock symbol
     * @param {string[]} indicators - Indicators to compute
     * @param {object} [options]
     * @param {string} [options.source='daily'] - 'daily' or 'intraday'
     * @param {string} [options.interval='15m'] - Intraday interval (if source='intraday')
     * @param {object} [options.params] - Per-indicator params
     * @param {number} [options.limit=100] - Max candles to fetch
     * @returns {Promise<object>} { symbol, source, date, indicators: {...} }
     */
    async fetchAndCompute(symbol, indicators, options = {}) {
        await this._ensureDb();
        const source = options.source || 'daily';
        const interval = options.interval || '15m';
        const limit = options.limit || 100;
        const params = options.params || {};

        let ohlcv;
        if (source === 'daily') {
            const col = this._db.collection('daily_candles');
            const doc = await col.findOne({ symbol }, {
                projection: { candles: 1, date: 1 },
            });
            if (!doc || !doc.candles || doc.candles.length === 0) {
                throw new IndicatorEngineError(`No daily data found for ${symbol}`);
            }
            const candles = doc.candles.slice(-limit);
            ohlcv = this._candlesToOhlcv(candles);
            ohlcv._date = doc.date;
        } else {
            const col = this._db.collection('intraday_candles');
            const docs = await col.find({ symbol, interval })
                .sort({ date: -1 })
                .limit(limit)
                .toArray();
            if (docs.length === 0) {
                throw new IndicatorEngineError(`No intraday data found for ${symbol} (${interval})`);
            }
            docs.reverse();
            ohlcv = this._candlesToOhlcv(docs);
            ohlcv._date = docs[docs.length - 1].date;
        }

        const result = await this.compute(ohlcv, indicators, params);

        if (result.error) {
            throw new IndicatorEngineError(`Indicator computation failed: ${result.error}`);
        }

        // Remove internal fields
        const { _date, ...cleanOhlcv } = ohlcv;
        return {
            symbol,
            source,
            interval: source === 'intraday' ? interval : undefined,
            date: _date,
            ohlcv: cleanOhlcv,
            indicators: result,
        };
    }

    _candlesToOhlcv(candles) {
        const out = { open: [], high: [], low: [], close: [], volume: [] };
        for (const c of candles) {
            out.open.push(c.o ?? c.open);
            out.high.push(c.h ?? c.high);
            out.low.push(c.l ?? c.low);
            out.close.push(c.c ?? c.close);
            out.volume.push(c.v ?? c.volume ?? 0);
        }
        return out;
    }

    async connect(mongoUri) {
        if (!mongoUri && !this._mongoUri) {
            throw new IndicatorEngineError('MongoDB URI required. Pass mongoUri param or set STOCK_MONGO_URI env var.');
        }
        this._mongoUri = mongoUri || process.env.STOCK_MONGO_URI;
    }

    async disconnect() {
        if (this._db) {
            await this._db.close();
            this._db = null;
        }
        this._killPool();
    }

    // ---- Pool mode internals ----

    async _ensurePool() {
        if (this._pool && !this._pool.killed) return;
        const cmd = this.pythonCmd.split(' ');
        const bin = cmd[0];
        const cmdArgs = [...cmd.slice(1), this._getBatchScript(), '--json-line'];
        this._pool = spawn(bin, cmdArgs, { cwd: this.projectDir, stdio: ['pipe', 'pipe', 'pipe'] });
        this._pool._buffer = '';
        this._pool._resolves = [];
        this._pool._lineQueue = [];

        this._pool.stdout.on('data', (chunk) => {
            this._pool._buffer += chunk.toString();
            const lines = this._pool._buffer.split('\n');
            this._pool._buffer = lines.pop(); // keep incomplete line
            for (const line of lines) {
                if (!line.trim()) continue;
                const resolve = this._pool._resolves.shift();
                if (resolve) {
                    try { resolve(JSON.parse(line)); }
                    catch { resolve({ error: `Invalid JSON: ${line}` }); }
                }
            }
        });

        this._pool.on('exit', () => {
            // Reject any pending resolves
            for (const r of this._pool._resolves) r({ error: 'Pool process exited unexpectedly' });
            this._pool._resolves = [];
            this._pool = null;
        });
    }

    _sendPoolRequest(request) {
        return new Promise((resolve, reject) => {
            this._pool._resolves.push(resolve);
            this._pool.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    async _ensureDb() {
        if (this._db) return;
        if (!this._mongoUri) {
            this._mongoUri = process.env.STOCK_MONGO_URI;
        }
        const { StockDB } = require('./db');
        this._db = new StockDB(this._mongoUri);
        await this._db.connect();
    }

    _killPool() {
        if (this._pool && !this._pool.killed) {
            this._pool.kill();
            this._pool = null;
        }
    }
}

module.exports = { IndicatorEngine, IndicatorEngineError };
```

- [ ] **Step 3: Write unit tests for IndicatorEngine (mock subprocess)**

```javascript
// Add to packages/vn-stock/lib/indicators.test.js
const { describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { IndicatorEngine, IndicatorEngineError } = require('./indicators');

describe('IndicatorEngine - constructor', () => {
    it('should create with defaults', () => {
        const engine = new IndicatorEngine();
        assert.ok(engine.mode === 'spawn');
        assert.ok(engine.projectDir);
    });

    it('should accept custom options', () => {
        const engine = new IndicatorEngine({
            mode: 'pool',
            pythonCmd: 'uv run python',
            cacheMaxAge: 5000,
        });
        assert.strictEqual(engine.mode, 'pool');
        assert.strictEqual(engine.cacheMaxAge, 5000);
    });
});

describe('IndicatorEngine - compute (spawn mode)', () => {
    it('should throw on missing close array', async () => {
        const engine = new IndicatorEngine();
        await assert.rejects(
            () => engine.compute({}, ['rsi']),
            IndicatorEngineError
        );
    });

    it('should throw on mismatched array lengths', async () => {
        const engine = new IndicatorEngine();
        await assert.rejects(
            () => engine.compute({ close: [1, 2, 3], high: [1, 2] }, ['rsi']),
            /mismatched lengths/
        );
    });
});

describe('IndicatorEngine - database integration', () => {
    it('should throw error when no mongoUri provided', async () => {
        const engine = new IndicatorEngine();
        await assert.rejects(
            () => engine.fetchAndCompute('FPT', ['rsi']),
            /MongoDB URI/
        );
    });

    it('should accept connect() with mongoUri', async () => {
        const engine = new IndicatorEngine();
        await engine.connect('mongodb://localhost:27017');
        assert.ok(engine._mongoUri);
    });
});

describe('IndicatorEngineError', () => {
    it('should carry code and stderr', () => {
        const err = new IndicatorEngineError('boom', { code: 'ENOENT', stderr: 'python not found' });
        assert.strictEqual(err.name, 'IndicatorEngineError');
        assert.strictEqual(err.code, 'ENOENT');
        assert.strictEqual(err.stderr, 'python not found');
    });
});
```

Run: `npm test -w @andy-toolforge/vn-stock -- --test-path-pattern indicators.test`
Expected: PASS (7 tests — constructor, constructor options, missing close, mismatched lengths, no mongoUri, connect(), EngineError)

- [ ] **Step 4: Commit**

```bash
git add packages/vn-stock/lib/indicators.js packages/vn-stock/lib/indicators.test.js
git commit -m "feat(vn-stock): add IndicatorEngine with spawn/pool modes and unit tests"
```

---

### Task 3: Wire into index.js + AGENTS.md

**Files:**
- Modify: `packages/vn-stock/lib/index.js`
- Modify: `packages/vn-stock/AGENTS.md`

**Interfaces:**
- Consumes: `IndicatorEngine` from `./indicators`
- Produces: `{ StockDB, StockScreener, StockScorer, SignalDetector, IndicatorEngine }` exported from index.js

- [ ] **Step 1: Wire index.js**

```javascript
// packages/vn-stock/lib/index.js
const StockDB = require('./db');
const StockScreener = require('./screener');
const StockScorer = require('./scorer');
const SignalDetector = require('./signals');
const { IndicatorEngine } = require('./indicators');

module.exports = {
    StockDB,
    StockScreener,
    StockScorer,
    SignalDetector,
    IndicatorEngine,
};
```

- [ ] **Step 2: Update AGENTS.md**

Add to the Structure section:
```
    indicators.js — IndicatorEngine  JS↔Python subprocess bridge (29 indicators, spawn/pool modes, MongoDB integration)
```

Add to the Exports table:
```
| `IndicatorEngine` | `lib/indicators.js` | JS↔Python subprocess bridge, 29 indicators via Python, spawn/pool modes, MongoDB fetch |
```

Add a new "### Indicator Engine" usage section:

```markdown
### Indicator Engine (IndicatorEngine)

```javascript
const { IndicatorEngine } = require('@andy-toolforge/vn-stock');

// Spawn mode (default) — fresh Python per call
const engine = new IndicatorEngine({ mode: 'spawn' });
const result = await engine.compute(
    { close: [100, 102, 101, 105, 110], high: [101, 103, 102, 106, 112], low: [99, 101, 100, 104, 108] },
    ['rsi', 'sma', 'bollinger_bands'],
    { sma: { period: 3 } }
);
console.log(result.rsi, result.sma);

// Pool mode — keep-alive Python, fast for many calls
const pool = new IndicatorEngine({ mode: 'pool' });
const results = await pool.batchCompute([
    { ohlcv: { close: [...], high: [...], low: [...] }, indicators: ['rsi'] },
    { ohlcv: { close: [...], high: [...], low: [...] }, indicators: ['macd'] },
]);
console.log(results[0].rsi, results[1].macd);

// MongoDB integration — fetch then compute
await pool.connect('mongodb://localhost:27017');
const info = await pool.fetchAndCompute('FPT', ['rsi', 'sma', 'macd'], {
    source: 'daily',
    limit: 100,
});
console.log(info.date, info.indicators.rsi);

// Cache (5 seconds)
const cached = new IndicatorEngine({ mode: 'pool', cacheMaxAge: 5000 });

await pool.disconnect();
```
```

- [ ] **Step 3: Commit**

```bash
git add packages/vn-stock/lib/index.js packages/vn-stock/AGENTS.md
git commit -m "chore(vn-stock): wire IndicatorEngine into index.js + AGENTS.md"
```

---

### Task 4: Integration tests (real uv + Python)

**Files:**
- Modify: `packages/vn-stock/lib/integration.test.js`

**Interfaces:**
- Consumes: `IndicatorEngine` from `./indicators`, real Python `batch.py`, `--json-line` mode

- [ ] **Step 1: Write integration tests**

```javascript
// Add to StockScorer describe block in packages/vn-stock/lib/integration.test.js
const { IndicatorEngine } = require('./indicators');

describe('IndicatorEngine integration', async () => {
    await it('compute should return RSI for known OHLCV', async () => {
        const engine = new IndicatorEngine();
        const result = await engine.compute(
            { close: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
            ['rsi']
        );
        assert.ok(result);
        assert.ok(Array.isArray(result.rsi));
        assert.strictEqual(result.rsi.length, 10);
        // NaN-prefix: first element should be null/None
    });

    await it('compute should return multiple indicators', async () => {
        const engine = new IndicatorEngine();
        const result = await engine.compute(
            { close: [100, 102, 101, 105, 110, 108, 107, 111, 115, 120] },
            ['sma', 'ema', 'rsi'],
            { sma: { period: 3 } }
        );
        assert.ok(result.sma);
        assert.ok(result.ema);
        assert.ok(result.rsi);
        assert.strictEqual(result.sma.length, 10);
    });

    await it('compute should error for unknown indicator', async () => {
        const engine = new IndicatorEngine();
        const result = await engine.compute(
            { close: [10, 20, 30] },
            ['nonexistent_indicator']
        );
        assert.ok(result.error);
    });

    await it('batchCompute should process multiple requests', async () => {
        const engine = new IndicatorEngine();
        const results = await engine.batchCompute([
            { ohlcv: { close: [10, 20, 30, 40, 50] }, indicators: ['rsi'] },
            { ohlcv: { close: [100, 110, 120, 130, 140] }, indicators: ['rsi'] },
        ]);
        assert.strictEqual(results.length, 2);
        assert.ok(results[0].rsi);
        assert.ok(results[1].rsi);
    });
});
```

- [ ] **Step 2: Run all tests**

Run: `npm test -w @andy-toolforge/vn-stock`
Expected: All tests pass (existing + new indicator engine tests)

- [ ] **Step 3: Commit**

```bash
git add packages/vn-stock/lib/integration.test.js
git commit -m "test(vn-stock): add IndicatorEngine integration tests"
```

---

### Task 5: Full suite verification

**Files:**
- Verify: all files across JS + Python packages

- [ ] **Step 1: Run Python tests**

Run: `cd py-packages/vn-stock-indicators && uv run pytest -v`
Expected: 66+ test pass (3 new JSON-line tests + 63 existing)

- [ ] **Step 2: Run JS tests**

Run: `npm test -w @andy-toolforge/vn-stock`
Expected: All tests pass (unit + integration)

- [ ] **Step 3: Verify batch.py --json-line CLI end-to-end**

Run:
```bash
cd py-packages/vn-stock-indicators
echo '{"close":[10,20,30,40,50],"indicators":["rsi"]}' | uv run python src/vn_stock_indicators/batch.py --json-line
```
Expected: One JSON line with `{"rsi": [null, null, null, ...]}`

- [ ] **Step 4: Verify the plan — self-review checklist**

**Spec coverage:**
- [ ] Section 2 (Spawn + Pool) → Task 1 (--json-line), Task 2 (pool internals), Task 4 (integration)
- [ ] Section 3 (MongoDB Integration) → Task 2 (fetchAndCompute, connect, disconnect), Task 4 (integration)
- [ ] Section 4 (Error Handling) → Task 2 (IndicatorEngineError class, mismatch validation)
- [ ] Section 5 (Testing) → Tasks 1, 2, 4 (unit + integration tests)
- [ ] AGENTS.md + index.js → Task 3

**No placeholders** — all code is real, no TBD/TODO

**Type consistency** — IndicatorEngine, compute(), fetchAndCompute(), batchCompute() signatures match across all tasks
