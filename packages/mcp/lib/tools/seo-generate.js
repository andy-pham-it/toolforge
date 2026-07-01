/**
 * toolforge_seo_generate tool — Generate SEO metadata for YouTube, TikTok, and Facebook in one call.
 */
const definition = {
    name: 'toolforge_seo_generate',
    description: 'Generate SEO metadata (title, description, tags, keywords, timestamps) for a video/audio script across YouTube, TikTok, and Facebook simultaneously',
    inputSchema: {
        type: 'object',
        properties: {
            script: { type: 'string', description: 'The full script text' },
            title: { type: 'string', description: 'Working title of the content' },
            language: { type: 'string', description: 'Language code (e.g. vi, en)', default: 'vi' },
        },
        required: ['script', 'title'],
    },
};

const systemPrompt = `You are an expert SEO strategist specializing in multi-platform video content optimization.
Analyze the given script and title to produce metadata optimized for YouTube, TikTok, and Facebook simultaneously.

Return ONLY a valid JSON object with this exact structure:
{
  "youtube": {
    "suggestedTitle": "YouTube SEO title (max 60 chars)",
    "description": "YouTube SEO description with keywords (200-500 chars)",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "timestamps": [
      { "time": "00:00", "label": "Introduction" },
      { "time": "01:30", "label": "Main topic" }
    ]
  },
  "tiktok": {
    "suggestedTitle": "TikTok hook title (max 40 chars)",
    "description": "TikTok video description with hashtags",
    "tags": ["tag1", "tag2", "tag3"],
    "keywords": ["keyword1", "keyword2"],
    "timestamps": []
  },
  "facebook": {
    "suggestedTitle": "Facebook title (max 60 chars)",
    "description": "Facebook post description with engagement hook",
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "timestamps": [
      { "time": "00:00", "label": "Introduction" },
      { "time": "01:30", "label": "Main topic" }
    ]
  }
}`;

async function handler(llm, args) {
    const { script, title, language = 'vi' } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    const userPrompt = [
        `Language: ${language}`,
        `Title: ${title}`,
        '',
        `Script:`,
        script,
    ].join('\n');

    const raw = await llm.chat(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);

    // Validate response shape — all 3 platforms required
    for (const platform of ['youtube', 'tiktok', 'facebook']) {
        const p = parsed[platform];
        if (!p || !p.suggestedTitle || !Array.isArray(p.tags)) {
            throw new Error(`LLM returned incomplete SEO data for ${platform}`);
        }
    }

    return parsed;
}

module.exports = { definition, handler };
