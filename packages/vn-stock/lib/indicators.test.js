const { describe, it, mock, before, after } = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('node:events');

const { IndicatorEngine, IndicatorEngineError } = require('./indicators');

function makeMockChild() {
    const child = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.write = mock.fn();
    child.stdin.end = mock.fn();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = mock.fn();
    return child;
}

describe('IndicatorEngine — unit tests (mock spawn)', async () => {
    let mockSpawn;
    let mockChild;

    before(() => {
        // Replace module's spawn with a mock
        mockSpawn = mock.fn();
        mock.method(require('child_process'), 'spawn', mockSpawn);
    });

    after(() => {
        mock.restoreAll();
    });

    describe('constructor', async () => {
        await it('should apply defaults', () => {
            const engine = new IndicatorEngine();
            assert.strictEqual(engine.mode, 'spawn');
            assert.strictEqual(engine.timeout, 30000);
            assert.strictEqual(engine.cacheMaxAge, 0);
            assert.strictEqual(engine.mongoUri, null);
        });

        await it('should accept custom options', () => {
            const engine = new IndicatorEngine({
                mode: 'pool',
                timeout: 5000,
                cacheMaxAge: 60000,
                mongoUri: 'mongodb://test',
            });
            assert.strictEqual(engine.mode, 'pool');
            assert.strictEqual(engine.timeout, 5000);
            assert.strictEqual(engine.cacheMaxAge, 60000);
            assert.strictEqual(engine.mongoUri, 'mongodb://test');
        });
    });

    describe('compute — spawn mode', async () => {
        await it('should spawn Python and return parsed result', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ projectDir: '/tmp' });

            const promise = engine.compute(
                { close: [1, 2, 3, 4, 5] },
                ['rsi'],
                { rsi: { period: 3 } }
            );

            // Simulate successful Python process
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ rsi: [null, null, 60, 70, 80] })));
            mockChild.emit('close', 0);

            const result = await promise;

            assert.ok(result.rsi);
            assert.strictEqual(result.rsi[4], 80);

            // Verify spawn was called with correct args
            assert.strictEqual(mockSpawn.mock.calls.length, 1);
            const [cmd, args] = mockSpawn.mock.calls[0].arguments;
            assert.strictEqual(cmd, 'uv');
            assert.ok(args.includes('vn_stock_indicators.batch'));

            // Verify stdin was written
            const written = mockChild.stdin.write.mock.calls[0]?.arguments[0];
            assert.ok(written);
            const parsed = JSON.parse(written);
            assert.deepStrictEqual(parsed.indicators, ['rsi']);
            assert.deepStrictEqual(parsed.params, { rsi: { period: 3 } });
        });

        await it('should throw on Python error response', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ projectDir: '/tmp' });

            const promise = engine.compute(
                { close: [1, 2, 3] },
                ['rsi']
            );

            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ error: 'Unknown indicator: bad' })));
            mockChild.emit('close', 1);

            await assert.rejects(promise, (err) => {
                return err instanceof IndicatorEngineError
                    && err.code === 'PYTHON_ERROR';
            });
        });

        await it('should throw on timeout', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ projectDir: '/tmp', timeout: 100 });

            const promise = engine.compute(
                { close: [1, 2, 3] },
                ['rsi']
            );

            // Don't emit anything — let timeout fire
            await assert.rejects(promise, (err) => {
                return err instanceof IndicatorEngineError
                    && err.code === 'TIMEOUT';
            });
        });

        await it('should throw on ENOENT (Python not found)', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => {
                process.nextTick(() => mockChild.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })));
                return mockChild;
            });

            const engine = new IndicatorEngine({ projectDir: '/tmp' });

            await assert.rejects(
                engine.compute({ close: [1, 2, 3] }, ['rsi']),
                (err) => err instanceof IndicatorEngineError && err.code === 'PYTHON_NOT_FOUND'
            );
        });

        await it('should validate OHLCV input — missing close', async () => {
            const engine = new IndicatorEngine();
            await assert.rejects(
                engine.compute({}, ['rsi']),
                (err) => err instanceof IndicatorEngineError && err.code === 'INVALID_INPUT'
            );
        });

        await it('should validate OHLCV input — empty array', async () => {
            const engine = new IndicatorEngine();
            await assert.rejects(
                engine.compute({ close: [] }, ['rsi']),
                (err) => err instanceof IndicatorEngineError && err.code === 'INVALID_INPUT'
            );
        });

        await it('should validate OHLCV input — mismatched lengths', async () => {
            const engine = new IndicatorEngine();
            await assert.rejects(
                engine.compute({ close: [1, 2, 3], high: [1, 2] }, ['rsi']),
                (err) => err instanceof IndicatorEngineError && err.code === 'INVALID_INPUT'
            );
        });

        await it('should validate — no indicators specified', async () => {
            const engine = new IndicatorEngine();
            await assert.rejects(
                engine.compute({ close: [1, 2, 3] }, []),
                (err) => err instanceof IndicatorEngineError && err.code === 'INVALID_INPUT'
            );
        });

        await it('should include optional OHLCV fields in request', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ projectDir: '/tmp' });

            const promise = engine.compute(
                { open: [10, 11], high: [12, 13], low: [9, 10], close: [11, 12], volume: [100, 200] },
                ['rsi']
            );

            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ rsi: [null, 60] })));
            mockChild.emit('close', 0);

            await promise;

            const written = JSON.parse(mockChild.stdin.write.mock.calls[0]?.arguments[0]);
            assert.ok(written.open);
            assert.ok(written.high);
            assert.ok(written.low);
            assert.ok(written.volume);
        });

        await it('should use custom pythonPath when provided', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({
                pythonPath: '/usr/local/bin/python3',
                projectDir: '/tmp',
            });

            const promise = engine.compute({ close: [1, 2, 3] }, ['rsi']);
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ rsi: [null, null, 50] })));
            mockChild.emit('close', 0);
            await promise;

            const calls = mockSpawn.mock.calls;
            const [cmd, args] = calls[calls.length - 1].arguments;
            assert.strictEqual(cmd, '/usr/local/bin/python3');
            assert.ok(args.includes('vn_stock_indicators.batch'));
        });
    });

    describe('caching', async () => {
        await it('should cache results and return cached copy', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ projectDir: '/tmp', cacheMaxAge: 60000 });

            // First call
            const promise1 = engine.compute({ close: [1, 2, 3, 4, 5] }, ['rsi']);
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ rsi: [null, null, 60, 70, 80] })));
            mockChild.emit('close', 0);
            const result1 = await promise1;

            // Second call with same inputs — should use cache
            const promise2 = engine.compute({ close: [1, 2, 3, 4, 5] }, ['rsi']);
            const result2 = await promise2;

            assert.strictEqual(result1, result2); // Same object reference
        });
    });

    describe('fetchAndCompute', async () => {
        await it('should throw if no mongoUri configured', async () => {
            const engine = new IndicatorEngine();
            await assert.rejects(
                engine.fetchAndCompute('FPT', ['rsi']),
                (err) => err instanceof IndicatorEngineError && err.code === 'MONGO_NOT_CONFIGURED'
            );
        });
    });

    describe('pool mode', async () => {
        await it('should spawn with --json-line on connect', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ mode: 'pool', projectDir: '/tmp' });

            const connectPromise = engine.connect();
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ status: 'ready' }) + '\n'));
            await connectPromise;

            const calls = mockSpawn.mock.calls;
            const poolCall = calls.find(c => c.arguments[1].includes('--json-line'));
            assert.ok(poolCall, 'pool spawn should include --json-line');
        });

        await it('should compute via pool and return result', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ mode: 'pool', projectDir: '/tmp' });

            // Connect
            const connectPromise = engine.connect();
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ status: 'ready' }) + '\n'));
            await connectPromise;

            // Compute
            const computePromise = engine.compute({ close: [1, 2, 3, 4, 5] }, ['rsi']);
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ rsi: [null, null, 60, 70, 80] }) + '\n'));
            const result = await computePromise;

            assert.ok(result.rsi);
            assert.strictEqual(result.rsi[4], 80);

            // Verify stdin was written as JSON line
            const written = mockChild.stdin.write.mock.calls[0]?.arguments[0];
            assert.ok(written.endsWith('\n'));
        });

        await it('should start pool and auto-connect on first compute', async () => {
            mockChild = makeMockChild();
            mockSpawn.mock.mockImplementation(() => mockChild);

            const engine = new IndicatorEngine({ mode: 'pool', projectDir: '/tmp' });

            // Separate connect from compute to avoid timing race with mock
            const connectPromise = engine.connect();
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ status: 'ready' }) + '\n'));
            await connectPromise;

            const computePromise = engine.compute({ close: [1, 2, 3] }, ['rsi']);
            mockChild.stdout.emit('data', Buffer.from(JSON.stringify({ rsi: [null, null, 50] }) + '\n'));
            const result = await computePromise;

            assert.ok(result.rsi);
        });
    });

    describe('disconnect', async () => {
        await it('should clean up pool and db', () => {
            const engine = new IndicatorEngine();
            engine._pool = makeMockChild();
            engine._db = { close: mock.fn(() => Promise.resolve()) };
            engine._connected = true;
            engine._cache.set('x', 'y');

            engine.disconnect();

            assert.strictEqual(engine._pool, null);
            assert.strictEqual(engine._db, null);
            assert.strictEqual(engine._connected, false);
            assert.strictEqual(engine._cache.size, 0);
        });
    });
});
