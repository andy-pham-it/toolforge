'use strict';

const { StockLLM } = require('./llm');
const StockDB = require('./db');
const StockScreener = require('./screener');
const StockScorer = require('./scorer');
const SignalDetector = require('./signals');

const RECOMMENDATIONS = ['MUA', 'BÁN', 'NẮM GIỮ', 'THEO DÕI'];

class Analyst {
    constructor(config = {}) {
        this.llm = config.llm || new StockLLM(config);
    }

    /**
     * Analyze a single stock symbol.
     * @param {string} symbol
     * @param {string} [timeframe='1D'] - Timeframe for analysis ('1D', '1h', '15m')
     * @returns {Promise<object>} { symbol, signals, score, recommendation, analysis, risks }
     */
    async analyzeSymbol(symbol, timeframe = '1D') {
        const db = new StockDB();
        try {
            await db.connect();
            const screener = new StockScreener();
            const info = await screener.getSymbolInfo(symbol);
            if (!info.daily && !info.intraday) {
                return { symbol, error: `No data for ${symbol}`, recommendation: 'THEO DÕI' };
            }

            // Score
            const scorer = new StockScorer();
            const scoreResult = scorer.scoreCandle(
                info.daily || info.intraday,
                info.fundamentals,
                null
            );

            // Signals
            const detector = new SignalDetector();
            const dailySignals = info.daily ? detector.getSignals(info.daily, null) : [];
            const groupedSignals = detector.getSignalsGrouped(dailySignals);

            // AI summary
            const systemPrompt = 'Bạn là chuyên gia phân tích chứng khoán Việt Nam. Phân tích mã cổ phiếu dựa trên dữ liệu kỹ thuật và cơ bản. Trả về JSON với các trường: recommendation (MUA|BÁN|NẮM GIỮ|THEO DÕI), reasoning, risks (array).';
            const userContent = JSON.stringify({
                symbol,
                score: scoreResult.total,
                breakdown: scoreResult.breakdown,
                signals: dailySignals,
                fundamentals: info.fundamentals,
            });

            let analysis;
            try {
                const raw = await this.llm.quickChat(systemPrompt, userContent);
                analysis = JSON.parse(raw);
            } catch (err) {
                console.warn('analyst:analyzeSymbol LLM parse failed for %s — %s', symbol, err.message);
                analysis = { recommendation: this._fallbackRecommendation(scoreResult.total), reasoning: 'Based on technical analysis only', risks: [] };
            }

            if (!RECOMMENDATIONS.includes(analysis.recommendation)) {
                analysis.recommendation = this._fallbackRecommendation(scoreResult.total);
            }

            return {
                symbol,
                date: info.dailyDate || info.intraday?.date,
                score: scoreResult.total,
                breakdown: scoreResult.breakdown,
                signals: dailySignals,
                signalsGrouped: groupedSignals,
                recommendation: analysis.recommendation,
                reasoning: analysis.reasoning || '',
                risks: analysis.risks || [],
                fundamentals: info.fundamentals,
                currentPrice: (info.daily?.close || info.intraday?.close) || 0,
            };
        } finally {
            await db.close();
        }
    }

    /**
     * Compare multiple symbols.
     * @param {string[]} symbols
     * @param {string} [timeframe='1D'] - Timeframe for analysis
     * @returns {Promise<object>} { comparison, topPick }
     */
    async compareSymbols(symbols, timeframe = '1D') {
        const results = await Promise.allSettled(
            symbols.map(s => this.analyzeSymbol(s, timeframe))
        );
        const analyzed = results
            .filter(r => r.status === 'fulfilled' && r.value && !r.value.error)
            .map(r => r.value)
            .sort((a, b) => b.score - a.score);

        const topPick = analyzed[0] || null;
        const systemPrompt = 'Bạn là chuyên gia phân tích. So sánh các mã sau và chọn mã tốt nhất. Trả về JSON với: summary, reasoning.';
        const userContent = JSON.stringify(analyzed.map(a => ({
            symbol: a.symbol, score: a.score, recommendation: a.recommendation,
        })));

        let aiComparison;
        try {
            const raw = await this.llm.quickChat(systemPrompt, userContent);
            aiComparison = JSON.parse(raw);
        } catch (err) {
            console.warn('analyst:compareSymbols LLM parse failed — %s', err.message);
            aiComparison = { summary: 'Comparison based on technical scores', reasoning: '' };
        }

        return {
            comparison: analyzed,
            topPick,
            aiSummary: aiComparison.summary || '',
            reasoning: aiComparison.reasoning || '',
        };
    }

    /**
     * Analyze overall market conditions.
     * @returns {Promise<object>} { marketSummary, topGainers, recommendations }
     */
    async analyzeMarket() {
        const db = new StockDB();
        const scorer = new StockScorer();
        try {
            await db.connect();
            const scored = await scorer.scoreAll({ limit: 20 });
            const bullish = scored.filter(s => s.score >= 60);
            const bearish = scored.filter(s => s.score <= 40);

            const systemPrompt = 'Bạn là chuyên gia phân tích thị trường chứng khoán Việt Nam. Dựa vào dữ liệu điểm số kỹ thuật, hãy nhận xét tổng quan thị trường. Trả về JSON: marketSummary, sentiment (Tích cực|Trung tính|Tiêu cực), notableStocks, advice.';
            const userContent = JSON.stringify({
                totalAnalyzed: scored.length,
                bullishCount: bullish.length,
                bearishCount: bearish.length,
                top5: scored.slice(0, 5),
            });

            let analysis;
            try {
                const raw = await this.llm.quickChat(systemPrompt, userContent);
                analysis = JSON.parse(raw);
            } catch (err) {
                console.warn('analyst:analyzeMarket LLM parse failed — %s', err.message);
                analysis = { marketSummary: 'Market analysis based on technical scores', sentiment: 'Trung tính', notableStocks: [], advice: '' };
            }

            return {
                marketSummary: analysis.marketSummary || '',
                sentiment: analysis.sentiment || 'Trung tính',
                topStocks: scored.slice(0, 10),
                notableStocks: analysis.notableStocks || [],
                advice: analysis.advice || '',
                bullishCount: bullish.length,
                bearishCount: bearish.length,
            };
        } finally {
            await db.close();
        }
    }

    /**
     * Deep dive strategy analysis.
     * @param {string} symbol
     * @param {string} timeframe
     * @returns {Promise<object>} { strategy, entry, stopLoss, support, resistance, reasoning }
     */
    async deepDiveStrategy(symbol, timeframe = '1D') {
        const db = new StockDB();
        const screener = new StockScreener();
        try {
            await db.connect();
            const info = await screener.getSymbolInfo(symbol);
            if (!info.daily && !info.intraday) {
                return { symbol, error: `No data for ${symbol}` };
            }

            const candle = info.daily || info.intraday;
            const systemPrompt = 'Bạn là chuyên gia phân tích kỹ thuật chứng khoán. Đưa ra chiến lược giao dịch cụ thể. Trả về JSON: strategy, entry (number), stopLoss (number), support (number[]), resistance (number[]), reasoning, riskReward (number).';
            const userContent = JSON.stringify({
                symbol,
                timeframe,
                currentPrice: candle.close || candle.price,
                rsi: candle.rsi,
                ema20: candle.ema20,
                ema50: candle.ema50,
                bb_upper: candle.bb_upper,
                bb_lower: candle.bb_lower,
                atr: candle.atr,
            });

            let analysis;
            try {
                const raw = await this.llm.deepChat(systemPrompt, userContent);
                analysis = JSON.parse(raw);
            } catch (err) {
                console.warn('analyst:deepDiveStrategy LLM parse failed for %s — %s', symbol, err.message);
                const price = candle.close || candle.price || 0;
                analysis = {
                    strategy: 'Unable to generate deep analysis',
                    entry: price,
                    stopLoss: price * 0.95,
                    support: [price * 0.95, price * 0.90],
                    resistance: [price * 1.05, price * 1.10],
                    reasoning: 'Based on current price levels',
                    riskReward: 2,
                };
            }

            return {
                symbol,
                timeframe,
                strategy: analysis.strategy || '',
                entry: analysis.entry,
                stopLoss: analysis.stopLoss,
                support: analysis.support || [],
                resistance: analysis.resistance || [],
                reasoning: analysis.reasoning || '',
                riskReward: analysis.riskReward || 1,
            };
        } finally {
            await db.close();
        }
    }

    /**
     * Review a portfolio of holdings.
     * @param {Array<{symbol:string, shares:number, avgPrice:number}>} holdings
     * @returns {Promise<object>} { holdings, overallAssessment }
     */
    async portfolioReview(holdings) {
        const analyzed = [];
        for (const h of holdings) {
            try {
                const analysis = await this.analyzeSymbol(h.symbol);
                analyzed.push({
                    symbol: h.symbol,
                    shares: h.shares,
                    avgPrice: h.avgPrice,
                    currentPrice: analysis.currentPrice || null,
                    recommendation: analysis.recommendation,
                    score: analysis.score,
                });
            } catch (err) {
                console.warn('analyst:portfolioReview analyzeSymbol failed for %s — %s', h.symbol, err.message);
                analyzed.push({ symbol: h.symbol, shares: h.shares, avgPrice: h.avgPrice, error: 'Analysis failed' });
            }
        }

        const systemPrompt = 'Bạn là chuyên gia tư vấn đầu tư. Đánh giá danh mục đầu tư dựa trên phân tích từng mã. Trả về JSON: overallAssessment, concerns (array), suggestions (array), riskLevel (Cao|Trung bình|Thấp).';
        const userContent = JSON.stringify(analyzed.map(a => ({
            symbol: a.symbol, recommendation: a.recommendation, score: a.score,
        })));

        let assessment;
        try {
            const raw = await this.llm.quickChat(systemPrompt, userContent);
            assessment = JSON.parse(raw);
        } catch (err) {
            console.warn('analyst:portfolioReview LLM parse failed — %s', err.message);
            assessment = { overallAssessment: 'Portfolio review based on technical analysis', concerns: [], suggestions: [], riskLevel: 'Trung bình' };
        }

        // Calculate total portfolio value and P&L
        let totalValue = 0;
        let totalCost = 0;
        analyzed.forEach(holding => {
            if (holding.currentPrice !== null) {
                const positionValue = holding.shares * holding.currentPrice;
                const positionCost = holding.shares * holding.avgPrice;
                totalValue += positionValue;
                totalCost += positionCost;
                holding.marketValue = positionValue;
                holding.costBasis = positionCost;
                holding.unrealizedPnL = positionValue - positionCost;
                holding.unrealizedPnLPct = positionCost > 0 ? ((positionValue - positionCost) / positionCost) * 100 : 0;
            }
        });

        return {
            holdings: analyzed,
            overallAssessment: assessment.overallAssessment || '',
            concerns: assessment.concerns || [],
            suggestions: assessment.suggestions || [],
            riskLevel: assessment.riskLevel || 'Trung bình',
            totalValue,
            totalCost,
            totalUnrealizedPnL: totalValue - totalCost,
            totalUnrealizedPnLPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        };
    }

    _fallbackRecommendation(score) {
        if (score >= 70) return 'MUA';
        if (score >= 55) return 'THEO DÕI';
        if (score >= 40) return 'NẮM GIỮ';
        return 'BÁN';
    }
}

module.exports = { Analyst, RECOMMENDATIONS };
