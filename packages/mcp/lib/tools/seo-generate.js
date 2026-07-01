/**
 * seo_generate tool — Generate SEO metadata for a script using Gemini.
 */
const definition = {
    name: 'seo_generate',
    description: 'Generate SEO metadata (title, description, tags, keywords, timestamps) for a video/audio script optimized for a target platform',
    inputSchema: {
        type: 'object',
        properties: {
            script: { type: 'string', description: 'The full script text' },
            title: { type: 'string', description: 'Working title of the content' },
            language: { type: 'string', description: 'Language code (e.g. vi, en)', default: 'vi' },
            platform: {
                type: 'string',
                enum: ['youtube', 'tiktok', 'facebook'],
                description: 'Target platform for SEO optimization',
                default: 'youtube',
            },
        },
        required: ['script', 'title'],
    },
};

const systemPrompt = `You are an expert SEO strategist specializing in video content optimization.
Analyze the given script and title to produce metadata optimized for the target platform.
Return ONLY a valid JSON object with this exact structure:
{
  "suggestedTitle": "SEO-optimized title (max 60 chars for YouTube, 40 for others)",
  "description": "SEO description with keywords (200-500 chars)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "timestamps": [
    { "time": "00:00", "label": "Introduction" },
    { "time": "01:30", "label": "Main topic" }
  ]
}`;

async function handler(llm, args) {
    const { script, title, language = 'vi', platform = 'youtube' } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    const userPrompt = [
        `Platform: ${platform}`,
        `Language: ${language}`,
        `Title: ${title}`,
        '',
        `Script:`,
        script,
    ].join('\n');

    const raw = await llm.chat(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);

    // Validate response shape
    if (!parsed.suggestedTitle || !Array.isArray(parsed.tags)) {
        throw new Error('LLM returned incomplete SEO data');
    }

    return parsed;
}

module.exports = { definition, handler };
