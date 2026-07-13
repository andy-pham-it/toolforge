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
});
