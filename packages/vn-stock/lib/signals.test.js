'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const SignalDetector = require('./signals');

function makeCandle(overrides = {}) {
    return {
        o: 100, h: 105, l: 98, c: 103, v: 1_500_000,
        rsi: 50, ema20: 100, ema50: 100, ema100: 100,
        macd: 0, signal: 0, histogram: 0,
        bb_upper: 110, bb_lower: 90, bb_width: 3.0,
        atr_pct: 1.5, vol_ma20: 1_000_000,
        stoch_k: 50, stoch_d: 50,
        obv: 1_000_000, vwap: 100, mfi: 50,
        mcdx_banker: 0, mcdx_speculator: 0, mcdx_retail: 0,
        price_change_pct: 0,
        ...overrides,
    };
}

describe('SignalDetector', async () => {
    await it('detectEmaCrossover — bullish cross', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ ema20: 105, ema50: 100 });
        const prev = makeCandle({ ema20: 98, ema50: 100 });
        const s = d.detectEmaCrossover(candle, prev);
        assert.ok(s, 'should detect bullish crossover');
        assert.strictEqual(s.type, 'EMA_CROSSOVER');
        assert.strictEqual(s.direction, 'bullish');
        assert.ok(s.strength > 0);
    });

    await it('detectRsi — oversold', () => {
        const d = new SignalDetector();
        const s = d.detectRsi(makeCandle({ rsi: 25 }));
        assert.ok(s);
        assert.strictEqual(s.type, 'RSI_OVERSOLD');
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectRsi — overbought', () => {
        const d = new SignalDetector();
        const s = d.detectRsi(makeCandle({ rsi: 75 }));
        assert.ok(s);
        assert.strictEqual(s.type, 'RSI_OVERBOUGHT');
        assert.strictEqual(s.direction, 'bearish');
    });

    await it('detectRsi — no signal in neutral range', () => {
        const d = new SignalDetector();
        const s = d.detectRsi(makeCandle({ rsi: 50 }));
        assert.strictEqual(s, null);
    });

    await it('getSignals — returns sorted non-null signals', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ rsi: 25, ema20: 105, ema50: 100, mcdx_banker: 25 });
        const prev = makeCandle({ rsi: 50, ema20: 98, ema50: 100 });
        const signals = d.getSignals(candle, prev);
        assert.ok(signals.length >= 2);
        for (let i = 1; i < signals.length; i++) {
            assert.ok(signals[i - 1].strength >= signals[i].strength, 'sorted desc');
        }
    });

    await it('getSignals — empty candle returns []', () => {
        const d = new SignalDetector();
        assert.deepStrictEqual(d.getSignals({}), []);
        assert.deepStrictEqual(d.getSignals(null), []);
    });

    await it('detectMacdCrossover — bullish cross', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ macd: 1.5, signal: 1.0, histogram: 0.5 });
        const prev = makeCandle({ macd: 0.8, signal: 1.0 });
        const s = d.detectMacdCrossover(candle, prev);
        assert.ok(s);
        assert.strictEqual(s.type, 'MACD_CROSSOVER');
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectVolumeSpike — detects spike', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ v: 3_000_000, vol_ma20: 1_000_000 });
        const s = d.detectVolumeSpike(candle);
        assert.ok(s);
        assert.strictEqual(s.type, 'VOLUME_SPIKE');
        assert.ok(s.strength > 0);
    });

    await it('detectVolumeSpike — no signal below threshold', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ v: 1_500_000, vol_ma20: 1_000_000 });
        assert.strictEqual(d.detectVolumeSpike(candle), null);
    });

    await it('detectBollinger — squeeze detection', () => {
        const d = new SignalDetector({ bollinger: { squeezeThreshold: 3.0 } });
        const candle = makeCandle({ bb_upper: 105, bb_lower: 95, bb_width: 2.0 });
        const s = d.detectBollinger(candle);
        assert.ok(s);
        assert.strictEqual(s.type, 'BOLLINGER_SQUEEZE');
    });

    await it('detectEmaCrossover — bearish cross', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ ema20: 95, ema50: 100 });
        const prev = makeCandle({ ema20: 102, ema50: 100 });
        const s = d.detectEmaCrossover(candle, prev);
        assert.ok(s);
        assert.strictEqual(s.type, 'EMA_CROSSOVER');
        assert.strictEqual(s.direction, 'bearish');
    });

    await it('detectEmaCrossover — no cross returns null', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ ema20: 105, ema50: 100 });
        const prev = makeCandle({ ema20: 103, ema50: 100 });
        assert.strictEqual(d.detectEmaCrossover(candle, prev), null);
    });

    await it('detectEmaCrossover — null on missing data', () => {
        const d = new SignalDetector();
        assert.strictEqual(d.detectEmaCrossover({}, {}), null);
        assert.strictEqual(d.detectEmaCrossover(null, null), null);
    });

    await it('detectPriceVsEma — bullish signal', () => {
        const d = new SignalDetector({ priceVsEma: { threshold: 2 } });
        const s = d.detectPriceVsEma(makeCandle({ c: 110, ema20: 100 }));
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectPriceVsEma — bearish signal', () => {
        const d = new SignalDetector({ priceVsEma: { threshold: 2 } });
        const s = d.detectPriceVsEma(makeCandle({ c: 90, ema20: 100 }));
        assert.ok(s);
        assert.strictEqual(s.direction, 'bearish');
    });

    await it('detectPriceVsEma — within threshold returns null', () => {
        const d = new SignalDetector({ priceVsEma: { threshold: 5 } });
        assert.strictEqual(d.detectPriceVsEma(makeCandle({ c: 102, ema20: 100 })), null);
    });

    await it('detectMacdCrossover — bearish cross', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ macd: 0.5, signal: 1.0, histogram: -0.5 });
        const prev = makeCandle({ macd: 1.2, signal: 1.0 });
        const s = d.detectMacdCrossover(candle, prev);
        assert.ok(s);
        assert.strictEqual(s.direction, 'bearish');
    });

    await it('detectMacdDivergence — bullish divergence', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ c: 90, macd: 1.0 });
        const prev = makeCandle({ c: 100, macd: 0.5 });
        const s = d.detectMacdDivergence(candle, prev);
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectStochastic — oversold', () => {
        const d = new SignalDetector();
        const s = d.detectStochastic(makeCandle({ stoch_k: 15, stoch_d: 10 }));
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectMfi — oversold', () => {
        const d = new SignalDetector();
        const s = d.detectMfi(makeCandle({ mfi: 15 }));
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectBollinger — lower band touch', () => {
        const d = new SignalDetector();
        const s = d.detectBollinger(makeCandle({ c: 90, bb_lower: 90, bb_upper: 110, bb_width: 3.0 }));
        assert.ok(s);
        assert.strictEqual(s.type, 'BOLLINGER_LOWER');
    });

    await it('detectAtrExpansion — detects expansion', () => {
        const d = new SignalDetector();
        const s = d.detectAtrExpansion(
            makeCandle({ atr_pct: 3.0 }),
            makeCandle({ atr_pct: 1.0 }),
        );
        assert.ok(s);
        assert.strictEqual(s.type, 'ATR_EXPANSION');
    });

    await it('detectAtrExpansion — null on missing prev', () => {
        const d = new SignalDetector();
        assert.strictEqual(d.detectAtrExpansion(makeCandle({ atr_pct: 3.0 }), null), null);
    });

    await it('detectObvDivergence — bearish divergence', () => {
        const d = new SignalDetector();
        const s = d.detectObvDivergence(
            makeCandle({ c: 110, obv: 900_000 }),
            makeCandle({ c: 100, obv: 1_000_000 }),
        );
        assert.ok(s);
        assert.strictEqual(s.direction, 'bearish');
    });

    await it('detectObvDivergence — bullish divergence', () => {
        const d = new SignalDetector();
        const s = d.detectObvDivergence(
            makeCandle({ c: 90, obv: 1_100_000 }),
            makeCandle({ c: 100, obv: 1_000_000 }),
        );
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectVwapPosition — bullish', () => {
        const d = new SignalDetector();
        const s = d.detectVwapPosition(makeCandle({ c: 105, vwap: 100 }));
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectMcdxFlow — banker accumulation', () => {
        const d = new SignalDetector();
        const s = d.detectMcdxFlow(makeCandle({ mcdx_banker: 25, mcdx_speculator: 5 }));
        assert.ok(s);
        assert.strictEqual(s.type, 'MCDX_BANKER_ACCUMULATION');
    });

    await it('detectMcdxDivergence — bearish divergence', () => {
        const d = new SignalDetector();
        const s = d.detectMcdxDivergence(
            makeCandle({ c: 110, mcdx_banker: 10 }),
            makeCandle({ c: 100, mcdx_banker: 25 }),
        );
        assert.ok(s);
        assert.strictEqual(s.direction, 'bearish');
    });

    await it('detectPriceBreakout — bullish breakout', () => {
        const d = new SignalDetector();
        const s = d.detectPriceBreakout(
            makeCandle({ h: 108, price_change_pct: 3 }),
            makeCandle({ h: 100 }),
        );
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('detectPriceReversal — bullish reversal', () => {
        const d = new SignalDetector();
        const s = d.detectPriceReversal(
            makeCandle({ c: 105, o: 100 }),       // bullish candle (c > o)
            makeCandle({ c: 95, o: 100 }),         // bearish prev (c < o)
        );
        assert.ok(s);
        assert.strictEqual(s.direction, 'bullish');
    });

    await it('getSignalsGrouped — returns grouped signals', () => {
        const d = new SignalDetector();
        const candle = makeCandle({ rsi: 25, ema20: 105, ema50: 100, mcdx_banker: 25 });
        const prev = makeCandle({ ema20: 98, ema50: 100 });
        const grouped = d.getSignalsGrouped(candle, prev);
        assert.ok(grouped.trend.length >= 1);
        assert.ok(grouped.momentum.length >= 1);
        assert.ok(grouped.flow.length >= 1);
    });

    await it('custom config thresholds are respected', () => {
        const d = new SignalDetector({
            rsi: { oversold: 25, overbought: 75 },
        });
        const s1 = d.detectRsi(makeCandle({ rsi: 28 }));
        assert.strictEqual(s1, null, '28 should not be oversold with threshold 25');
        const s2 = d.detectRsi(makeCandle({ rsi: 72 }));
        assert.strictEqual(s2, null, '72 should not be overbought with threshold 75');
    });

    await it('all null on empty candle', () => {
        const d = new SignalDetector();
        assert.strictEqual(d.detectEmaCrossover({}, {}), null);
        assert.strictEqual(d.detectRsi({}), null);
        assert.strictEqual(d.detectMfi({}), null);
        assert.strictEqual(d.detectBollinger({}), null);
        assert.strictEqual(d.detectVolumeSpike({}), null);
        assert.strictEqual(d.detectVwapPosition({}), null);
    });
});
