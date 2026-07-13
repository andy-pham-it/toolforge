const StockDB = require('./db');

const COMPARE_OPS = {
    gt: (a, b) => a > b,
    gte: (a, b) => a >= b,
    lt: (a, b) => a < b,
    lte: (a, b) => a <= b,
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b,
    crossAbove: (a, b, prevA, prevB) => prevA <= prevB && a > b,
    crossBelow: (a, b, prevA, prevB) => prevA >= prevB && a < b,
};

class StockScreener {
    constructor(mongoUri) {
        this.db = new StockDB(mongoUri);
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        await this.db.close();
    }

    _getFieldValue(obj, fieldPath) {
        const parts = fieldPath.split('.');
        let val = obj;
        for (const part of parts) {
            if (val == null || typeof val !== 'object') return undefined;
            val = val[part];
        }
        return val;
    }

    _evaluateFilter(filterEntry, candle, prevCandle) {
        const { field, operator, value, compareToField } = filterEntry;
        const fieldVal = this._getFieldValue(candle, field);
        if (fieldVal === undefined || fieldVal === null) return false;

        if (compareToField) {
            const compareVal = this._getFieldValue(candle, compareToField);
            if (compareVal === undefined || compareVal === null) return false;
            const opFn = COMPARE_OPS[operator];
            if (!opFn) throw new Error(`Unknown operator: ${operator}`);

            if (operator === 'crossAbove' || operator === 'crossBelow') {
                const prevFieldVal = prevCandle ? this._getFieldValue(prevCandle, field) : fieldVal;
                const prevCompareVal = prevCandle ? this._getFieldValue(prevCandle, compareToField) : compareVal;
                return opFn(fieldVal, compareVal, prevFieldVal, prevCompareVal);
            }
            return opFn(fieldVal, compareVal);
        }

        const opFn = COMPARE_OPS[operator];
        if (!opFn) throw new Error(`Unknown operator: ${operator}`);
        return opFn(fieldVal, value);
    }

    _evaluateFilters(filters, candle, prevCandle) {
        if (!filters || filters.length === 0) return true;

        for (const f of filters) {
            if (!this._evaluateFilter(f, candle, prevCandle)) {
                return false;
            }
        }
        return true;
    }

    async screenDaily(options = {}) {
        const {
            filters = [],
            limit = 50,
            sortBy = null,
            sortDesc = true,
        } = options;

        await this.connect();
        const docs = await this.db.getLatestCandles('stock_1d');

        const results = [];
        for (const doc of docs) {
            if (!doc.candle) continue;
            const prevCandle = doc.candle && doc.prevCandle ? doc.prevCandle : null;
            if (this._evaluateFilters(filters, doc.candle, prevCandle)) {
                results.push({
                    symbol: doc.symbol,
                    date: doc.date,
                    ...doc.candle,
                });
            }
        }

        if (sortBy) {
            results.sort((a, b) => {
                const av = this._getFieldValue(a, sortBy) || 0;
                const bv = this._getFieldValue(b, sortBy) || 0;
                return sortDesc ? bv - av : av - bv;
            });
        }

        return results.slice(0, limit);
    }

    async screenIntraday(options = {}) {
        const {
            filters = [],
            interval = '15m',
            limit = 50,
        } = options;

        await this.connect();
        const indicators = await this.db.getIntradayIndicators();

        const filtered = indicators.filter(ind => {
            if (ind.interval !== interval) return false;
            const candle = ind.indicators || {};
            return this._evaluateFilters(filters, candle, null);
        });

        const results = filtered.map(ind => ({
            symbol: ind.symbol,
            interval: ind.interval,
            ...(ind.indicators || {}),
        }));

        return results.slice(0, limit);
    }

    async getSymbolInfo(symbol) {
        await this.connect();
        const [dailyData] = await this.db.collection('stock_1d')
            .find({ symbol })
            .sort({ date: -1 })
            .limit(1)
            .toArray();
        const intraday = await this.db.getIntradayIndicators([symbol]);
        const fundamentals = await this.db.getFundamentals([symbol]);

        const latestCandle = dailyData?.candles
            ? [...dailyData.candles].sort((a, b) => (b.index || 0) - (a.index || 0))[0]
            : null;

        return {
            symbol,
            daily: latestCandle || null,
            dailyDate: dailyData?.date || null,
            intraday: intraday.find(i => i.interval === '15m')?.indicators || null,
            fundamentals: fundamentals[0] || null,
        };
    }
}

module.exports = StockScreener;
