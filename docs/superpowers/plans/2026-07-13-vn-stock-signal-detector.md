# SignalDetector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/signals.js` — a stateless SignalDetector class with 17 detection methods across 6 categories, composite `getSignals()` and `getSignalsGrouped()` methods, 20+ unit tests, and integration into index.js + AGENTS.md.

**Architecture:** SignalDetector reads candle objects (same shape as StockScorer candles) and returns signal objects or null. Each detection method has configurable thresholds (passed via constructor options). Composite methods run all detectors and sort by strength descending.

**Tech Stack:** CommonJS, Node.js built-in test runner (`node:test`/`node:assert`)

## Global Constraints

- All code uses CommonJS (`require` / `module.exports`) — no ESM
- Signal output format must match spec: `{ type, direction, strength, message, candle, value }`
- Methods must never throw — return `null` on missing fields (graceful degradation)
- Thresholds are constructor options with sensible defaults — see Task 1 config

---

### Task 1: Create `lib/signals.js` — all 17 detection methods + 2 composites

**Files:**
- Create: `packages/vn-stock/lib/signals.js`
- Test: `packages/vn-stock/lib/signals.test.js`

**Interfaces:**
- Consumes: candle objects with fields: `{ rsi, ema20, ema50, ema100, macd, signal, histogram, bb_upper, bb_lower, bb_width, atr_pct, vol_ma20, stoch_k, stoch_d, obv, vwap, mfi, mcdx_banker, mcdx_speculator, mcdx_retail, price_change_pct, o, h, l, c, v }` and optionally `prevCandle` with same shape
- Produces: `SignalDetector` class with methods below

- [ ] **Step 1: Create test file with the `makeSignalCandle` helper**

Create `packages/vn-stock/lib/signals.test.js` with a helper function that builds candles with specific indicator values for each test scenario.

```javascript
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
```

Add this at the top of `signals.test.js`.

- [ ] **Step 2: Create `signals.js` — Constructor + config defaults**

```javascript
'use strict';

const DEFAULT_CONFIG = {
    rsi: { oversold: 30, overbought: 70 },
    macd: { histogramThreshold: 0.1 },
    volume: { spikeRatio: 2.0 },
    bollinger: { squeezeThreshold: 1.5 },
    atr: { expansionRatio: 1.5 },
    priceVsEma: { threshold: 2 },
    mcdx: { bankerThreshold: 20, speculatorThreshold: 15 },
    breakout: { pctThreshold: 2 },
    reversal: { minCandles: 2 },
};

class SignalDetector {
    constructor(config = {}) {
        this.cfg = {
            rsi: { ...DEFAULT_CONFIG.rsi, ...config.rsi },
            macd: { ...DEFAULT_CONFIG.macd, ...config.macd },
            volume: { ...DEFAULT_CONFIG.volume, ...config.volume },
            bollinger: { ...DEFAULT_CONFIG.bollinger, ...config.bollinger },
            atr: { ...DEFAULT_CONFIG.atr, ...config.atr },
            priceVsEma: { ...DEFAULT_CONFIG.priceVsEma, ...config.priceVsEma },
            mcdx: { ...DEFAULT_CONFIG.mcdx, ...config.mcdx },
            breakout: { ...DEFAULT_CONFIG.breakout, ...config.breakout },
            reversal: { ...DEFAULT_CONFIG.reversal, ...config.reversal },
        };
    }

    _signal(type, direction, strength, message, candle, value = {}) {
        return { type, direction, strength, message, candle, value };
    }

    // All detection methods defined below...
}
```

- [ ] **Step 3: Implement Trend detection methods**

```javascript
    // ---- Trend ----
    detectEmaCrossover(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { ema20: e20, ema50: e50 } = candle;
        const { ema20: pe20, ema50: pe50 } = prevCandle;
        if (e20 == null || e50 == null || pe20 == null || pe50 == null) return null;
        const gap = Math.abs(e20 - e50);
        const strength = Math.min(0.7 + 0.3 * Math.min(gap / 5, 1), 1);
        if (pe20 <= pe50 && e20 > e50) {
            return this._signal('EMA_CROSSOVER', 'bullish', strength,
                `EMA20 (${e20.toFixed(1)}) crossed above EMA50 (${e50.toFixed(1)}) — uptrend`, candle, { ema20: e20, ema50: e50 });
        }
        if (pe20 >= pe50 && e20 < e50) {
            return this._signal('EMA_CROSSOVER', 'bearish', strength,
                `EMA20 (${e20.toFixed(1)}) crossed below EMA50 (${e50.toFixed(1)}) — downtrend`, candle, { ema20: e20, ema50: e50 });
        }
        return null;
    }

    detectPriceVsEma(candle) {
        if (!candle || candle.c == null || candle.ema20 == null) return null;
        const pctDiff = ((candle.c / candle.ema20) - 1) * 100;
        const absDiff = Math.abs(pctDiff);
        const threshold = this.cfg.priceVsEma.threshold;
        if (pctDiff >= threshold) {
            return this._signal('PRICE_VS_EMA', 'bullish', Math.min(absDiff / 10, 1),
                `Price ${candle.c} is ${pctDiff.toFixed(1)}% above EMA20 ${candle.ema20.toFixed(1)}`, candle,
                { price: candle.c, ema20: candle.ema20, pctDiff });
        }
        if (pctDiff <= -threshold) {
            return this._signal('PRICE_VS_EMA', 'bearish', Math.min(absDiff / 10, 1),
                `Price ${candle.c} is ${(-pctDiff).toFixed(1)}% below EMA20 ${candle.ema20.toFixed(1)}`, candle,
                { price: candle.c, ema20: candle.ema20, pctDiff });
        }
        return null;
    }

    detectMacdCrossover(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { macd, signal, histogram } = candle;
        const { macd: pmacd, signal: psignal } = prevCandle;
        if (macd == null || signal == null || pmacd == null || psignal == null) return null;
        const mag = histogram || 0;
        const strength = Math.min(0.6 + 0.4 * Math.min(Math.abs(mag) / 0.5, 1), 1);
        if (pmacd <= psignal && macd > signal) {
            return this._signal('MACD_CROSSOVER', 'bullish', strength,
                `MACD (${macd.toFixed(2)}) crossed above signal (${signal.toFixed(2)}) — bullish momentum`, candle,
                { macd, signal, histogram });
        }
        if (pmacd >= psignal && macd < signal) {
            return this._signal('MACD_CROSSOVER', 'bearish', strength,
                `MACD (${macd.toFixed(2)}) crossed below signal (${signal.toFixed(2)}) — bearish momentum`, candle,
                { macd, signal, histogram });
        }
        return null;
    }

    detectMacdDivergence(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { c: price, macd } = candle;
        const { c: pprice, macd: pmacd } = prevCandle;
        if (price == null || macd == null || pprice == null || pmacd == null) return null;
        // Bullish divergence: price lower low but MACD higher low
        if (price < pprice && macd > pmacd) {
            const mag = Math.abs(price - pprice) / pprice;
            return this._signal('MACD_DIVERGENCE', 'bullish', Math.min(mag * 5, 1),
                `Bullish divergence — price ${price} < prev ${pprice} but MACD ${macd.toFixed(2)} > prev ${pmacd.toFixed(2)}`, candle,
                { price, prevPrice: pprice, macd, prevMacd: pmacd });
        }
        // Bearish divergence: price higher high but MACD lower high
        if (price > pprice && macd < pmacd) {
            const mag = Math.abs(price - pprice) / pprice;
            return this._signal('MACD_DIVERGENCE', 'bearish', Math.min(mag * 5, 1),
                `Bearish divergence — price ${price} > prev ${pprice} but MACD ${macd.toFixed(2)} < prev ${pmacd.toFixed(2)}`, candle,
                { price, prevPrice: pprice, macd, prevMacd: pmacd });
        }
        return null;
    }
```

- [ ] **Step 4: Implement Momentum detection methods**

```javascript
    // ---- Momentum ----
    detectRsi(candle) {
        if (!candle || candle.rsi == null) return null;
        const { rsi } = candle;
        if (rsi <= this.cfg.rsi.oversold) {
            const strength = Math.abs(rsi - 50) / 50;
            return this._signal('RSI_OVERSOLD', 'bullish', Math.min(strength, 1),
                `RSI ${rsi} is oversold (≤${this.cfg.rsi.oversold}) — potential bounce`, candle, { rsi });
        }
        if (rsi >= this.cfg.rsi.overbought) {
            const strength = Math.abs(rsi - 50) / 50;
            return this._signal('RSI_OVERBOUGHT', 'bearish', Math.min(strength, 1),
                `RSI ${rsi} is overbought (≥${this.cfg.rsi.overbought}) — potential pullback`, candle, { rsi });
        }
        return null;
    }

    detectStochastic(candle) {
        if (!candle || candle.stoch_k == null || candle.stoch_d == null) return null;
        const { stoch_k: k, stoch_d: d } = candle;
        if (k < 20 && k > d) {
            return this._signal('STOCHASTIC_OVERSOLD', 'bullish', Math.min((20 - k) / 20, 1),
                `Stochastic %K ${k} oversold (<20) and crossing above %D ${d}`, candle, { stoch_k: k, stoch_d: d });
        }
        if (k > 80 && k < d) {
            return this._signal('STOCHASTIC_OVERBOUGHT', 'bearish', Math.min((k - 80) / 20, 1),
                `Stochastic %K ${k} overbought (>80) and crossing below %D ${d}`, candle, { stoch_k: k, stoch_d: d });
        }
        return null;
    }

    detectMfi(candle) {
        if (!candle || candle.mfi == null) return null;
        const { mfi } = candle;
        if (mfi < 20) {
            return this._signal('MFI_OVERSOLD', 'bullish', Math.min((20 - mfi) / 20, 1),
                `MFI ${mfi} is oversold (<20) — bullish`, candle, { mfi });
        }
        if (mfi > 80) {
            return this._signal('MFI_OVERBOUGHT', 'bearish', Math.min((mfi - 80) / 20, 1),
                `MFI ${mfi} is overbought (>80) — bearish`, candle, { mfi });
        }
        return null;
    }
```

- [ ] **Step 5: Implement Volatility + Volume detection methods**

```javascript
    // ---- Volatility ----
    detectBollinger(candle) {
        if (!candle || candle.c == null || candle.bb_upper == null || candle.bb_lower == null) return null;
        const { c: price, bb_upper: upper, bb_lower: lower, bb_width: width } = candle;
        if (width == null) return null;
        if (price <= lower * 1.01) {
            const distance = (lower - price) / (upper - lower) || 0;
            return this._signal('BOLLINGER_LOWER', 'bullish', Math.min(Math.abs(distance), 1),
                `Price ${price} touching lower Bollinger Band ${lower.toFixed(1)} — oversold bounce potential`, candle,
                { price, lower, upper, width });
        }
        if (price >= upper * 0.99) {
            const distance = (price - upper) / (upper - lower) || 0;
            return this._signal('BOLLINGER_UPPER', 'bearish', Math.min(Math.abs(distance), 1),
                `Price ${price} touching upper Bollinger Band ${upper.toFixed(1)} — overbought pullback potential`, candle,
                { price, lower, upper, width });
        }
        // Bollinger squeeze
        if (width != null && width < this.cfg.bollinger.squeezeThreshold) {
            return this._signal('BOLLINGER_SQUEEZE', 'neutral', Math.min(1 - width / this.cfg.bollinger.squeezeThreshold, 1),
                `Bollinger width ${width.toFixed(2)} is below squeeze threshold ${this.cfg.bollinger.squeezeThreshold} — breakout imminent`, candle,
                { width });
        }
        return null;
    }

    detectAtrExpansion(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { atr_pct: atr } = candle;
        const { atr_pct: prevAtr } = prevCandle;
        if (atr == null || prevAtr == null || prevAtr === 0) return null;
        const ratio = this.cfg.atr.expansionRatio;
        if (atr > prevAtr * ratio) {
            return this._signal('ATR_EXPANSION', 'neutral', Math.min(atr / (prevAtr * ratio), 1),
                `ATR ${atr.toFixed(2)}% expanded vs prev ${prevAtr.toFixed(2)}% (ratio ${ratio}x) — increased volatility`, candle,
                { atr, prevAtr, ratio });
        }
        return null;
    }

    // ---- Volume ----
    detectVolumeSpike(candle) {
        if (!candle || candle.v == null || candle.vol_ma20 == null || candle.vol_ma20 === 0) return null;
        const ratio = candle.v / candle.vol_ma20;
        const spikeRatio = this.cfg.volume.spikeRatio;
        if (ratio >= spikeRatio) {
            return this._signal('VOLUME_SPIKE', 'neutral', Math.min(ratio / 5, 1),
                `Volume ${candle.v.toLocaleString()} is ${ratio.toFixed(1)}x MA20 (${candle.vol_ma20.toLocaleString()}) — abnormal activity`, candle,
                { volume: candle.v, volMa20: candle.vol_ma20, ratio });
        }
        return null;
    }

    detectObvDivergence(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { c: price, obv } = candle;
        const { c: pprice, obv: pobv } = prevCandle;
        if (price == null || obv == null || pprice == null || pobv == null) return null;
        const priceUp = price > pprice;
        const obvUp = obv > pobv;
        if (priceUp && !obvUp) {
            const mag = Math.abs(price - pprice) / pprice;
            return this._signal('OBV_DIVERGENCE', 'bearish', Math.min(mag * 5, 1),
                `Bearish OBV divergence — price up (${price}) but OBV down (${obv.toLocaleString()} vs ${pobv.toLocaleString()})`, candle,
                { price, prevPrice: pprice, obv, prevObv: pobv });
        }
        if (!priceUp && obvUp) {
            const mag = Math.abs(price - pprice) / pprice;
            return this._signal('OBV_DIVERGENCE', 'bullish', Math.min(mag * 5, 1),
                `Bullish OBV divergence — price down (${price}) but OBV up (${obv.toLocaleString()} vs ${pobv.toLocaleString()})`, candle,
                { price, prevPrice: pprice, obv, prevObv: pobv });
        }
        return null;
    }

    detectVwapPosition(candle) {
        if (!candle || candle.c == null || candle.vwap == null) return null;
        const pctDiff = ((candle.c / candle.vwap) - 1) * 100;
        if (pctDiff > 0) {
            return this._signal('VWAP_POSITION', 'bullish', Math.min(pctDiff / 5, 1),
                `Price ${candle.c} is ${pctDiff.toFixed(1)}% above VWAP ${candle.vwap.toFixed(1)} — bullish bias`, candle,
                { price: candle.c, vwap: candle.vwap, pctDiff });
        }
        if (pctDiff < 0) {
            return this._signal('VWAP_POSITION', 'bearish', Math.min(Math.abs(pctDiff) / 5, 1),
                `Price ${candle.c} is ${(-pctDiff).toFixed(1)}% below VWAP ${candle.vwap.toFixed(1)} — bearish bias`, candle,
                { price: candle.c, vwap: candle.vwap, pctDiff });
        }
        return null;
    }
```

- [ ] **Step 6: Implement Flow/MCDX + Price Action detection methods**

```javascript
    // ---- Flow (MCDX) ----
    detectMcdxFlow(candle) {
        if (!candle) return null;
        const banker = candle.mcdx_banker;
        const spec = candle.mcdx_speculator;
        if (banker == null || spec == null) return null;
        const bThresh = this.cfg.mcdx.bankerThreshold;
        const sThresh = this.cfg.mcdx.speculatorThreshold;
        if (banker >= bThresh) {
            return this._signal('MCDX_BANKER_ACCUMULATION', 'bullish', Math.min(banker / 50, 1),
                `MCDX banker flow ${banker}% ≥ ${bThresh}% — accumulation detected`, candle,
                { mcdx_banker: banker, mcdx_speculator: spec });
        }
        if (spec >= sThresh) {
            return this._signal('MCDX_SPECULATOR_DISTRIBUTION', 'bearish', Math.min(spec / 50, 1),
                `MCDX speculator flow ${spec}% ≥ ${sThresh}% — distribution detected`, candle,
                { mcdx_banker: banker, mcdx_speculator: spec });
        }
        return null;
    }

    detectMcdxDivergence(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { c: price, mcdx_banker: banker } = candle;
        const { c: pprice, mcdx_banker: pbanker } = prevCandle;
        if (price == null || banker == null || pprice == null || pbanker == null) return null;
        if (price > pprice && banker < pbanker) {
            const mag = Math.abs(banker - pbanker);
            return this._signal('MCDX_DIVERGENCE', 'bearish', Math.min(mag / 30, 1),
                `Bearish MCDX divergence — price up but banker flow down (${banker}% < ${pbanker}%)`, candle,
                { price, prevPrice: pprice, banker, prevBanker: pbanker });
        }
        if (price < pprice && banker > pbanker) {
            const mag = Math.abs(banker - pbanker);
            return this._signal('MCDX_DIVERGENCE', 'bullish', Math.min(mag / 30, 1),
                `Bullish MCDX divergence — price down but banker flow up (${banker}% > ${pbanker}%)`, candle,
                { price, prevPrice: pprice, banker, prevBanker: pbanker });
        }
        return null;
    }

    // ---- Price Action ----
    detectPriceBreakout(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { h: high, l: low, price_change_pct: pct } = candle;
        const { h: prevHigh, l: prevLow } = prevCandle;
        if (high == null || low == null || prevHigh == null || prevLow == null) return null;
        const pctThreshold = this.cfg.breakout.pctThreshold;
        const change = pct != null ? Math.abs(pct) : 0;
        if (high > prevHigh * (1 + pctThreshold / 100)) {
            return this._signal('PRICE_BREAKOUT', 'bullish', Math.min(change / 5, 1),
                `Price broke above prev high ${prevHigh} — bullish breakout`, candle,
                { high, prevHigh, pctChange: change });
        }
        if (low < prevLow * (1 - pctThreshold / 100)) {
            return this._signal('PRICE_BREAKOUT', 'bearish', Math.min(change / 5, 1),
                `Price broke below prev low ${prevLow} — bearish breakout`, candle,
                { low, prevLow, pctChange: change });
        }
        return null;
    }

    detectPriceReversal(candle, prevCandle) {
        if (!candle || !prevCandle) return null;
        const { c: close, o: open } = candle;
        const { c: prevClose, o: prevOpen } = prevCandle;
        if (close == null || open == null || prevClose == null || prevOpen == null) return null;
        const body = Math.abs(close - open);
        const prevBody = Math.abs(prevClose - prevOpen);
        if (prevBody === 0) return null;
        const bodyRatio = body / prevBody;
        // Bullish reversal: prev was bearish (close < open), current is bullish (close > open)
        if (prevClose < prevOpen && close > open && bodyRatio >= 0.5) {
            return this._signal('PRICE_REVERSAL', 'bullish', Math.min(bodyRatio * 0.7, 1),
                `Bullish reversal — prev bearish candle followed by bullish candle`, candle,
                { close, open, prevClose, prevOpen, bodyRatio });
        }
        // Bearish reversal: prev was bullish (close > open), current is bearish (close < open)
        if (prevClose > prevOpen && close < open && bodyRatio >= 0.5) {
            return this._signal('PRICE_REVERSAL', 'bearish', Math.min(bodyRatio * 0.7, 1),
                `Bearish reversal — prev bullish candle followed by bearish candle`, candle,
                { close, open, prevClose, prevOpen, bodyRatio });
        }
        return null;
    }
```

- [ ] **Step 7: Implement composite methods + module export**

```javascript
    // ---- Composite ----
    getSignals(candle, prevCandle = null) {
        if (!candle || typeof candle !== 'object') return [];
        const detectors = [
            this.detectEmaCrossover.bind(this, candle, prevCandle),
            this.detectPriceVsEma.bind(this, candle),
            this.detectMacdCrossover.bind(this, candle, prevCandle),
            this.detectMacdDivergence.bind(this, candle, prevCandle),
            this.detectRsi.bind(this, candle),
            this.detectStochastic.bind(this, candle),
            this.detectMfi.bind(this, candle),
            this.detectBollinger.bind(this, candle),
            this.detectAtrExpansion.bind(this, candle, prevCandle),
            this.detectVolumeSpike.bind(this, candle),
            this.detectObvDivergence.bind(this, candle, prevCandle),
            this.detectVwapPosition.bind(this, candle),
            this.detectMcdxFlow.bind(this, candle),
            this.detectMcdxDivergence.bind(this, candle, prevCandle),
            this.detectPriceBreakout.bind(this, candle, prevCandle),
            this.detectPriceReversal.bind(this, candle, prevCandle),
        ];
        return detectors
            .map(fn => fn())
            .filter(s => s !== null)
            .sort((a, b) => b.strength - a.strength);
    }

    getSignalsGrouped(candle, prevCandle = null) {
        const all = this.getSignals(candle, prevCandle);
        return {
            trend: all.filter(s => ['EMA_CROSSOVER', 'PRICE_VS_EMA', 'MACD_CROSSOVER', 'MACD_DIVERGENCE'].includes(s.type)),
            momentum: all.filter(s => ['RSI_OVERSOLD', 'RSI_OVERBOUGHT', 'STOCHASTIC_OVERSOLD', 'STOCHASTIC_OVERBOUGHT', 'MFI_OVERSOLD', 'MFI_OVERBOUGHT'].includes(s.type)),
            volatility: all.filter(s => ['BOLLINGER_LOWER', 'BOLLINGER_UPPER', 'BOLLINGER_SQUEEZE', 'ATR_EXPANSION'].includes(s.type)),
            volume: all.filter(s => ['VOLUME_SPIKE', 'OBV_DIVERGENCE', 'VWAP_POSITION'].includes(s.type)),
            flow: all.filter(s => ['MCDX_BANKER_ACCUMULATION', 'MCDX_SPECULATOR_DISTRIBUTION', 'MCDX_DIVERGENCE'].includes(s.type)),
            priceAction: all.filter(s => ['PRICE_BREAKOUT', 'PRICE_REVERSAL'].includes(s.type)),
        };
    }
}

module.exports = SignalDetector;
```

- [ ] **Step 8: Quick smoke test — write and run**

Add to `signals.test.js` (after the helper):

```javascript
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
```

Run tests:
```bash
node --test packages/vn-stock/lib/signals.test.js
```
Expected: 11 tests PASS

- [ ] **Step 9: Commit signals.js + test file**

```bash
git add packages/vn-stock/lib/signals.js packages/vn-stock/lib/signals.test.js
git commit -m "feat(vn-stock): add SignalDetector with 17 detection methods and composite getSignals"
```

---

### Task 2: Expand unit test suite to full coverage (20+ tests)

**Files:**
- Modify: `packages/vn-stock/lib/signals.test.js`

- [ ] **Step 1: Add EMA bearish crossover test**

```javascript
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
```

- [ ] **Step 2: Add remaining missing-return-null edge-case tests**

```javascript
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
```

- [ ] **Step 2: Run full test suite**

```bash
node --test packages/vn-stock/lib/signals.test.js
```
Expected: 32+ tests PASS

- [ ] **Step 3: Commit expanded tests**

```bash
git add packages/vn-stock/lib/signals.test.js
git commit -m "test(vn-stock): add comprehensive SignalDetector unit tests (32+ scenarios)"
```

---

### Task 3: Wire SignalDetector into index.js + update AGENTS.md

**Files:**
- Modify: `packages/vn-stock/lib/index.js`
- Modify: `packages/vn-stock/AGENTS.md`

- [ ] **Step 1: Export SignalDetector from index.js**

```javascript
const StockDB = require('./db');
const StockScreener = require('./screener');
const StockScorer = require('./scorer');
const SignalDetector = require('./signals');

module.exports = {
    StockDB,
    StockScreener,
    StockScorer,
    SignalDetector,
};
```

- [ ] **Step 2: Update AGENTS.md — add SignalDetector to exports table + usage example**

Add to the Exports table in AGENTS.md:
```
| `SignalDetector` | `lib/signals.js` | Detect 17 technical signals (trend, momentum, volatility, volume, flow, price action) |
```

Add a usage example section after Intraday Scoring:
```
### Signal Detection (SignalDetector)

```javascript
const { SignalDetector } = require('@andy-toolforge/vn-stock');
const detector = new SignalDetector();

// Check a single candle against all detectors
const candle = { rsi: 25, ema20: 105, ema50: 100, macd: 1.5, signal: 1.0, ... };
const prevCandle = { ema20: 98, ema50: 100, macd: 0.8, signal: 1.0, ... };

const signals = detector.getSignals(candle, prevCandle);
// → [{ type: 'EMA_CROSSOVER', direction: 'bullish', strength: 0.85, ... },
//     { type: 'RSI_OVERSOLD', direction: 'bullish', strength: 0.5, ... }]

const grouped = detector.getSignalsGrouped(candle, prevCandle);
// → { trend: [...], momentum: [...], volatility: [...], volume: [...], flow: [...], priceAction: [...] }

// Custom thresholds
const custom = new SignalDetector({
    rsi: { oversold: 25, overbought: 75 },
    volume: { spikeRatio: 3.0 },
});
```
```

- [ ] **Step 3: Commit wiring changes**

```bash
git add packages/vn-stock/lib/index.js packages/vn-stock/AGENTS.md
git commit -m "feat(vn-stock): export SignalDetector and document usage"
```
