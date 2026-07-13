const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const StockDB = require('./db');
const StockScreener = require('./screener');
const StockScorer = require('./scorer');

const TEST_PREFIX = 'ZZ_INTEG_';
const TEST_DATE = '2026-07-13';

function makeCandle(index, overrides = {}) {
    const base = {
        index, o: 100, h: 105, l: 98, c: 103, v: 1_500_000,
        rsi: index % 2 === 0 ? 65 : 35,
        ema20: index % 2 === 0 ? 105 : 95,
        ema50: 100, ema100: 98,
        macd: index % 2 === 0 ? 2.0 : -1.0,
        signal: 1.0, histogram: index % 2 === 0 ? 0.5 : -0.3,
        bb_upper: 110, bb_lower: 90, bb_width: 3.5,
        atr_pct: 1.5, vol_ma20: 1_000_000,
        stoch_k: index % 2 === 0 ? 75 : 25,
        stoch_d: index % 2 === 0 ? 60 : 35,
        obv: 1_000_000 + (index * 10_000),
        vwap: 102, mfi: index % 2 === 0 ? 65 : 30,
        price_change_pct: index % 2 === 0 ? 2.0 : -1.5,
        ...overrides,
    };
    return base;
}

const dailyDocs = [
    {
        symbol: `${TEST_PREFIX}FPT`, date: TEST_DATE,
        candles: [
            makeCandle(9),
            makeCandle(10, { rsi: 72, ema20: 108, c: 106, volume: 3_000_000, vol_ma20: 1_000_000, obv: 1_100_000, price_change_pct: 3.5 }),
        ],
    },
    {
        symbol: `${TEST_PREFIX}VNM`, date: TEST_DATE,
        candles: [
            makeCandle(8, { rsi: 30 }),
            makeCandle(9, { rsi: 28, ema20: 92, c: 95, volume: 300_000, vol_ma20: 800_000, obv: 900_000, price_change_pct: -2.0 }),
        ],
    },
];

const intradayDocs = [
    { symbol: `${TEST_PREFIX}FPT`, interval: '15m', indicators: { rsi: 55, ema20: 103 } },
    { symbol: `${TEST_PREFIX}FPT`, interval: '1h', indicators: { rsi: 58, ema20: 104 } },
    { symbol: `${TEST_PREFIX}VNM`, interval: '15m', indicators: { rsi: 40, ema20: 95 } },
];

const fundamentalDocs = [
    { symbol: `${TEST_PREFIX}FPT`, pe: 14, pb: 2.0, roe: 22, eps_growth: 25 },
    { symbol: `${TEST_PREFIX}VNM`, pe: 8, pb: 1.2, roe: 15, eps_growth: 10 },
];

describe('Integration — StockDB + Screener + Scorer (MongoDB)', async () => {
    let db;
    let available = false;

    before(async () => {
        db = new StockDB();
        try {
            await db.connect();
            available = true;
        } catch {
            console.log('MongoDB not available — skipping integration tests');
            return;
        }
        for (const doc of dailyDocs) {
            await db.collection('stock_1d').insertOne(doc);
        }
        for (const doc of intradayDocs) {
            await db.collection('intraday_indicators').insertOne(doc);
        }
        for (const doc of fundamentalDocs) {
            await db.collection('stock_fundamentals').insertOne(doc);
        }
    });

    after(async () => {
        if (!available || !db) return;
        await db.collection('stock_1d').deleteMany({ symbol: { $regex: `^${TEST_PREFIX}` } });
        await db.collection('intraday_indicators').deleteMany({ symbol: { $regex: `^${TEST_PREFIX}` } });
        await db.collection('stock_fundamentals').deleteMany({ symbol: { $regex: `^${TEST_PREFIX}` } });
        await db.close();
    });

    describe('StockDB', async () => {
        await it('should connect and return test DB', () => {
            assert.ok(available, 'MongoDB must be available');
            assert.ok(db.db);
            assert.strictEqual(db.db.databaseName, 'stock_db');
        });

        await it('getLatestCandles should return latest candle + prevCandle', async () => {
            const candles = await db.getLatestCandles('stock_1d');
            const fpt = candles.find(c => c.symbol === `${TEST_PREFIX}FPT`);
            assert.ok(fpt);
            assert.ok(fpt.candle);
            assert.strictEqual(fpt.candle.index, 10);
            assert.ok(fpt.prevCandle);
            assert.strictEqual(fpt.prevCandle.index, 9);
            assert.strictEqual(fpt.candleCount, 2);
        });

        await it('getIntradayIndicators should filter by symbols', async () => {
            const filtered = await db.getIntradayIndicators([`${TEST_PREFIX}FPT`]);
            assert.ok(filtered.every(i => i.symbol === `${TEST_PREFIX}FPT`));
            const fpt15m = filtered.find(i => i.interval === '15m');
            assert.ok(fpt15m);
            assert.strictEqual(fpt15m.indicators.rsi, 55);
        });

        await it('getFundamentals should return seeded data', async () => {
            const all = await db.getFundamentals();
            const fptFund = all.find(f => f.symbol === `${TEST_PREFIX}FPT`);
            assert.ok(fptFund);
            assert.strictEqual(fptFund.pe, 14);
        });
    });

    describe('StockScreener', async () => {
        let screener;

        before(async () => {
            screener = new StockScreener();
        });

        after(async () => {
            await screener.close();
        });

        await it('screenDaily should filter by RSI condition', async () => {
            const results = await screener.screenDaily({
                filters: [{ field: 'rsi', operator: 'gt', value: 60 }],
            });
            const fpt = results.find(r => r.symbol === `${TEST_PREFIX}FPT`);
            const vnm = results.find(r => r.symbol === `${TEST_PREFIX}VNM`);
            assert.ok(fpt);
            assert.strictEqual(fpt.rsi, 72);
            assert.ok(!vnm);
        });

        await it('screenDaily should handle EMA crossover filter', async () => {
            const results = await screener.screenDaily({
                filters: [{ field: 'ema20', operator: 'gt', compareToField: 'ema50' }],
            });
            const fpt = results.find(r => r.symbol === `${TEST_PREFIX}FPT`);
            assert.ok(fpt);
            assert.ok(fpt.ema20 > fpt.ema50);
        });

        await it('screenDaily should sort by field', async () => {
            const results = await screener.screenDaily({ sortBy: 'rsi', limit: 10 });
            assert.ok(results.length >= 2);
            for (let i = 1; i < results.length; i++) {
                assert.ok(results[i - 1].rsi >= results[i].rsi);
            }
        });

        await it('screenIntraday should filter by interval and condition', async () => {
            const results = await screener.screenIntraday({
                interval: '15m',
                filters: [{ field: 'rsi', operator: 'gt', value: 50 }],
            });
            assert.ok(results.every(r => r.interval === '15m'));
            const fpt = results.find(r => r.symbol === `${TEST_PREFIX}FPT`);
            assert.ok(fpt);
            assert.ok(fpt.rsi >= 50);
            const vnm = results.find(r => r.symbol === `${TEST_PREFIX}VNM`);
            assert.ok(!vnm);
        });

        await it('screenIntraday should return 1h interval', async () => {
            const results = await screener.screenIntraday({ interval: '1h' });
            assert.ok(results.length >= 1);
            assert.ok(results.every(r => r.interval === '1h'));
        });

        await it('getSymbolInfo should merge daily + intraday + fundamentals', async () => {
            const info = await screener.getSymbolInfo(`${TEST_PREFIX}FPT`);
            assert.strictEqual(info.symbol, `${TEST_PREFIX}FPT`);
            assert.ok(info.daily);
            assert.strictEqual(info.daily.rsi, 72);
            assert.strictEqual(info.dailyDate, TEST_DATE);
            assert.ok(info.intraday);
            assert.strictEqual(info.intraday.rsi, 55);
            assert.ok(info.fundamentals);
            assert.strictEqual(info.fundamentals.pe, 14);
        });

        await it('getSymbolInfo should return nulls for unknown symbol', async () => {
            const info = await screener.getSymbolInfo('ZZ_NONEXISTENT');
            assert.strictEqual(info.symbol, 'ZZ_NONEXISTENT');
            assert.strictEqual(info.daily, null);
            assert.strictEqual(info.intraday, null);
            assert.strictEqual(info.fundamentals, null);
        });
    });

    describe('StockScorer', async () => {
        await it('scoreCandle with real data should produce reasonable score', () => {
            const scorer = new StockScorer();
            const fptDaily = dailyDocs[0].candles[1];
            const fptFund = fundamentalDocs[0];
            const fptPrev = dailyDocs[0].candles[0];
            const result = scorer.scoreCandle(fptDaily, fptFund, fptPrev);
            assert.ok(result.total >= 0 && result.total <= 100);
            assert.ok(result.total > 50, `Expected >50 for bullish FPT, got ${result.total}`);
        });

        await it('scoreAll should rank symbols by total score', async () => {
            const scorer = new StockScorer();
            const results = await scorer.scoreAll({ limit: 10 });
            const fpt = results.find(r => r.symbol === `${TEST_PREFIX}FPT`);
            const vnm = results.find(r => r.symbol === `${TEST_PREFIX}VNM`);
            assert.ok(fpt);
            assert.ok(vnm);
            assert.ok(fpt.score > vnm.score,
                `FPT (${fpt.score}) should rank > VNM (${vnm.score})`);
            for (let i = 1; i < results.length; i++) {
                assert.ok(results[i - 1].score >= results[i].score,
                    `Sorted: ${results[i-1].score} >= ${results[i].score}`);
            }
        });

        await it('scoreAll should respect limit option', async () => {
            const scorer = new StockScorer();
            const results = await scorer.scoreAll({ limit: 1 });
            assert.strictEqual(results.length, 1);
        });

        await it('scoreIntraday should return scored result for a symbol', async () => {
            const scorer = new StockScorer();
            const result = await scorer.scoreIntraday(`${TEST_PREFIX}FPT`, '15m');
            assert.ok(result, 'should return result');
            assert.strictEqual(result.symbol, `${TEST_PREFIX}FPT`);
            assert.strictEqual(result.interval, '15m');
            assert.ok(result.score > 0 && result.score <= 100);
            assert.ok(result.breakdown.technical);
            assert.ok(result.breakdown.volume);
            assert.ok(result.breakdown.momentum);
            assert.ok(result.breakdown.fundamental);
        });

        await it('scoreIntraday should return null for unknown symbol', async () => {
            const scorer = new StockScorer();
            const result = await scorer.scoreIntraday('ZZ_NONEXISTENT', '15m');
            assert.strictEqual(result, null);
        });

        await it('scoreAllIntraday should rank all symbols on interval', async () => {
            const scorer = new StockScorer();
            const results = await scorer.scoreAllIntraday({ interval: '15m', limit: 10 });
            assert.ok(results.length >= 2, `Expected >=2, got ${results.length}`);
            for (let i = 1; i < results.length; i++) {
                assert.ok(results[i - 1].score >= results[i].score);
            }
            const fpt = results.find(r => r.symbol === `${TEST_PREFIX}FPT`);
            const vnm = results.find(r => r.symbol === `${TEST_PREFIX}VNM`);
            assert.ok(fpt, 'FPT should be present');
            assert.ok(vnm, 'VNM should be present');
        });

        await it('scoreAllIntraday should respect limit', async () => {
            const scorer = new StockScorer();
            const results = await scorer.scoreAllIntraday({ interval: '15m', limit: 1 });
            assert.strictEqual(results.length, 1);
        });
    });
});
