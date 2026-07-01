/**
 * analyze_script tool — Analyze a script for visual content generation using Gemini.
 * Uses footage-generation's LLMClient to leverage domain-specific skill files.
 */
const { LLMClient: FootageLLMClient } = require('@andy-toolforge/footage-generation');

const definition = {
    name: 'analyze_script',
    description: 'Analyze a podcast/video script and produce visual segments with image generation prompts and formattedSummary for each segment',
    inputSchema: {
        type: 'object',
        properties: {
            script: { type: 'string', description: 'The full script text to analyze' },
            title: { type: 'string', description: 'Title of the content' },
            outline: { type: 'string', description: 'Optional outline/agenda of the content' },
            density: { type: 'number', description: 'Number of images per segment (1-5)', default: 2 },
            lang: { type: 'string', description: 'Language code (vi, en)', default: 'vi' },
        },
        required: ['script', 'title'],
    },
};

async function handler(llm, args) {
    const { script, title, outline, density = 2, lang = 'vi' } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    // Use the llm directly if it already has analyzeScript (e.g. injected mock)
    // Otherwise create a footage-generation LLMClient wrapping the same provider
    const footageLlm = typeof llm.analyzeScript === 'function'
        ? llm
        : new FootageLLMClient({
            provider: 'gemini',
            apiKey: llm.apiKey,
            model: llm.model,
        });

    const segments = await footageLlm.analyzeScript(
        script,
        title,
        outline || '',
        density,
        lang,
    );

    // Build formattedSummary from segments
    const formattedSummary = segments.map((seg, i) => {
        const time = seg.startTime ? `[${seg.startTime}${seg.endTime ? `-${seg.endTime}` : ''}]` : '';
        return `## ${i + 1}. ${seg.title || seg.segmentTitle || `Segment ${i + 1}`} ${time}\n` +
            (seg.summary ? `${seg.summary}\n` : '') +
            (seg.visualStyle ? `Style: ${seg.visualStyle}\n` : '') +
            (seg.prompt ? `Prompt: ${seg.prompt}\n` : '');
    }).join('\n');

    return { segments, formattedSummary };
}

module.exports = { definition, handler };
