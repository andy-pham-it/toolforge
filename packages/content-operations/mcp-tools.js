/**
 * @andy-toolforge/content-operations MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 */
const { LLMClient } = require('@andy-toolforge/core');

const definition = {
    name: 'toolforge_content_research',
    description: 'Discover content trends, keyword insights, competitive analysis, and content gaps for a niche',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Research action: trends | keywords | competitor | gaps | ideas',
                enum: ['trends', 'keywords', 'competitor', 'gaps', 'ideas'],
            },
            niche: { type: 'string', description: 'Content niche or topic (e.g. "personal finance", "tech reviews")' },
            platform: { type: 'string', description: 'Platform filter for trends: all | youtube | tiktok | facebook', default: 'all' },
            language: { type: 'string', description: 'Language code for keyword analysis', default: 'vi' },
            url: { type: 'string', description: 'Competitor URL for competitor analysis' },
            competitors: { type: 'array', items: { type: 'string' }, description: 'List of competitor names/URLs for gap analysis' },
        },
        required: ['action', 'niche'],
    },
};

async function handler(llm, args) {
    const { action, niche, platform, language, url, competitors } = args;

    const { ContentResearcher } = require('./lib/researcher');
    const researcher = new ContentResearcher({ llmClient: llm });

    switch (action) {
        case 'trends':
            return researcher.discoverTrends(niche, platform || 'all');

        case 'keywords':
            return researcher.analyzeKeywords(niche, language || 'vi');

        case 'competitor':
            if (!url) throw new Error('url is required for competitor analysis');
            return researcher.analyzeCompetitor(url);

        case 'gaps':
            return researcher.findContentGaps(niche, competitors || []);

        case 'ideas':
            return researcher.generateContentIdeas(niche);

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

module.exports = function () {
    return [
        { definition, handler },
    ];
};
