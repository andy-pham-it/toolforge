const StockDB = require('./db');

const DEFAULT_WEIGHTS = {
    technical: 0.40,
    volume: 0.20,
    momentum: 0.20,
    fundamental: 0.20,
};

class StockScorer {
    constructor(config = {}) {
        this.weights = { ...DEFAULT_WEIGHTS, ...config.weights };
    }

    /**
     * Score a single daily candle with optional fundamental data.
     * @param {object} candle - Candle with indicator fields (rsi, ema20, ema50, macd, signal, etc.)
     * @param {object|null} fundamentals - Fundamental data { pe, pb, roe, eps_growth }
     * @param {object|null} prevCandle - Previous candle (for OBV divergence detection)
     * @returns {{ total: number, breakdown: object }}
     */
    scoreCandle(candle, fundamentals = null, prevCandle = null) {
        const technical = this._scoreTechnical(candle);
        const volume = this._scoreVolume(candle, prevCandle);
        const momentum = this._scoreMomentum(candle);
        const fundamental = this._scoreFundamental(fundamentals);

        const total =
            technical.score * this.weights.technical +
            volume.score * this.weights.volume +
            momentum.score * this.weights.momentum +
            fundamental.score * this.weights.fundamental;

        return {
            total: Math.round(total * 100) / 100,
            breakdown: { technical, volume, momentum, fundamental },
        };
    }

    /**
     * Screen all symbols and return scored results sorted descending by total score.
     * @param {object} [options]
     * @param {number} [options.limit=50]
     * @returns {Promise<Array<{ symbol: string, date: string, score: number, breakdown: object }>>}
     */
    async scoreAll(options = {}) {
        const { limit = 50 } = options;
        const db = new StockDB();
        try {
            await db.connect();
            const [candles, allFundamentals] = await Promise.all([
                db.getLatestCandles('stock_1d'),
                db.getFundamentals(),
            ]);
            // Build symbol→fundamentals map (1 batch query instead of N)
            const fundamentalsMap = new Map();
            for (const f of allFundamentals) {
                fundamentalsMap.set(f.symbol, f);
            }
            const results = [];
            for (const doc of candles) {
                if (!doc.candle) continue;
                const fundamentals = fundamentalsMap.get(doc.symbol) || null;
                const score = this.scoreCandle(doc.candle, fundamentals, doc.prevCandle);
                results.push({
                    symbol: doc.symbol,
                    date: doc.date,
                    score: score.total,
                    breakdown: score.breakdown,
                });
            }
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        } finally {
            await db.close();
        }
    }

    /**
     * Score a single symbol's intraday indicators.
     * @param {string} symbol - Stock symbol
     * @param {string} [interval='15m'] - Timeframe: '15m' or '1h'
     * @returns {Promise<object|null>} Scored result or null if no data
     */
    async scoreIntraday(symbol, interval = '15m') {
        const db = new StockDB();
        try {
            await db.connect();
            const indicators = await db.getIntradayIndicators([symbol]);
            const match = indicators.find(i => i.interval === interval);
            if (!match) return null;
            const candle = match.indicators || {};
            const score = this.scoreCandle(candle, null, null);
            return {
                symbol,
                interval,
                date: match.date || null,
                score: score.total,
                breakdown: score.breakdown,
            };
        } finally {
            await db.close();
        }
    }

    /**
     * Score all symbols on a given intraday interval, ranked by total score.
     * @param {object} [options]
     * @param {string} [options.interval='15m']
     * @param {number} [options.limit=50]
     * @returns {Promise<Array>}
     */
    async scoreAllIntraday(options = {}) {
        const { interval = '15m', limit = 50 } = options;
        const db = new StockDB();
        try {
            await db.connect();
            const all = await db.getIntradayIndicators();
            const results = [];
            for (const ind of all) {
                if (ind.interval !== interval) continue;
                const candle = ind.indicators || {};
                const score = this.scoreCandle(candle, null, null);
                results.push({
                    symbol: ind.symbol,
                    interval,
                    date: ind.date || null,
                    score: score.total,
                    breakdown: score.breakdown,
                });
            }
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        } finally {
            await db.close();
        }
    }

    // ---- Technical (0-100) ----
    _scoreTechnical(candle) {
        const signals = [];
        let score = 50;

        // RSI contribution (30%)
        const rsi = candle.rsi;
        if (rsi != null) {
            const rsiScore = this._scoreRsi(rsi);
            score += rsiScore * 0.30;
            if (rsiScore > 0) signals.push({ type: 'bullish', indicator: 'rsi', message: `RSI ${rsi} in bullish range` });
            else if (rsiScore < 0) signals.push({ type: 'bearish', indicator: 'rsi', message: `RSI ${rsi} in bearish range` });
        }

        // EMA alignment (40%)
        const ema20 = candle.ema20, ema50 = candle.ema50, ema100 = candle.ema100;
        if (ema20 != null && ema50 != null) {
            if (ema20 > ema50) {
                score += 15;
                signals.push({ type: 'bullish', indicator: 'ema_cross', message: 'EMA20 above EMA50 (uptrend)' });
            } else {
                score -= 15;
                signals.push({ type: 'bearish', indicator: 'ema_cross', message: 'EMA20 below EMA50 (downtrend)' });
            }
            if (ema20 > ema100) {
                score += 10;
                signals.push({ type: 'bullish', indicator: 'ema_trend', message: 'EMA20 above EMA100' });
            } else {
                score -= 10;
            }
        }

        // MACD contribution (30%)
        const macd = candle.macd, signal = candle.signal;
        if (macd != null && signal != null) {
            if (macd > signal) {
                score += 15;
                signals.push({ type: 'bullish', indicator: 'macd', message: 'MACD above signal line' });
            } else {
                score -= 15;
                signals.push({ type: 'bearish', indicator: 'macd', message: 'MACD below signal line' });
            }
            const hist = candle.histogram;
            if (hist != null && hist > 0) {
                score += 10;
                signals.push({ type: 'bullish', indicator: 'macd_hist', message: 'MACD histogram positive' });
            }
        }

        // Bollinger Band position (up to ±13)
        const close = candle.c;
        const bbUpper = candle.bb_upper, bbLower = candle.bb_lower;
        if (close != null && bbUpper != null && bbLower != null) {
            if (close >= bbUpper) {
                score += 8;
                signals.push({ type: 'bullish', indicator: 'bollinger', message: 'Price at/above upper Bollinger Band' });
            } else if (close <= bbLower) {
                score += 8;
                signals.push({ type: 'bullish', indicator: 'bollinger', message: 'Price at/below lower Bollinger Band (oversold bounce)' });
            }
            if (candle.bb_width != null && candle.bb_width < 2) {
                score += 5;
                signals.push({ type: 'bullish', indicator: 'bb_squeeze', message: 'Bollinger squeeze — breakout potential' });
            }
        }

        // ATR volatility (up to ±5)
        if (candle.atr_pct != null) {
            if (candle.atr_pct > 3) {
                score += 5;
                signals.push({ type: 'bullish', indicator: 'atr', message: `ATR ${candle.atr_pct.toFixed(1)}% — high volatility` });
            } else if (candle.atr_pct < 0.5) {
                score -= 5;
                signals.push({ type: 'bearish', indicator: 'atr', message: `ATR ${candle.atr_pct.toFixed(1)}% — low volatility` });
            }
        }

        return {
            score: Math.max(0, Math.min(100, Math.round(score))),
            signals,
        };
    }

    // ---- Volume (0-100) ----
    _scoreVolume(candle, prevCandle = null) {
        const signals = [];
        let score = 50;
        const vol = candle.volume, volMa = candle.vol_ma20;

        if (vol != null && volMa != null && volMa > 0) {
            const ratio = vol / volMa;
            if (ratio > 2.0) { score += 40; signals.push({ type: 'bullish', indicator: 'volume_spike', message: `Volume ${ratio.toFixed(1)}x MA — strong activity` }); }
            else if (ratio > 1.5) { score += 25; signals.push({ type: 'bullish', indicator: 'volume', message: `Volume ${ratio.toFixed(1)}x MA` }); }
            else if (ratio > 1.0) { score += 10; }
            else if (ratio < 0.5) { score -= 30; signals.push({ type: 'bearish', indicator: 'volume_low', message: `Volume ${ratio.toFixed(1)}x MA — low activity` }); }
            else if (ratio < 0.8) { score -= 15; }
        }

        // OBV divergence detection (needs prevCandle for direction)
        if (candle.obv != null && prevCandle?.obv != null) {
            const obvUp = candle.obv > prevCandle.obv;
            const pct = candle.price_change_pct;
            if (pct != null) {
                if (pct > 0 && obvUp) {
                    score += 8;
                    signals.push({ type: 'bullish', indicator: 'obv', message: 'OBV rising — volume confirms uptrend' });
                } else if (pct > 0 && !obvUp) {
                    score -= 8;
                    signals.push({ type: 'bearish', indicator: 'obv_divergence', message: 'Price up but OBV down — bearish divergence' });
                } else if (pct < 0 && !obvUp) {
                    score -= 5;
                    signals.push({ type: 'bearish', indicator: 'obv', message: 'OBV falling — volume confirms downtrend' });
                } else if (pct < 0 && obvUp) {
                    score += 5;
                    signals.push({ type: 'bullish', indicator: 'obv_divergence', message: 'Price down but OBV up — bullish divergence' });
                }
            }
        }

        return {
            score: Math.max(0, Math.min(100, Math.round(score))),
            signals,
        };
    }

    // ---- Momentum (0-100) ----
    _scoreMomentum(candle) {
        const signals = [];
        let score = 50;

        // Price change (40%)
        const pct = candle.price_change_pct;
        if (pct != null) {
            if (pct > 3) { score += 20; signals.push({ type: 'bullish', indicator: 'price_momentum', message: `Price +${pct.toFixed(1)}%` }); }
            else if (pct > 1) { score += 10; }
            else if (pct > 0) { score += 5; }
            else if (pct < -3) { score -= 20; signals.push({ type: 'bearish', indicator: 'price_momentum', message: `Price ${pct.toFixed(1)}% — significant drop` }); }
            else if (pct < -1) { score -= 10; }
            else if (pct < 0) { score -= 5; }
        }

        // MFI (30%)
        const mfi = candle.mfi;
        if (mfi != null) {
            if (mfi > 80) { score += 10; signals.push({ type: 'bullish', indicator: 'mfi', message: `MFI ${mfi} — strong momentum` }); }
            else if (mfi < 20) { score -= 10; signals.push({ type: 'bearish', indicator: 'mfi', message: `MFI ${mfi} — weak momentum` }); }
            else if (mfi > 50) { score += 5; }
            else { score -= 5; }
        }

        // Stochastic (30%)
        const stochK = candle.stoch_k, stochD = candle.stoch_d;
        if (stochK != null && stochD != null) {
            if (stochK > stochD) {
                score += 10;
                signals.push({ type: 'bullish', indicator: 'stoch_cross', message: 'Stochastics bullish crossover' });
            } else {
                score -= 10;
            }
            if (stochK > 80) { score += 5; }
            else if (stochK < 20) { score -= 5; }
        }

        // VWAP distance (up to ±8)
        const close = candle.c;
        if (candle.vwap != null && close != null && candle.vwap > 0) {
            const vwapDiff = ((close - candle.vwap) / candle.vwap) * 100;
            if (vwapDiff > 1) {
                score += 8;
                signals.push({ type: 'bullish', indicator: 'vwap', message: `Price ${vwapDiff.toFixed(1)}% above VWAP` });
            } else if (vwapDiff < -1) {
                score -= 8;
                signals.push({ type: 'bearish', indicator: 'vwap', message: `Price ${Math.abs(vwapDiff).toFixed(1)}% below VWAP` });
            }
        }

        return {
            score: Math.max(0, Math.min(100, Math.round(score))),
            signals,
        };
    }

    // ---- Fundamental (0-100) ----
    _scoreFundamental(fundamentals) {
        const signals = [];
        if (!fundamentals) {
            return { score: 50, signals: [] };
        }

        let score = 50;
        let count = 0;

        const pe = fundamentals.pe;
        if (pe != null && pe > 0) {
            count++;
            if (pe < 10) { score += 15; signals.push({ type: 'bullish', indicator: 'pe', message: `PE ${pe} — undervalued` }); }
            else if (pe < 15) { score += 8; }
            else if (pe < 25) { score += 0; }
            else if (pe < 40) { score -= 8; signals.push({ type: 'bearish', indicator: 'pe', message: `PE ${pe} — elevated` }); }
            else { score -= 15; }
        }

        const pb = fundamentals.pb;
        if (pb != null && pb > 0) {
            count++;
            if (pb < 1) { score += 15; signals.push({ type: 'bullish', indicator: 'pb', message: `PB ${pb} — below book value` }); }
            else if (pb < 2) { score += 8; }
            else if (pb < 4) { score += 0; }
            else if (pb < 8) { score -= 8; }
            else { score -= 15; }
        }

        const roe = fundamentals.roe;
        if (roe != null) {
            count++;
            if (roe > 20) { score += 15; signals.push({ type: 'bullish', indicator: 'roe', message: `ROE ${roe}% — strong` }); }
            else if (roe > 15) { score += 10; }
            else if (roe > 10) { score += 5; }
            else if (roe > 5) { score -= 5; }
            else { score -= 15; signals.push({ type: 'bearish', indicator: 'roe', message: `ROE ${roe}% — weak` }); }
        }

        const epsGrowth = fundamentals.eps_growth;
        if (epsGrowth != null) {
            count++;
            if (epsGrowth > 30) { score += 15; signals.push({ type: 'bullish', indicator: 'eps_growth', message: `EPS growth ${epsGrowth}%` }); }
            else if (epsGrowth > 15) { score += 10; }
            else if (epsGrowth > 5) { score += 5; }
            else if (epsGrowth > 0) { score -= 5; }
            else { score -= 15; signals.push({ type: 'bearish', indicator: 'eps_growth', message: `EPS growth ${epsGrowth}% — negative` }); }
        }

        if (count === 0) return { score: 50, signals: [] };

        return {
            score: Math.max(0, Math.min(100, Math.round(score))),
            signals,
        };
    }

    // ---- Helpers ----
    _scoreRsi(rsi) {
        if (rsi >= 70) return 15;
        if (rsi >= 50) return 8;
        if (rsi >= 30) return -5;
        return -15;
    }
}

module.exports = StockScorer;
