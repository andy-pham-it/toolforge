/**
 * suggest_cover tool — Suggest podcast cover art design based on content.
 * Follows podcast-cover-generator skill rules for styles and naming.
 */
const definition = {
    name: 'suggest_cover',
    description: 'Suggest podcast cover art design (series cover, episode cover, thumbnail) with visual style, color palette, generation prompt, and formattedBrief summary',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Episode or series title' },
            description: { type: 'string', description: 'Episode description or summary' },
            outline: { type: 'string', description: 'Chapter outline if available' },
            coverType: {
                type: 'string',
                enum: ['series', 'episode', 'thumbnail', 'all'],
                description: 'Type of cover to design',
                default: 'all',
            },
            language: { type: 'string', description: 'Language code', default: 'vi' },
        },
        required: ['title', 'description'],
    },
};

const systemPrompt = `You are a cover design expert for podcast production. Given episode content and context, produce detailed cover art designs.

Rules:
- Choose visual style based on content: Surrealist (philosophical/abstract), Comparison (contrasts), Symbolic (single strong concept), Typography (quote-driven), Cosmic (expansive themes), Lineart (minimalist), Mirror/Reflection (self-reflection themes)
- Aspect ratio: 16:9 horizontal for all covers
- Leave dark space at top and bottom for text overlay (title, episode number)
- NEVER use photorealistic humans. Use: silhouette, shadow figure, stylized outline, abstract figure, woodcut illustration, vintage engraving
- Colours should match the emotional tone of the content
- Prompts must be single-line English prose, no parameters like --ar or --style
- Add text language instruction at end of prompt

Return ONLY a valid JSON object with this exact structure:
{
  "designRationale": "2-3 sentence explanation of the design direction",
  "formattedBrief": "Ready-to-share design brief combining the designRationale, colorPalette specs, and a short summary of each cover type's concept, composition, and filename — formatted as scannable text perfect for sharing with a designer or image generator",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "seriesCover": {
    "conceptTitle": "Short concept name",
    "visualStyle": "Surrealist|Comparison|Symbolic|Typography|Cosmic|Lineart|Mirror",
    "composition": "Description of the visual composition and layout",
    "prompt": "Single-line image generation prompt",
    "filename": "cover_series.png"
  },
  "episodeCover": {
    "conceptTitle": "Short concept name",
    "visualStyle": "...",
    "composition": "...",
    "prompt": "Single-line image generation prompt",
    "filename": "cover_episode.png"
  },
  "thumbnail": {
    "conceptTitle": "Short concept name",
    "visualStyle": "...",
    "composition": "...",
    "prompt": "Single-line image generation prompt",
    "filename": "thumbnail.png"
  }
}`;

async function handler(llm, args) {
    const { title, description, outline, coverType = 'all', language = 'vi' } = args;

    if (!title || !description) {
        throw new Error('Missing required arguments: title, description');
    }

    const userPrompt = [
        `Title: ${title}`,
        `Description: ${description}`,
        outline ? `Outline: ${outline}` : '',
        `Cover types to generate: ${coverType}`,
        `Language for image text: ${language}`,
    ].filter(Boolean).join('\n');

    const raw = await llm.chat(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);

    // Validate — at minimum designRationale + one cover section
    if (!parsed.designRationale) {
        throw new Error('LLM returned incomplete cover data (missing designRationale)');
    }
    const hasCover = parsed.seriesCover || parsed.episodeCover || parsed.thumbnail;
    if (!hasCover) {
        throw new Error('LLM returned incomplete cover data (no cover sections)');
    }

    return parsed;
}

module.exports = { definition, handler };
