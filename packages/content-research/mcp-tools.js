/**
 * @andy-toolforge/content-research MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 *
 * These tools were migrated from built-in MCP tools (packages/mcp/lib/tools/)
 * to plugin discovery. Names are preserved for backward compatibility.
 */

const { LLMClient: ContentResearchLLMClient } = require('@andy-toolforge/content-research');

// ---------------------------------------------------------------------------
// andy_toolforge_content_summarizer
// ---------------------------------------------------------------------------
const summarizerDef = {
    name: 'andy_toolforge_content_summarizer',
    description: 'Summarize articles, reports, or other content via LLM with Vietnamese skill-file prompts',
    inputSchema: {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'The full content text to summarize' },
            title: { type: 'string', description: 'Title of the content' },
            lang: { type: 'string', description: 'Language code (vi, en)', default: 'vi' },
        },
        required: ['content', 'title'],
    },
};

async function summarizerHandler(llm, args) {
    const { content, title, lang = 'vi' } = args;

    if (!content || !title) {
        throw new Error('Missing required arguments: content, title');
    }

    const crLlm = typeof llm.summarizeContent === 'function'
        ? llm
        : new ContentResearchLLMClient({
            provider: 'gemini',
            apiKey: llm.apiKey,
            model: llm.model,
        });

    return crLlm.summarizeContent(content, title, lang);
}

// ---------------------------------------------------------------------------
// andy_toolforge_content_ideator
// ---------------------------------------------------------------------------
const ideatorDef = {
    name: 'andy_toolforge_content_ideator',
    description: 'Generate content ideas via LLM based on topic, audience, and format with Vietnamese skill-file prompts',
    inputSchema: {
        type: 'object',
        properties: {
            topic: { type: 'string', description: 'Topic for content ideas' },
            audience: { type: 'string', description: 'Target audience description' },
            format: { type: 'string', description: 'Content format (e.g. blog post, video, social)' },
            numIdeas: { type: 'number', description: 'Number of ideas to generate (1-10)', default: 3 },
            lang: { type: 'string', description: 'Language code (vi, en)', default: 'vi' },
        },
        required: ['topic', 'audience', 'format'],
    },
};

async function ideatorHandler(llm, args) {
    const { topic, audience, format, numIdeas = 3, lang = 'vi' } = args;

    if (!topic || !audience || !format) {
        throw new Error('Missing required arguments: topic, audience, format');
    }

    const crLlm = typeof llm.generateContentIdeas === 'function'
        ? llm
        : new ContentResearchLLMClient({
            provider: 'gemini',
            apiKey: llm.apiKey,
            model: llm.model,
        });

    return crLlm.generateContentIdeas(topic, audience, format, numIdeas, lang);
}

// ---------------------------------------------------------------------------
// andy_toolforge_article_manager
// ---------------------------------------------------------------------------
const managerDef = {
    name: 'andy_toolforge_article_manager',
    description: 'Manage article lifecycle — classify, tag, summarize, or improve content via LLM with Vietnamese skill-file prompts',
    inputSchema: {
        type: 'object',
        properties: {
            articleContent: { type: 'string', description: 'The full article content' },
            articleTitle: { type: 'string', description: 'Article title' },
            action: { type: 'string', description: 'Action to perform: classify, tag, summarize, improve, or full' },
            lang: { type: 'string', description: 'Language code (vi, en)', default: 'vi' },
        },
        required: ['articleContent', 'articleTitle', 'action'],
    },
};

async function managerHandler(llm, args) {
    const { articleContent, articleTitle, action, lang = 'vi' } = args;

    if (!articleContent || !articleTitle || !action) {
        throw new Error('Missing required arguments: articleContent, articleTitle, action');
    }

    const crLlm = typeof llm.manageArticle === 'function'
        ? llm
        : new ContentResearchLLMClient({
            provider: 'gemini',
            apiKey: llm.apiKey,
            model: llm.model,
        });

    return crLlm.manageArticle(articleContent, articleTitle, action, lang);
}

// ---------------------------------------------------------------------------
// andy_toolforge_competitor_analyzer
// ---------------------------------------------------------------------------
const analyzerDef = {
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

async function analyzerHandler(llm, args) {
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

    return crLlm.analyzeCompetitor(competitorUrl, analysisScope, lang);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: summarizerDef, handler: summarizerHandler },
        { definition: ideatorDef, handler: ideatorHandler },
        { definition: managerDef, handler: managerHandler },
        { definition: analyzerDef, handler: analyzerHandler },
    ];
};
