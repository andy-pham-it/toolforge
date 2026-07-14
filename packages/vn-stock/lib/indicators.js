const child_process = require('child_process');
const { createHash } = require('crypto');
const path = require('path');
const fs = require('fs');

class IndicatorEngineError extends Error {
    constructor(message, { code = 'UNKNOWN', stderr = '' } = {}) {
        super(message);
        this.name = 'IndicatorEngineError';
        this.code = code;
        this.stderr = stderr;
    }
}

function findProjectDir() {
    const start = path.resolve(__dirname, '..');
    for (const rel of [
        '../..',
        '../../..',
    ]) {
        const candidate = path.resolve(start, rel, 'py-packages', 'vn-stock-indicators');
        try {
            if (fs.statSync(path.join(candidate, 'pyproject.toml')).isFile()) return candidate;
        } catch { /* not found */ }
    }
    return null;
}

const DEFAULT_PROJECT_DIR = findProjectDir();

class IndicatorEngine {
    constructor(options = {}) {
        this.mode = options.mode || 'spawn';
        this.pythonPath = options.pythonPath || null;
        this.projectDir = options.projectDir || DEFAULT_PROJECT_DIR;
        this.mongoUri = options.mongoUri || null;
        this.timeout = options.timeout || 30000;
        this.cacheMaxAge = options.cacheMaxAge || 0;

        this._pool = null;
        this._connected = false;
        this._db = null;
        this._cache = new Map();
        this._lineBuffer = '';
    }

    get _cmd() {
        if (this.pythonPath) {
            return { cmd: this.pythonPath, args: ['-m', 'vn_stock_indicators.batch'] };
        }
        return { cmd: 'uv', args: ['run', 'python', '-m', 'vn_stock_indicators.batch'] };
    }

    get _cwd() {
        return this.projectDir || undefined;
    }

    _cacheKey(ohlcv, indicators, params) {
        const hash = createHash('sha256');
        hash.update(JSON.stringify({ o: ohlcv.open, h: ohlcv.high, l: ohlcv.low, c: ohlcv.close, v: ohlcv.volume }));
        hash.update(JSON.stringify(indicators.sort()));
        hash.update(JSON.stringify(params));
        return hash.digest('hex');
    }

    _cacheGet(key) {
        if (this.cacheMaxAge <= 0) return null;
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }

    _cacheSet(key, data) {
        if (this.cacheMaxAge <= 0) return;
        this._cache.set(key, { data, expires: Date.now() + this.cacheMaxAge });
    }

    _validate(ohlcv, indicators) {
        if (!ohlcv.close || !Array.isArray(ohlcv.close) || ohlcv.close.length === 0) {
            throw new IndicatorEngineError(
                'OHLCV.close must be a non-empty array', { code: 'INVALID_INPUT' }
            );
        }
        const len = ohlcv.close.length;
        for (const field of ['open', 'high', 'low', 'volume']) {
            if (ohlcv[field] && Array.isArray(ohlcv[field]) && ohlcv[field].length !== len) {
                throw new IndicatorEngineError(
                    `OHLCV.${field} length (${ohlcv[field].length}) !== close (${len})`,
                    { code: 'INVALID_INPUT' }
                );
            }
        }
        if (!Array.isArray(indicators) || indicators.length === 0) {
            throw new IndicatorEngineError(
                'At least one indicator required', { code: 'INVALID_INPUT' }
            );
        }
    }

    async compute(ohlcv, indicators, params = {}) {
        this._validate(ohlcv, indicators);

        const key = this._cacheKey(ohlcv, indicators, params);
        const cached = this._cacheGet(key);
        if (cached) return cached;

        const request = { close: ohlcv.close, indicators, params };
        if (ohlcv.open) request.open = ohlcv.open;
        if (ohlcv.high) request.high = ohlcv.high;
        if (ohlcv.low) request.low = ohlcv.low;
        if (ohlcv.volume) request.volume = ohlcv.volume;

        const result = this.mode === 'pool'
            ? await this._poolCompute(request)
            : await this._spawnCompute(request);

        if (result && result.error) {
            throw new IndicatorEngineError(result.error, { code: 'PYTHON_ERROR' });
        }

        this._cacheSet(key, result);
        return result;
    }

    _spawnCompute(request) {
        return new Promise((resolve, reject) => {
            const { cmd, args } = this._cmd;
            const child = child_process.spawn(cmd, args, {
                cwd: this._cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';
            let done = false;

            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.stderr.on('data', (d) => { stderr += d.toString(); });

            const cleanup = () => {
                done = true;
                clearTimeout(timer);
                child.stdin?.end();
            };

            const timer = setTimeout(() => {
                if (!done) {
                    child.kill('SIGTERM');
                    reject(new IndicatorEngineError(
                        `Timed out after ${this.timeout}ms`, { code: 'TIMEOUT', stderr }
                    ));
                }
            }, this.timeout);

            child.on('error', (err) => {
                if (done) return;
                cleanup();
                if (err.code === 'ENOENT') {
                    reject(new IndicatorEngineError(
                        `Command not found: ${cmd}`, { code: 'PYTHON_NOT_FOUND', stderr: err.message }
                    ));
                } else {
                    reject(new IndicatorEngineError(
                        `Subprocess error: ${err.message}`, { code: 'SUBPROCESS_ERROR', stderr: err.message }
                    ));
                }
            });

            child.on('close', (code) => {
                if (done) return;
                cleanup();
                if (code !== 0) {
                    reject(new IndicatorEngineError(
                        `Exited with code ${code}`, { code: 'PYTHON_ERROR', stderr }
                    ));
                    return;
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new IndicatorEngineError(
                        `Invalid JSON: ${e.message}`, { code: 'PARSE_ERROR', stderr }
                    ));
                }
            });

            child.stdin.write(JSON.stringify(request));
            child.stdin.end();
        });
    }

    async _poolCompute(request) {
        if (!this._pool || !this._connected) {
            await this.connect();
        }

        const child = this._pool;
        return new Promise((resolve, reject) => {
            let done = false;

            const onData = (data) => {
                this._lineBuffer += data.toString();
                const lines = this._lineBuffer.split('\n');
                this._lineBuffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed.status === 'ready') continue;
                        cleanup();
                        resolve(parsed);
                        return;
                    } catch (e) {
                        cleanup();
                        reject(new IndicatorEngineError(
                            `Invalid JSON: ${e.message}`, { code: 'PARSE_ERROR' }
                        ));
                        return;
                    }
                }
            };

            const cleanup = () => {
                done = true;
                clearTimeout(timer);
                child.stdout.removeListener('data', onData);
            };

            const timer = setTimeout(() => {
                if (!done) {
                    cleanup();
                    reject(new IndicatorEngineError(
                        `Pool request timed out after ${this.timeout}ms`, { code: 'TIMEOUT' }
                    ));
                }
            }, this.timeout);

            child.stdout.on('data', onData);
            child.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    async connect() {
        if (this.mode === 'pool' && !this._pool) {
            await this._startPool();
        }
        if (this.mongoUri && !this._db) {
            const StockDB = require('./db');
            this._db = new StockDB(this.mongoUri);
            await this._db.connect();
        }
        this._connected = true;
    }

    _startPool() {
        return new Promise((resolve, reject) => {
            const { cmd, args } = this._cmd;
            const child = child_process.spawn(cmd, [...args, '--json-line'], {
                cwd: this._cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let started = false;
            let stderr = '';

            child.stderr.on('data', (d) => { stderr += d.toString(); });

            child.stdout.on('data', function onReady(data) {
                const text = data.toString();
                if (text.includes('"ready"')) {
                    started = true;
                    child.stdout.removeListener('data', onReady);
                    resolve();
                }
            });

            const timer = setTimeout(() => {
                if (!started) {
                    child.kill('SIGTERM');
                    reject(new IndicatorEngineError(
                        'Pool did not start in time', { code: 'POOL_START_TIMEOUT', stderr }
                    ));
                }
            }, 10000);

            child.on('error', (err) => {
                clearTimeout(timer);
                if (err.code === 'ENOENT') {
                    reject(new IndicatorEngineError(
                        `Command not found: ${cmd}`, { code: 'PYTHON_NOT_FOUND' }
                    ));
                } else {
                    reject(err);
                }
            });

            child.on('exit', (code) => {
                clearTimeout(timer);
                if (!started && code !== 0) {
                    reject(new IndicatorEngineError(
                        `Pool exited with code ${code}`, { code: 'POOL_EXITED', stderr }
                    ));
                }
            });

            this._pool = child;
            this._lineBuffer = '';
        });
    }

    async fetchAndCompute(symbol, indicators, params = {}, source = 'daily', candleCount = 100) {
        if (!this.mongoUri && !this._db) {
            throw new IndicatorEngineError(
                'Set mongoUri in constructor for fetchAndCompute', { code: 'MONGO_NOT_CONFIGURED' }
            );
        }

        await this.connect();

        let ohlcv;
        let doc;

        if (source === 'daily') {
            const candles = await this._db.getLatestCandles([symbol], candleCount);
            doc = candles.find(c => c.symbol === symbol);
            if (!doc || !doc.candles || doc.candles.length === 0) return null;

            const arr = doc.candles.slice(-candleCount);
            ohlcv = {
                open: arr.map(c => c.o),
                high: arr.map(c => c.h),
                low: arr.map(c => c.l),
                close: arr.map(c => c.c),
                volume: arr.map(c => c.v),
            };
        } else {
            return null;
        }

        const result = await this.compute(ohlcv, indicators, params);

        return {
            symbol,
            date: doc.date,
            candleCount: ohlcv.close.length,
            indicators: result,
        };
    }

    disconnect() {
        if (this._pool) {
            try { this._pool.stdin.write(JSON.stringify({ command: 'shutdown' }) + '\n'); } catch { /* ignore */ }
            setTimeout(() => {
                try { this._pool.kill('SIGTERM'); } catch { /* ignore */ }
            }, 2000);
            this._pool = null;
        }
        if (this._db) {
            this._db.close().catch(() => {});
            this._db = null;
        }
        this._connected = false;
        this._cache.clear();
    }
}

module.exports = { IndicatorEngine, IndicatorEngineError };
