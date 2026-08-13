const { MongoDatabase } = require('@andy-toolforge/db-mongo');

const DEFAULT_URI = process.env.STOCK_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stock_db';

class StockDB {
    constructor(uri = DEFAULT_URI) {
        this.uri = uri;
        this.mdb = new MongoDatabase(uri, {
            dbName: DB_NAME,
            poolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });
    }

    /** Backward-compat: the connected db handle (null until connect()). */
    get db() {
        return this.mdb.db;
    }

    async connect() {
        try {
            return await this.mdb.connect();
        } catch (err) {
            throw new Error(`Failed to connect to MongoDB: ${err.message}`);
        }
    }

    async close() {
        await this.mdb.close();
    }

    collection(name) {
        try {
            return this.mdb.collection(name);
        } catch (err) {
            throw new Error('Not connected. Call connect() first.');
        }
    }

    async getLatestCandles(collectionName) {
        const col = this.collection(collectionName);
        const docs = await col.find({}, {
            projection: { symbol: 1, date: 1, candles: { $slice: -2 } },
        }).toArray();
        return docs.map(doc => {
            const candles = doc.candles || [];
            const sorted = [...candles].sort((a, b) => (b.index || 0) - (a.index || 0));
            return {
                symbol: doc.symbol,
                date: doc.date,
                candle: sorted[0] || null,
                prevCandle: sorted[1] || null,
                candleCount: candles.length,
            };
        });
    }

    async getIntradayIndicators(symbols = []) {
        const col = this.collection('intraday_indicators');
        const filter = symbols.length > 0 ? { symbol: { $in: symbols } } : {};
        return col.find(filter).toArray();
    }

    async getFundamentals(symbols = []) {
        const col = this.collection('stock_fundamentals');
        const filter = symbols.length > 0 ? { symbol: { $in: symbols } } : {};
        return col.find(filter).toArray();
    }
}

module.exports = StockDB;
