const { LLMClient: ContentResearchLLMClient } = require('@andy-toolforge/content-research');

const definition = {
    name: 'andy_toolforge_competitor_analyzer',
    description: 'Crawl a competitor URL and analyze via LLM with SWOT framework using Vietnamese skill-file prompts',
    inputSchema: {
        type: 'object',
        properties: {
            competitorUrl: { type: 'string', description: 'URL of the competitor to analyze' },
            analysisScope: { type: 'string', description: 'Scope of analysis (e.g. full, content, seo, social)' },
            lang: { type: 'string', description: 'Language code (vi, en)', default: 'vi' },
        },
        required: ['competitorUrl', 'analysisScope'],
    },
};

async function handler(llm, args) {
    const { competitorUrl, analysisScope, lang = 'vi' } = args;

    if (!competitorUrl || !analysisScope) {
        throw new Error('Missing required arguments: competitorUrl, analysisScope');
    }

    const crLlm = typeof llm.analyzeCompetitor === 'function'
        ? llm
        : new ContentResearchLLMClient({
            provider: 'gemini',
            apiKey: llm.apiKey,
            model: llm.model,
        });

    const result = await crLlm.analyzeCompetitor(competitorUrl, analysisScope, lang);
    return result;
}

module.exports = { definition, handler };
