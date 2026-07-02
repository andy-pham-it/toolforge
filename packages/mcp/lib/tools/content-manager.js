const { LLMClient: ContentResearchLLMClient } = require('@andy-toolforge/content-research');

const definition = {
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

async function handler(llm, args) {
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

    const result = await crLlm.manageArticle(articleContent, articleTitle, action, lang);
    return result;
}

module.exports = { definition, handler };
