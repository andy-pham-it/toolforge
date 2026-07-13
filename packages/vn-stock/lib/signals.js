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
        if (price < pprice && macd > pmacd) {
            const mag = Math.abs(price - pprice) / pprice;
            return this._signal('MACD_DIVERGENCE', 'bullish', Math.min(mag * 5, 1),
                `Bullish divergence — price ${price} < prev ${pprice} but MACD ${macd.toFixed(2)} > prev ${pmacd.toFixed(2)}`, candle,
                { price, prevPrice: pprice, macd, prevMacd: pmacd });
        }
        if (price > pprice && macd < pmacd) {
            const mag = Math.abs(price - pprice) / pprice;
            return this._signal('MACD_DIVERGENCE', 'bearish', Math.min(mag * 5, 1),
                `Bearish divergence — price ${price} > prev ${pprice} but MACD ${macd.toFixed(2)} < prev ${pmacd.toFixed(2)}`, candle,
                { price, prevPrice: pprice, macd, prevMacd: pmacd });
        }
        return null;
    }

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
