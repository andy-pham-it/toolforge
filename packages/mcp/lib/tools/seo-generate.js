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
Analyze the given script and title thoroughly. The script may be 20-30 minutes long with multiple segments.

For each platform (YouTube, TikTok, Facebook), produce detailed metadata.

Return ONLY a valid JSON object with this exact structure:
{
  "youtube": {
    "suggestedTitle": "YouTube SEO title (max 60 chars, include main keyword)",
    "description": "YouTube SEO description (500-1000 chars, keyword-rich, include timestamps summary, CTAs, links mention)",
    "tags": ["tag1", "tag2", ... 10-15 relevant tags sorted by relevance],
    "keywords": ["keyword1", "keyword2", ... 5-8 keywords],
    "hashtags": ["#Hashtag1", "#Hashtag2", ... 3-5 platform-specific hashtags],
    "thumbnailText": "Short overlay text suggestion for thumbnail (max 40 chars)",
    "thumbnailIdea": "Brief visual description for the thumbnail image",
    "hook": "First 1-2 sentences to grab attention as video starts",
    "timestamps": [
      { "time": "00:00", "label": "Introduction / Hook" },
      { "time": "01:30", "label": "Main topic start" },
      ... one entry per major script segment, typically 6-12 timestamps
    ]
  },
  "tiktok": {
    "suggestedTitle": "TikTok caption / hook (max 40 chars, high curiosity)",
    "description": "TikTok caption with narrative hook + hashtag block (200-400 chars)",
    "tags": ["tag1", "tag2", ... 5-8 trending-style tags],
    "keywords": ["keyword1", "keyword2", ... 3-5 keywords],
    "hashtags": ["#Hashtag1", "#Hashtag2", ... 5-8 hashtags including trending ones],
    "thumbnailText": "Overlay text for TikTok cover (max 30 chars)",
    "thumbnailIdea": "Visual description for the TikTok cover",
    "hook": "First 3 seconds hook text to stop scrollers",
    "timestamps": []
  },
  "facebook": {
    "suggestedTitle": "Facebook title (max 60 chars, shareable, curiosity-driven)",
    "description": "Facebook post description (400-800 chars, engagement hook, question, CTAs)",
    "tags": ["tag1", "tag2", ... 8-12 relevant tags],
    "keywords": ["keyword1", "keyword2", ... 5-8 keywords],
    "hashtags": ["#Hashtag1", "#Hashtag2", ... 3-5 hashtags],
    "thumbnailText": "Overlay text for Facebook video thumbnail (max 40 chars)",
    "thumbnailIdea": "Visual description for the Facebook thumbnail",
    "hook": "Opening line to drive engagement in feed",
    "timestamps": [
      { "time": "00:00", "label": "Introduction" },
      { "time": "01:30", "label": "Main topic" },
      ... 4-8 key timestamps
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
