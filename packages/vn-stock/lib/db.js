const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.STOCK_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'stock_db';

class StockDB {
    constructor(uri = DEFAULT_URI) {
        this.uri = uri;
        this.client = null;
        this.db = null;
    }

    async connect() {
        if (this._connecting) return this._connecting;
        this._connecting = (async () => {
            if (this.db) return this.db;
            this.client = new MongoClient(this.uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
            });
            await this.client.connect();
            this.db = this.client.db(DB_NAME);
            return this.db;
        })();
        return this._connecting;
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
        }
    }

    collection(name) {
        if (!this.db) throw new Error('Not connected. Call connect() first.');
        return this.db.collection(name);
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
