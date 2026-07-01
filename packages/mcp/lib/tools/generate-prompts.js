/**
 * generate_prompts tool — Generate image generation prompts for podcast script segments.
 * Follows workflow-podcast-processor rules: 5 prompts per segment (a-e), Vietnamese text where applicable.
 */
const definition = {
    name: 'generate_prompts',
    description: 'Generate 5 image prompts (a-e) per script segment with visual style classification (Surrealist, Lineart, Comparison, Typography, Infographic)',
    inputSchema: {
        type: 'object',
        properties: {
            script: { type: 'string', description: 'The full podcast script text' },
            title: { type: 'string', description: 'Episode title' },
            outline: { type: 'string', description: 'Optional outline/agenda of the episode' },
            language: { type: 'string', description: 'Language code for text in images (vi, en)', default: 'vi' },
            density: { type: 'number', description: 'Number of images per segment (1-5)', default: 5 },
        },
        required: ['script', 'title'],
    },
};

const systemPrompt = `You are a visual production expert for podcast videos. Analyze a podcast script and produce detailed image generation prompts for each content segment.

Rules:
- Split the script into 5-12 logical segments based on topic transitions
- For each segment, classify the visual style: Surrealist, Lineart, Comparison, Typography, or Infographic
- Generate 5 image prompts per segment (a=main, b=supplementary1, c=supplementary2, d=supplementary3, e=transition)
- Prompts must be single-line (no line breaks within a prompt), written in English prose
- Aspect ratio: horizontal 16:9
- NEVER describe photorealistic humans. Use: silhouette, shadow figure, stylized outline, abstract figure, artistic sketch
- For Typography, Infographic, Comparison: add text-in-image instruction matching the language
- Surrealist and Lineart: no text needed
- The 5 images per segment should cover: main visual metaphor (a), expanded metaphor (b), contrasting view (c), symbolic layer (d), transition/summary (e)

Return ONLY a valid JSON array of segment objects:
[
  {
    "id": 1,
    "segmentTitle": "Short segment name",
    "summary": "1-sentence content summary",
    "visualStyle": "Surrealist|Lineart|Comparison|Typography|Infographic",
    "startTime": "00:00",
    "endTime": "04:30",
    "images": {
      "a": { "filename": "1_title_a.png", "prompt": "Single-line English prompt for main image...", "editSuggestions": { "closer": "...", "differentSpace": "...", "moodShift": "..." } },
      "b": { "filename": "1_title_b.png", "prompt": "Single-line prompt for supplementary image...", "editSuggestions": { ... } },
      "c": { "filename": "1_title_c.png", "prompt": "...", "editSuggestions": { ... } },
      "d": { "filename": "1_title_d.png", "prompt": "...", "editSuggestions": { ... } },
      "e": { "filename": "1_title_e.png", "prompt": "...", "editSuggestions": { ... } }
    }
  }
]`;

async function handler(llm, args) {
    const { script, title, outline, language = 'vi', density = 5 } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    const userPrompt = [
        `Title: ${title}`,
        outline ? `Outline: ${outline}` : '',
        `Language for image text: ${language}`,
        `Images per segment: ${density}`,
        '',
        `Script:`,
        script,
    ].filter(Boolean).join('\n');

    const raw = await llm.chat(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);

    // Validate — must be array with at least 1 segment, each having images.a.prompt
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('LLM returned empty segments array');
    }
    for (const seg of parsed) {
        if (!seg.images || !seg.images.a || !seg.images.a.prompt) {
            throw new Error(`LLM returned incomplete prompt data for segment ${seg.id || '(unknown)'}`);
        }
    }

    return { segments: parsed };
}

module.exports = { definition, handler };
