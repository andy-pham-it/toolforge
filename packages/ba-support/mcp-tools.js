/**
 * @andy-toolforge/ba-support MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 */

const competitorDefinition = {
    name: 'toolforge_competitor_analysis',
    description: 'Analyze a competitor — crawl their website, profile their business, identify strengths and weaknesses',
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Competitor website URL to analyze' },
        },
        required: ['url'],
    },
};

const pricingDefinition = {
    name: 'toolforge_pricing_analysis',
    description: 'Analyze competitor pricing data and generate strategic pricing insights',
    inputSchema: {
        type: 'object',
        properties: {
            data: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        price: { type: 'number' },
                        model: { type: 'string' },
                        features: { type: 'array', items: { type: 'string' } },
                    },
                },
                description: 'Array of competitor pricing entries',
            },
        },
        required: ['data'],
    },
};

const swotDefinition = {
    name: 'toolforge_swot_analysis',
    description: 'Generate a SWOT analysis from competitor profiles — strengths, weaknesses, opportunities, threats',
    inputSchema: {
        type: 'object',
        properties: {
            competitorData: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        keyStrengths: { type: 'array', items: { type: 'string' } },
                        keyWeaknesses: { type: 'array', items: { type: 'string' } },
                    },
                },
                description: 'Array of competitor profiles (from toolforge_competitor_analysis)',
            },
        },
        required: ['competitorData'],
    },
};

const trendsDefinition = {
    name: 'toolforge_trend_analysis',
    description: 'Analyze market trends for given keywords — momentum, emerging patterns, industry insights',
    inputSchema: {
        type: 'object',
        properties: {
            keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Keywords to analyze for market trend data',
            },
        },
        required: ['keywords'],
    },
};

const reportDefinition = {
    name: 'toolforge_business_report',
    description: 'Generate a comprehensive business analysis report from research findings',
    inputSchema: {
        type: 'object',
        properties: {
            findings: {
                type: 'object',
                description: 'All research findings to include in the report',
            },
            format: {
                type: 'string',
                enum: ['markdown', 'plain'],
                description: 'Output format',
                default: 'markdown',
            },
        },
        required: ['findings'],
    },
};

async function competitorHandler(llm, args) {
    const { url } = args;
    const { MarketResearcher } = require('./lib/researcher');
    const researcher = new MarketResearcher({ llmClient: llm });
    return researcher.crawlCompetitor(url);
}

async function pricingHandler(llm, args) {
    const { data } = args;
    const { MarketResearcher } = require('./lib/researcher');
    const researcher = new MarketResearcher({ llmClient: llm });
    return researcher.analyzePricing(data);
}

async function swotHandler(llm, args) {
    const { competitorData } = args;
    const { MarketResearcher } = require('./lib/researcher');
    const researcher = new MarketResearcher({ llmClient: llm });
    return researcher.swotAnalysis(competitorData);
}

async function trendsHandler(llm, args) {
    const { keywords } = args;
    const { MarketResearcher } = require('./lib/researcher');
    const researcher = new MarketResearcher({ llmClient: llm });
    return researcher.trackTrends(keywords);
}

async function reportHandler(llm, args) {
    const { findings, format } = args;
    const { MarketResearcher } = require('./lib/researcher');
    const researcher = new MarketResearcher({ llmClient: llm });
    return researcher.generateReport(findings, format || 'markdown');
}

module.exports = function () {
    return [
        { definition: competitorDefinition, handler: competitorHandler },
        { definition: pricingDefinition, handler: pricingHandler },
        { definition: swotDefinition, handler: swotHandler },
        { definition: trendsDefinition, handler: trendsHandler },
        { definition: reportDefinition, handler: reportHandler },
    ];
};
