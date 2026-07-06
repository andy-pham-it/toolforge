/**
 * @andy-toolforge/tts-generator MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 *
 * Tools:
 *   generate_tts   — Full TTS pipeline: script → planner → TTS → output
 *   list_tts_voices — List all 30 Gemini TTS voices
 */

const { VOICES, VOICE_NAMES } = require('./lib/voices');

// ---------------------------------------------------------------------------
// generate_tts
// ---------------------------------------------------------------------------
const generateTtsDef = {
    name: 'generate_tts',
    description: 'Generate TTS audio from a podcast script using Gemini TTS models. Supports smart segmentation via LLM, 30 voices, batch/single/stream output.',
    inputSchema: {
        type: 'object',
        properties: {
            script:     { type: 'string', description: 'Full podcast script text' },
            title:      { type: 'string', description: 'Episode title (used by planner for context)' },
            voice:      { type: 'string', description: 'Voice name (e.g. "Kore") or "auto" for smart selection', default: 'auto' },
            mode:       { type: 'string', enum: ['batch', 'single', 'stream'], description: 'Output mode', default: 'batch' },
            language:   { type: 'string', description: 'Language code (vi, en) or "auto"', default: 'auto' },
            pace:       { type: 'string', enum: ['slow', 'normal', 'fast'], description: 'Speaking pace', default: 'normal' },
            planner:    { type: 'string', description: 'Override planner model (empty = default Gemma 4 26B via Groq)' },
            tags:       { type: 'string', description: 'Comma-separated audio tags, e.g. "determination,positive"' },
        },
        required: ['script', 'title'],
    },
};

async function generateTtsHandler(llm, args) {
    const { script, title, voice = 'auto', mode = 'batch', language = 'auto', pace = 'normal', planner, tags } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    // Lazy-load to break circular deps
    const { TTSPlanner } = require('./lib/planner');
    const { TTSGenerator } = require('./lib/generator');
    const { OutputFormatter } = require('./lib/output');

    // 1. Plan segmentation
    const plannerInstance = new TTSPlanner({
        provider: 'groq',
        model: planner || 'gemma-4-26b-it',
        apiKey: llm.apiKey,
    });

    const segmentPlan = await plannerInstance.plan(script, title, {
        voice,
        language,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });

    // 2. Generate audio for each segment
    const generator = new TTSGenerator({
        apiKey: llm.apiKey,
    });

    const audioSegments = await generator.generateBatch(segmentPlan.segments);

    // 3. Format output
    const formatter = new OutputFormatter();
    const result = formatter.format(audioSegments);

    return result;
}

// ---------------------------------------------------------------------------
// list_tts_voices
// ---------------------------------------------------------------------------
const listTtsVoicesDef = {
    name: 'list_tts_voices',
    description: 'List all 30 Gemini TTS voices with style and description.',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};

async function listTtsVoicesHandler(llm, args) {
    const voices = VOICE_NAMES.map(name => ({
        name,
        style: VOICES[name].style,
        description: VOICES[name].description,
    }));
    return { voices };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: generateTtsDef, handler: generateTtsHandler },
        { definition: listTtsVoicesDef, handler: listTtsVoicesHandler },
    ];
};
