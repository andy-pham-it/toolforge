const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const StockScreener = require('./screener');

describe('StockScreener', async () => {
    describe('_getFieldValue', async () => {
        await it('should get top-level value', () => {
            const s = new StockScreener();
            assert.strictEqual(s._getFieldValue({ rsi: 70 }, 'rsi'), 70);
        });

        await it('should get nested value via dot notation', () => {
            const s = new StockScreener();
            const obj = { indicators: { rsi: 65, macd: 2.5 } };
            assert.strictEqual(s._getFieldValue(obj, 'indicators.rsi'), 65);
            assert.strictEqual(s._getFieldValue(obj, 'indicators.macd'), 2.5);
        });

        await it('should return undefined for missing field', () => {
            const s = new StockScreener();
            assert.strictEqual(s._getFieldValue({ rsi: 70 }, 'ema20'), undefined);
        });

        await it('should return undefined for null object', () => {
            const s = new StockScreener();
            assert.strictEqual(s._getFieldValue(null, 'rsi'), undefined);
        });
    });

    describe('_evaluateFilter', async () => {
        await it('should evaluate gt correctly (field vs value)', () => {
            const s = new StockScreener();
            const candle = { rsi: 75 };
            assert.ok(s._evaluateFilter({ field: 'rsi', operator: 'gt', value: 70 }, candle, null));
            assert.ok(!s._evaluateFilter({ field: 'rsi', operator: 'gt', value: 80 }, candle, null));
        });

        await it('should evaluate lt correctly', () => {
            const s = new StockScreener();
            const candle = { rsi: 25 };
            assert.ok(s._evaluateFilter({ field: 'rsi', operator: 'lt', value: 30 }, candle, null));
            assert.ok(!s._evaluateFilter({ field: 'rsi', operator: 'lt', value: 20 }, candle, null));
        });

        await it('should evaluate cross-field comparison', () => {
            const s = new StockScreener();
            const candle = { ema20: 105, ema50: 100 };
            assert.ok(s._evaluateFilter({ field: 'ema20', operator: 'gt', compareToField: 'ema50' }, candle, null));
            assert.ok(!s._evaluateFilter({ field: 'ema50', operator: 'gt', compareToField: 'ema20' }, candle, null));
        });

        await it('should return false for missing field value', () => {
            const s = new StockScreener();
            const candle = { rsi: 75 };
            assert.ok(!s._evaluateFilter({ field: 'bb_upper', operator: 'gt', value: 100 }, candle, null));
        });

        await it('should detect crossAbove crossover', () => {
            const s = new StockScreener();
            const candle = { ema20: 105, ema50: 100 };
            const prevCandle = { ema20: 98, ema50: 100 };
            assert.ok(s._evaluateFilter({ field: 'ema20', operator: 'crossAbove', compareToField: 'ema50' }, candle, prevCandle));
        });

        await it('should NOT detect crossAbove if no crossover', () => {
            const s = new StockScreener();
            const candle = { ema20: 105, ema50: 100 };
            const prevCandle = { ema20: 102, ema50: 100 };
            assert.ok(!s._evaluateFilter({ field: 'ema20', operator: 'crossAbove', compareToField: 'ema50' }, candle, prevCandle));
        });

        await it('should detect crossBelow crossover', () => {
            const s = new StockScreener();
            const candle = { ema20: 95, ema50: 100 };
            const prevCandle = { ema20: 102, ema50: 100 };
            assert.ok(s._evaluateFilter({ field: 'ema20', operator: 'crossBelow', compareToField: 'ema50' }, candle, prevCandle));
        });

        await it('should throw for unknown operator', () => {
            const s = new StockScreener();
            assert.throws(() => {
                s._evaluateFilter({ field: 'rsi', operator: 'unknown', value: 70 }, { rsi: 50 }, null);
            }, /Unknown operator/);
        });
    });

    describe('_evaluateFilters', async () => {
        await it('should return true when no filters', () => {
            const s = new StockScreener();
            assert.ok(s._evaluateFilters(null, {}, null));
            assert.ok(s._evaluateFilters([], {}, null));
        });

        await it('should AND all filters together', () => {
            const s = new StockScreener();
            const candle = { rsi: 75, volume: 1000000, vol_ma20: 500000 };
            const filters = [
                { field: 'rsi', operator: 'gt', value: 70 },
                { field: 'volume', operator: 'gt', compareToField: 'vol_ma20' },
            ];
            assert.ok(s._evaluateFilters(filters, candle, null));
        });

        await it('should return false if one filter fails', () => {
            const s = new StockScreener();
            const candle = { rsi: 75, volume: 100000, vol_ma20: 500000 };
            const filters = [
                { field: 'rsi', operator: 'gt', value: 70 },
                { field: 'volume', operator: 'gt', compareToField: 'vol_ma20' },
            ];
            assert.ok(!s._evaluateFilters(filters, candle, null));
        });
    });

    describe('screenDaily', async () => {
        await it('should be a function', () => {
            const s = new StockScreener();
            assert.strictEqual(typeof s.screenDaily, 'function');
        });

        await it('should not crash with realistic candle data (index > 0, prevCandle)', async () => {
            const s = new StockScreener();
            // Mock db methods to avoid real connection
            const mockDocs = [
                {
                    symbol: 'FPT',
                    date: '2026-07-10',
                    candle: { rsi: 75, ema20: 105, ema50: 100, index: 10 },
                    prevCandle: { rsi: 65, ema20: 98, ema50: 100, index: 9 },
                },
                {
                    symbol: 'VNM',
                    date: '2026-07-10',
                    candle: { rsi: 28, ema20: 90, ema50: 95, index: 8 },
                    prevCandle: { rsi: 32, ema20: 88, ema50: 95, index: 7 },
                },
                {
                    symbol: 'HPG',
                    date: '2026-07-10',
                    candle: null,
                    prevCandle: null,
                },
            ];
            s.db.getLatestCandles = async () => mockDocs;
            s.db.connect = async () => {};
            s.db.close = async () => {};

            const results = await s.screenDaily({
                filters: [
                    { field: 'rsi', operator: 'gt', value: 50 },
                ],
                limit: 10,
            });

            assert.ok(Array.isArray(results));
            assert.strictEqual(results.length, 1); // Only FPT (rsi=75 > 50)
            assert.strictEqual(results[0].symbol, 'FPT');
        });

        await it('should handle crossAbove filter safely', async () => {
            const s = new StockScreener();
            const mockDocs = [
                {
                    symbol: 'FPT',
                    date: '2026-07-10',
                    candle: { ema20: 105, ema50: 100, index: 10 },
                    prevCandle: { ema20: 98, ema50: 100, index: 9 },
                },
            ];
            s.db.getLatestCandles = async () => mockDocs;
            s.db.connect = async () => {};
            s.db.close = async () => {};

            // crossAbove with real prevCandle should detect crossover
            const crossResults = await s.screenDaily({
                filters: [
                    { field: 'ema20', operator: 'crossAbove', compareToField: 'ema50' },
                ],
            });
            assert.strictEqual(crossResults.length, 1);
            assert.strictEqual(crossResults[0].symbol, 'FPT');

            // Same filter but no crossover (already above)
            mockDocs[0].prevCandle = { ema20: 102, ema50: 100, index: 9 };
            const noCrossResults = await s.screenDaily({
                filters: [
                    { field: 'ema20', operator: 'crossAbove', compareToField: 'ema50' },
                ],
            });
            assert.strictEqual(noCrossResults.length, 0);
        });
    });

    describe('screenIntraday', async () => {
        await it('should be a function', () => {
            const s = new StockScreener();
            assert.strictEqual(typeof s.screenIntraday, 'function');
        });

        await it('should filter by interval and conditions', async () => {
            const s = new StockScreener();
            s.db.getIntradayIndicators = async () => [
                { symbol: 'FPT', interval: '15m', indicators: { rsi: 72, ema20: 110 } },
                { symbol: 'VNM', interval: '15m', indicators: { rsi: 28, ema20: 80 } },
                { symbol: 'FPT', interval: '1h', indicators: { rsi: 65, ema20: 105 } },
            ];
            s.db.connect = async () => {};
            s.db.close = async () => {};

            const results = await s.screenIntraday({
                interval: '15m',
                filters: [
                    { field: 'rsi', operator: 'gt', value: 50 },
                ],
                limit: 10,
            });

            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].symbol, 'FPT');
            assert.strictEqual(results[0].interval, '15m');
            assert.strictEqual(results[0].rsi, 72);
        });

        await it('should return empty array when no match', async () => {
            const s = new StockScreener();
            s.db.getIntradayIndicators = async () => [
                { symbol: 'FPT', interval: '15m', indicators: { rsi: 25 } },
            ];
            s.db.connect = async () => {};
            s.db.close = async () => {};

            const results = await s.screenIntraday({
                interval: '15m',
                filters: [{ field: 'rsi', operator: 'gt', value: 50 }],
            });

            assert.strictEqual(results.length, 0);
        });
    });

    describe('getSymbolInfo', async () => {
        await it('should return merged daily + intraday + fundamentals', async () => {
            const s = new StockScreener();
            s.db.connect = async () => {};
            s.db.close = async () => {};
            s.db.collection = () => ({
                find: () => ({
                    sort: () => ({
                        limit: () => ({
                            toArray: async () => [
                                {
                                    symbol: 'FPT',
                                    date: '2026-07-10',
                                    candles: [
                                        { index: 1, rsi: 72, ema20: 110, ema50: 100 },
                                        { index: 0, rsi: 68, ema20: 105, ema50: 100 },
                                    ],
                                },
                            ],
                        }),
                    }),
                }),
            });
            s.db.getIntradayIndicators = async () => [
                { symbol: 'FPT', interval: '15m', indicators: { rsi: 65 } },
            ];
            s.db.getFundamentals = async () => [
                { symbol: 'FPT', pe: 12, pb: 1.5, roe: 18 },
            ];

            const info = await s.getSymbolInfo('FPT');
            assert.strictEqual(info.symbol, 'FPT');
            assert.strictEqual(info.daily.rsi, 72); // latest candle (index 1)
            assert.strictEqual(info.dailyDate, '2026-07-10');
            assert.strictEqual(info.intraday.rsi, 65);
            assert.strictEqual(info.fundamentals.pe, 12);
        });

        await it('should handle symbol with no data gracefully', async () => {
            const s = new StockScreener();
            s.db.connect = async () => {};
            s.db.close = async () => {};
            s.db.collection = () => ({
                find: () => ({
                    sort: () => ({
                        limit: () => ({
                            toArray: async () => [],
                        }),
                    }),
                }),
            });
            s.db.getIntradayIndicators = async () => [];
            s.db.getFundamentals = async () => [];

            const info = await s.getSymbolInfo('UNKNOWN');
            assert.strictEqual(info.symbol, 'UNKNOWN');
            assert.strictEqual(info.daily, null);
            assert.strictEqual(info.dailyDate, null);
            assert.strictEqual(info.intraday, null);
            assert.deepStrictEqual(info.fundamentals, null);
        });
    });
});
