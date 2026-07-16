/**
 * @andy-toolforge/vn-stock MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 */

const { StockScreener, StockScorer } = require('./lib/index');
const { Analyst } = require('./lib/analyst');

const screenDefinition = {
    name: 'toolforge_vn_stock_screen',
    description: 'Screen VN stocks by technical indicator conditions using daily data',
    inputSchema: {
        type: 'object',
        properties: {
            filters: {
                type: 'array',
                description: 'Array of filter conditions',
                items: {
                    type: 'object',
                    properties: {
                        field: { type: 'string', description: 'Indicator field name (e.g. rsi, ema20, volume)' },
                        operator: { type: 'string', enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'crossAbove', 'crossBelow'], description: 'Comparison operator' },
                        value: { type: 'number', description: 'Numeric value to compare against (omit if using compareToField)' },
                        compareToField: { type: 'string', description: 'Another field to compare against (e.g. ema50, vol_ma20)' },
                    },
                    required: ['field', 'operator'],
                },
            },
            limit: { type: 'number', description: 'Max results (default 20)', default: 20 },
            sortBy: { type: 'string', description: 'Sort results by this field (e.g. rsi, volume)' },
        },
    },
};

const infoDefinition = {
    name: 'toolforge_vn_stock_info',
    description: 'Get full info for a VN stock symbol (daily, intraday, fundamentals)',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string', description: 'Stock symbol (e.g. FPT, VNM, HPG)' },
        },
        required: ['symbol'],
    },
};

const scoreIntradayDefinition = {
    name: 'toolforge_vn_stock_score_intraday',
    description: 'Score all VN stocks by intraday multi-factor ranking (technical 40%, volume 20%, momentum 20%; no fundamental). Supports 15m and 1h intervals.',
    inputSchema: {
        type: 'object',
        properties: {
            interval: { type: 'string', enum: ['15m', '1h'], description: 'Intraday timeframe (default 15m)', default: '15m' },
            limit: { type: 'number', description: 'Max results (default 50)', default: 50 },
        },
    },
};

const scoreDefinition = {
    name: 'toolforge_vn_stock_score',
    description: 'Score all VN stocks by multi-factor ranking (technical 40% incl. RSI/EMA/MACD/Bollinger/ATR, volume 20%, momentum 20% incl. VWAP, fundamental 20%)',
    inputSchema: {
        type: 'object',
        properties: {
            limit: { type: 'number', description: 'Max results (default 50)', default: 50 },
            weights: {
                type: 'object',
                description: 'Custom weight overrides (e.g. { technical: 0.5, volume: 0.3 })',
                properties: {
                    technical: { type: 'number' },
                    volume: { type: 'number' },
                    momentum: { type: 'number' },
                    fundamental: { type: 'number' },
                },
            },
        },
    },
};

async function screenHandler(llm, args) {
    const screener = new StockScreener();
    try {
        const results = await screener.screenDaily({
            filters: args.filters || [],
            limit: args.limit || 20,
            sortBy: args.sortBy || null,
        });
        return {
            count: results.length,
            results,
        };
    } finally {
        await screener.close();
    }
}

async function infoHandler(llm, args) {
    const screener = new StockScreener();
    try {
        return await screener.getSymbolInfo(args.symbol);
    } finally {
        await screener.close();
    }
}

async function scoreHandler(llm, args) {
    const scorer = new StockScorer({ weights: args.weights || {} });
    const results = await scorer.scoreAll({ limit: args.limit || 50 });
    return {
        count: results.length,
        results,
    };
}

async function scoreIntradayHandler(llm, args) {
    const scorer = new StockScorer();
    const results = await scorer.scoreAllIntraday({ interval: args.interval || '15m', limit: args.limit || 50 });
    return {
        count: results.length,
        results,
    };
}

const analyzeDefinition = {
    name: 'toolforge_vn_stock_analyze',
    description: 'Analyze a VN stock symbol — technical signals, AI score, recommendation (MUA/BÁN/NẮM GIỮ/THEO DÕI)',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string', description: 'Stock symbol (e.g. FPT, VNM, HPG)' },
        },
        required: ['symbol'],
    },
};

const deepDiveDefinition = {
    name: 'toolforge_vn_stock_deep_dive',
    description: 'Deep dive strategy for a VN stock — entry/exit, stop-loss, support/resistance, risk/reward',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: { type: 'string', description: 'Stock symbol (e.g. FPT, VNM, HPG)' },
            timeframe: { type: 'string', enum: ['1D', '1h', '15m'], description: 'Analysis timeframe', default: '1D' },
        },
        required: ['symbol'],
    },
};

const compareDefinition = {
    name: 'toolforge_vn_stock_compare',
    description: 'Compare multiple VN stock symbols — ranking, top pick, AI summary',
    inputSchema: {
        type: 'object',
        properties: {
            symbols: { type: 'array', items: { type: 'string' }, description: 'Stock symbols to compare (e.g. ["FPT","VNM","HPG"])' },
        },
        required: ['symbols'],
    },
};

async function analyzeHandler(llm, args) {
    const analyst = new Analyst();
    return await analyst.analyzeSymbol(args.symbol);
}

async function deepDiveHandler(llm, args) {
    const analyst = new Analyst();
    return await analyst.deepDiveStrategy(args.symbol, args.timeframe || '1D');
}

async function compareHandler(llm, args) {
    const analyst = new Analyst();
    return await analyst.compareSymbols(args.symbols);
}

module.exports = function () {
    return [
        { definition: screenDefinition, handler: screenHandler },
        { definition: infoDefinition, handler: infoHandler },
        { definition: scoreDefinition, handler: scoreHandler },
        { definition: scoreIntradayDefinition, handler: scoreIntradayHandler },
        { definition: analyzeDefinition, handler: analyzeHandler },
        { definition: deepDiveDefinition, handler: deepDiveHandler },
        { definition: compareDefinition, handler: compareHandler },
    ];
};
