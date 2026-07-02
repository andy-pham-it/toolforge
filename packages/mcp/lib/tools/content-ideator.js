const { LLMClient: ContentResearchLLMClient } = require('@andy-toolforge/content-research');

const definition = {
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

async function handler(llm, args) {
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

    const result = await crLlm.generateContentIdeas(topic, audience, format, numIdeas, lang);
    return result;
}

module.exports = { definition, handler };
