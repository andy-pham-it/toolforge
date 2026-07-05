/**
 * @andy-toolforge/footage-generation MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 *
 * These tools were migrated from built-in MCP tools (packages/mcp/lib/tools/)
 * to plugin discovery. Names are preserved for backward compatibility.
 */

const { LLMClient: FootageLLMClient } = require('@andy-toolforge/footage-generation');

// ---------------------------------------------------------------------------
// analyze_script — uses footage-generation LLMClient
// ---------------------------------------------------------------------------
const analyzeScriptDef = {
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

async function analyzeScriptHandler(llm, args) {
    const { script, title, outline, density = 2, lang = 'vi' } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    const footageLlm = typeof llm.analyzeScript === 'function'
        ? llm
        : new FootageLLMClient({
            provider: llm.provider || 'gemini',
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

    const formattedSummary = segments.map((seg, i) => {
        const time = seg.startTime ? `[${seg.startTime}${seg.endTime ? `-${seg.endTime}` : ''}]` : '';
        const mainPrompt = seg.prompts?.a || seg.prompt || '';
        const visualType = seg.visualType || seg.visualStyle || '';
        return `## ${i + 1}. ${seg.title || seg.segmentTitle || `Segment ${i + 1}`} ${time}\n` +
            (seg.summary ? `${seg.summary}\n` : '') +
            (visualType ? `Style: ${visualType}\n` : '') +
            (mainPrompt ? `Prompt: ${mainPrompt}\n` : '');
    }).join('\n');

    return { segments, formattedSummary };
}

// ---------------------------------------------------------------------------
// generate_prompts — uses raw LLM chat
// ---------------------------------------------------------------------------
const generatePromptsDef = {
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

const generatePromptsSystem = `You are a visual production expert for podcast videos. Analyze a podcast script and produce detailed image generation prompts for each content segment.

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

async function generatePromptsHandler(llm, args) {
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

    const raw = await llm.chat(generatePromptsSystem, userPrompt, true);
    const parsed = JSON.parse(raw);

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

// ---------------------------------------------------------------------------
// generate_mapping — uses raw LLM chat
// ---------------------------------------------------------------------------
const generateMappingDef = {
    name: 'generate_mapping',
    description: 'Map background music tracks and sound design elements to each script segment based on mood, pace, and content, with formattedTrackList summary',
    inputSchema: {
        type: 'object',
        properties: {
            segments: {
                type: 'array',
                description: 'Array of segment objects from analyze_script or generate_prompts. Each must have title, summary, startTime, endTime',
                items: { type: 'object' },
            },
            mood: { type: 'string', description: 'Overall mood/theme (e.g. philosophical, dramatic, educational, inspirational)', default: 'philosophical' },
            language: { type: 'string', description: 'Language code', default: 'vi' },
        },
        required: ['segments'],
    },
};

const generateMappingSystem = `You are a music and sound design expert for podcast video production. Given script segments with titles, summaries, and timestamps, produce a music/sound mapping for each segment.

For each segment, recommend:
- A background music genre and subgenre that matches the mood
- A track energy level (low/medium/high)
- Suggested tempo range in BPM
- Instruments or sound elements that fit
- Optional: specific sound effects (SFX) for transitions or emphasis
- Whether the music should fade in, build up, or cut at boundaries

Return ONLY a valid JSON object with this exact structure:
{
  "overallVibe": "One-line description of the episode's audio identity",
  "formattedTrackList": "Ready-to-share formatted description of the full track mapping: overall vibe, then per-track summary with (segmentTitle, time range, genre, energy, instruments, transition)",
  "tracks": [
    {
      "segmentId": 1,
      "segmentTitle": "...",
      "startTime": "00:00",
      "endTime": "04:30",
      "genre": "Ambient / Cinematic / Lo-fi / Electronic / Orchestral / etc.",
      "subgenre": "More specific descriptor",
      "energy": "low|medium|high",
      "bpm": 80,
      "instruments": ["piano pad", "subtle strings", "bass drone"],
      "moodKeywords": ["contemplative", "warm", "introspective"],
      "transition": "fade_in|crossfade|cut|build_up",
      "sfx": ["paper flip", "soft chime at 01:30"],
      "notes": "Production notes for this segment's audio"
    }
  ]
}`;

async function generateMappingHandler(llm, args) {
    const { segments, mood = 'philosophical', language = 'vi' } = args;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        throw new Error('Missing required argument: segments (non-empty array)');
    }

    const userPrompt = [
        `Overall mood: ${mood}`,
        `Language: ${language}`,
        '',
        `Segments:`,
        JSON.stringify(segments.map(s => ({
            id: s.id,
            title: s.title || s.segmentTitle || s.name,
            summary: s.summary,
            startTime: s.startTime,
            endTime: s.endTime,
            visualStyle: s.visualStyle,
        })), null, 2),
    ].join('\n');

    const raw = await llm.chat(generateMappingSystem, userPrompt, true);
    const parsed = JSON.parse(raw);

    if (!parsed.tracks || !Array.isArray(parsed.tracks) || parsed.tracks.length === 0) {
        throw new Error('LLM returned empty tracks array');
    }

    return parsed;
}

// ---------------------------------------------------------------------------
// suggest_cover — uses raw LLM chat
// ---------------------------------------------------------------------------
const suggestCoverDef = {
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

const suggestCoverSystem = `You are a cover design expert for podcast production. Given episode content and context, produce detailed cover art designs.

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

async function suggestCoverHandler(llm, args) {
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

    const raw = await llm.chat(suggestCoverSystem, userPrompt, true);
    const parsed = JSON.parse(raw);

    if (!parsed.designRationale) {
        throw new Error('LLM returned incomplete cover data (missing designRationale)');
    }
    const hasCover = parsed.seriesCover || parsed.episodeCover || parsed.thumbnail;
    if (!hasCover) {
        throw new Error('LLM returned incomplete cover data (no cover sections)');
    }

    return parsed;
}

// ---------------------------------------------------------------------------
// generate_batch_image — spawns BrowserImageGenerator in background
// ---------------------------------------------------------------------------
const generateBatchImageDef = {
    name: 'generate_batch_image',
    description: 'Generate images for script segments using Gemini Images browser automation (free). Accepts segments from generate_prompts, spawns batch generation in background. Returns immediately with PID. Check output directory when done.',
    inputSchema: {
        type: 'object',
        properties: {
            segments: {
                type: 'array',
                description: 'Array of segment objects (from generate_prompts or analyze_script). Each must have title and prompts map.',
                items: { type: 'object' },
            },
            outputDir: {
                type: 'string',
                description: 'Output directory. Defaults to ./images in current working directory.',
            },
        },
        required: ['segments'],
    },
};

async function generateBatchImageHandler(llm, args) {
    const { segments, outputDir } = args;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        throw new Error('Missing required argument: segments (non-empty array)');
    }

    const path = require('path');
    const fs = require('fs');
    const { spawn } = require('child_process');
    const os = require('os');

    const resolvedOutputDir = outputDir
        ? path.resolve(outputDir)
        : path.join(process.cwd(), 'images');
    fs.mkdirSync(resolvedOutputDir, { recursive: true });

    // Write temp prompts file
    const PromptParser = require('./lib/prompt-parser');
    const prompts = PromptParser.fromSegments(segments);
    const promptsFile = path.join(os.tmpdir(), `gemini-batch-${Date.now()}.prompts.md`);
    const content = prompts.map((p, i) => {
        const segIndex = Math.floor(i / 5) + 1;
        const label = ['a', 'b', 'c', 'd', 'e'][i % 5];
        const labelNames = { a: 'chính', b: 'phụ 1', c: 'phụ 2', d: 'phụ 3', e: 'phụ 4' };
        return [
            `### 📌 Phân cảnh ${segIndex}: ${p.name}`,
            `**--- Ảnh ${label.toUpperCase()} (${labelNames[label]}) ---**`,
            `* **Tên file:** \`${p.file}\``,
            '* **🚀 Prompt:**',
            '```text',
            p.prompt,
            '```',
            '',
        ].join('\n');
    }).join('\n');
    fs.writeFileSync(promptsFile, content, 'utf-8');

    // Spawn CLI in background
    const cliPath = path.join(__dirname, '_private/cli.js');
    const child = spawn('node', [cliPath, promptsFile, resolvedOutputDir], {
        stdio: 'ignore',
        detached: true,
    });
    child.unref();

    return {
        pid: child.pid,
        outputDir: resolvedOutputDir,
        promptsFile: promptsFile,
        promptsCount: prompts.length,
        message: `Batch generation started (PID ${child.pid}). ${prompts.length} prompts. Check ${resolvedOutputDir} when done.`,
    };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: analyzeScriptDef, handler: analyzeScriptHandler },
        { definition: generatePromptsDef, handler: generatePromptsHandler },
        { definition: generateMappingDef, handler: generateMappingHandler },
        { definition: suggestCoverDef, handler: suggestCoverHandler },
        { definition: generateBatchImageDef, handler: generateBatchImageHandler },
    ];
};
