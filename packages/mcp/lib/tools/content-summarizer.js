const { LLMClient: ContentResearchLLMClient } = require('@andy-toolforge/content-research');

const definition = {
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

async function handler(llm, args) {
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

    const result = await crLlm.summarizeContent(content, title, lang);
    return result;
}

module.exports = { definition, handler };
