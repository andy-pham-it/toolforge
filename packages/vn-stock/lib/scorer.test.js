const { describe, it } = require('node:test');
const assert = require('node:assert');

const StockScorer = require('./scorer');

describe('StockScorer', async () => {
    describe('_scoreTechnical', async () => {
        await it('should return 50 for neutral candle (no indicators)', () => {
            const s = new StockScorer();
            const result = s._scoreTechnical({});
            assert.strictEqual(result.score, 50);
            assert.ok(Array.isArray(result.signals));
        });

        await it('should score higher on bullish EMA alignment + MACD + high RSI', () => {
            const s = new StockScorer();
            const result = s._scoreTechnical({
                rsi: 72,
                ema20: 110,
                ema50: 100,
                ema100: 95,
                macd: 2.5,
                signal: 1.8,
                histogram: 0.4,
            });
            assert.ok(result.score > 70, `Expected > 70, got ${result.score}`);
            assert.ok(result.signals.length >= 3);
        });

        await it('should score lower on bearish EMA alignment + low RSI', () => {
            const s = new StockScorer();
            const result = s._scoreTechnical({
                rsi: 28,
                ema20: 80,
                ema50: 100,
                macd: -1.0,
                signal: 0.5,
            });
            assert.ok(result.score < 40, `Expected < 40, got ${result.score}`);
        });

        await it('should handle partial indicators gracefully', () => {
            const s = new StockScorer();
            const result = s._scoreTechnical({ rsi: 60 });
            assert.ok(result.score >= 0 && result.score <= 100);
            assert.ok(result.signals.length >= 1);
        });

        await it('should boost score for Bollinger Band squeeze setup', () => {
            const s = new StockScorer();
            const neutral = s._scoreTechnical({ rsi: 50, ema20: 100, ema50: 100 });
            const squeeze = s._scoreTechnical({ rsi: 50, ema20: 100, ema50: 100, c: 105, bb_upper: 110, bb_lower: 90, bb_width: 1.5 });
            assert.ok(squeeze.score > neutral.score, `Squeeze ${squeeze.score} should > neutral ${neutral.score}`);
            assert.ok(squeeze.signals.some(sig => sig.indicator === 'bb_squeeze'));
        });

        await it('should detect price at upper Bollinger Band', () => {
            const s = new StockScorer();
            const result = s._scoreTechnical({ c: 110, bb_upper: 110, bb_lower: 90 });
            assert.ok(result.signals.some(sig => sig.indicator === 'bollinger'));
        });

        await it('should boost score for high ATR volatility', () => {
            const s = new StockScorer();
            const low = s._scoreTechnical({ rsi: 50, atr_pct: 0.3 });
            const high = s._scoreTechnical({ rsi: 50, atr_pct: 4.5 });
            assert.ok(high.score > low.score, `High ATR ${high.score} should > low ATR ${low.score}`);
            assert.ok(high.signals.some(sig => sig.indicator === 'atr'));
        });
    });

    describe('_scoreVolume', async () => {
        await it('should score 50 with no volume data', () => {
            const s = new StockScorer();
            assert.strictEqual(s._scoreVolume({}).score, 50);
        });

        await it('should score high on volume spike', () => {
            const s = new StockScorer();
            const result = s._scoreVolume({ volume: 2000000, vol_ma20: 500000 });
            assert.ok(result.score > 80, `Expected > 80, got ${result.score}`);
            assert.ok(result.signals.some(sig => sig.type === 'bullish'));
        });

        await it('should score low on low volume', () => {
            const s = new StockScorer();
            const result = s._scoreVolume({ volume: 100000, vol_ma20: 500000 });
            assert.ok(result.score < 40, `Expected < 40, got ${result.score}`);
        });

        await it('should boost score on OBV confirming uptrend (price up, OBV up)', () => {
            const s = new StockScorer();
            const result = s._scoreVolume({ volume: 500000, vol_ma20: 500000, obv: 1500, price_change_pct: 2.5 }, { obv: 1400 });
            assert.ok(result.score > 50, `Expected > 50, got ${result.score}`);
            assert.ok(result.signals.some(sig => sig.indicator === 'obv' && sig.type === 'bullish'));
        });

        await it('should penalize on bearish OBV divergence (price up, OBV down)', () => {
            const s = new StockScorer();
            const result = s._scoreVolume({ volume: 500000, vol_ma20: 500000, obv: 1400, price_change_pct: 2.5 }, { obv: 1500 });
            assert.ok(result.signals.some(sig => sig.indicator === 'obv_divergence' && sig.type === 'bearish'));
        });

        await it('should detect bullish OBV divergence (price down, OBV up)', () => {
            const s = new StockScorer();
            const result = s._scoreVolume({ volume: 500000, vol_ma20: 500000, obv: 1600, price_change_pct: -2.0 }, { obv: 1500 });
            assert.ok(result.signals.some(sig => sig.indicator === 'obv_divergence' && sig.type === 'bullish'));
        });

        await it('should not change score when no prevCandle provided', () => {
            const s = new StockScorer();
            const withoutPrev = s._scoreVolume({ volume: 500000, vol_ma20: 500000, obv: 1500, price_change_pct: 2.5 });
            const baseline = s._scoreVolume({ volume: 500000, vol_ma20: 500000 });
            assert.strictEqual(withoutPrev.score, baseline.score);
        });
    });

    describe('_scoreMomentum', async () => {
        await it('should return 50 with no momentum data', () => {
            const s = new StockScorer();
            assert.strictEqual(s._scoreMomentum({}).score, 50);
        });

        await it('should score high on positive price change + bullish MFI', () => {
            const s = new StockScorer();
            const result = s._scoreMomentum({
                price_change_pct: 4.5,
                mfi: 75,
                stoch_k: 85,
                stoch_d: 60,
            });
            assert.ok(result.score > 60, `Expected > 60, got ${result.score}`);
        });

        await it('should score low on negative price change + weak stochastics', () => {
            const s = new StockScorer();
            const result = s._scoreMomentum({
                price_change_pct: -4.0,
                mfi: 15,
                stoch_k: 12,
                stoch_d: 25,
            });
            assert.ok(result.score < 40, `Expected < 40, got ${result.score}`);
        });

        await it('should detect VWAP bullish signal when price above VWAP', () => {
            const s = new StockScorer();
            const result = s._scoreMomentum({ c: 52, vwap: 50 });
            assert.ok(result.signals.some(sig => sig.indicator === 'vwap' && sig.type === 'bullish'));
            const noSignal = s._scoreMomentum({ c: 50.5, vwap: 50 });
            assert.ok(!noSignal.signals.some(sig => sig.indicator === 'vwap'));
        });
    });

    describe('_scoreFundamental', async () => {
        await it('should return 50 when no fundamentals', () => {
            const s = new StockScorer();
            assert.strictEqual(s._scoreFundamental(null).score, 50);
            assert.strictEqual(s._scoreFundamental({}).score, 50);
        });

        await it('should score high on strong fundamentals', () => {
            const s = new StockScorer();
            const result = s._scoreFundamental({
                pe: 9,
                pb: 0.8,
                roe: 25,
                eps_growth: 35,
            });
            assert.ok(result.score > 70, `Expected > 70, got ${result.score}`);
        });

        await it('should score low on weak fundamentals', () => {
            const s = new StockScorer();
            const result = s._scoreFundamental({
                pe: 50,
                pb: 10,
                roe: 2,
                eps_growth: -5,
            });
            assert.ok(result.score < 40, `Expected < 40, got ${result.score}`);
        });
    });

    describe('scoreCandle', async () => {
        await it('should return total score within 0-100 range', () => {
            const s = new StockScorer();
            const result = s.scoreCandle({
                rsi: 72,
                ema20: 110,
                ema50: 100,
                volume: 2000000,
                vol_ma20: 500000,
                price_change_pct: 3.5,
                mfi: 70,
            }, {
                pe: 12,
                pb: 1.5,
                roe: 18,
                eps_growth: 20,
            });
            assert.ok(result.total >= 0 && result.total <= 100);
            assert.ok(result.breakdown.technical.score >= 0);
            assert.ok(result.breakdown.volume.score >= 0);
            assert.ok(result.breakdown.momentum.score >= 0);
            assert.ok(result.breakdown.fundamental.score >= 0);
        });

        await it('should use default weights when none provided', () => {
            const s = new StockScorer();
            const r = s.scoreCandle({ rsi: 60 });
            assert.strictEqual(typeof r.total, 'number');
        });

        await it('should accept custom weights', () => {
            const s = new StockScorer({ weights: { volume: 0.5, technical: 0.5, momentum: 0, fundamental: 0 } });
            const r = s.scoreCandle({ rsi: 60, volume: 2000000, vol_ma20: 500000 });
            assert.strictEqual(r.breakdown.fundamental.score, 50); // neutral
            assert.strictEqual(typeof r.total, 'number');
        });

        await it('should handle empty/null candle without throwing', () => {
            const s = new StockScorer();
            const r1 = s.scoreCandle({});
            assert.ok(r1.total >= 0);
            // null fundamentals
            const r2 = s.scoreCandle({ rsi: 50 }, null);
            assert.ok(r2.total >= 0);
        });
    });
});
