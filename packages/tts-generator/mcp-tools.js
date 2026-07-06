'use strict';

/**
 * @andy-toolforge/tts-generator MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 *
 * Tools:
 *   generate_tts    — Full TTS pipeline: script → planner → TTS → output
 *   list_tts_voices — List all 30 Gemini TTS voices with descriptions
 */

const { TTSPlanner, TTSGenerator, OutputFormatter, VOICES, VOICE_NAMES } = require('./lib');

// ---------------------------------------------------------------------------
// generate_tts
// ---------------------------------------------------------------------------
const generateTTSDef = {
    name: 'generate_tts',
    description: 'Generate voice audio from podcast script using Gemini TTS API. Supports smart segmentation (LLM-based), 30-voice selection, and batch/single/stream output modes.',
    inputSchema: {
        type: 'object',
        properties: {
            script:   { type: 'string', description: 'Full podcast script text to convert to speech' },
            title:    { type: 'string', description: 'Episode title (provides context for planner segmentation)' },
            voice:    { type: 'string', description: `Voice name override. One of: ${VOICE_NAMES.join(', ')}. Default: "auto" (smart selection)`, default: 'auto' },
            mode:     { type: 'string', enum: ['batch', 'single', 'stream'], description: 'Output mode: batch (array of segment-audio pairs), single (concatenated audio), stream (iterable segments)', default: 'batch' },
            language: { type: 'string', description: 'Language code: "vi", "en", or "auto" detect', default: 'auto' },
            pace:     { type: 'string', enum: ['slow', 'normal', 'fast'], description: 'Speech pace', default: 'normal' },
            tags:     { type: 'string', description: 'Comma-separated audio tags for expressiveness (e.g. "determination,positive,whispers")' },
        },
        required: ['script', 'title'],
    },
};

async function generateTTSHandler(llm, args) {
    const { script, title, voice = 'auto', mode = 'batch', language = 'auto', pace = 'normal', tags = '' } = args;

    if (!script || !title) {
        throw new Error('Missing required arguments: script, title');
    }

    const audioTags = tags
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    // 1. Plan: segment the script using the MCP runtime LLM
    const planner = new TTSPlanner({ llm });
    const plan = await planner.plan(script, title, { voice, language, pace });

    // 2. Generate: call Gemini TTS for each segment
    const gen = new TTSGenerator({
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        tts: {
            model: 'gemini-3.1-flash-tts-preview',
            fallback: 'gemini-2.5-flash-preview-tts',
        },
    });

    if (audioTags.length > 0) {
        plan.segments.forEach(s => {
            s.audioTags = [...new Set([...s.audioTags, ...audioTags])];
        });
    }

    const audioResults = await gen.generateBatch(plan.segments);

    // 3. Format output
    const formatter = new OutputFormatter();
    const successful = audioResults.filter(r => !r.error);

    if (mode === 'single') {
        const buffers = successful.map(r => r.audio);
        const combined = formatter.formatSingle(buffers);
        return {
            audio: combined.toString('base64'),
            format: successful[0]?.format || 'wav',
            segments: audioResults,
        };
    }

    if (mode === 'stream') {
        const batch = formatter.formatBatch(
            plan.segments.filter(s => !audioResults.find(r => r.error && r.id === s.id)),
            successful.map(r => r.audio),
        );
        return {
            segments: batch.segments.map(s => ({
                ...s,
                audio: s.audio.toString('base64'),
            })),
            mode: 'stream',
            metadata: plan.metadata,
        };
    }

    // mode === 'batch' (default)
    const batch = formatter.formatBatch(
        plan.segments.filter(s => !audioResults.find(r => r.error && r.id === s.id)),
        successful.map(r => r.audio),
    );
    return {
        segments: batch.segments.map(s => ({
            ...s,
            audio: s.audio.toString('base64'),
        })),
        metadata: plan.metadata,
        failedSegments: audioResults.filter(r => r.error).map(r => ({
            id: r.id,
            error: r.error,
        })),
    };
}

// ---------------------------------------------------------------------------
// list_tts_voices
// ---------------------------------------------------------------------------
const listTTSVoicesDef = {
    name: 'list_tts_voices',
    description: 'List all available Gemini TTS voices with descriptions and style guides',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};

async function listTTSVoicesHandler(llm, args) {
    const voiceList = Object.entries(VOICES).map(([name, meta]) => ({
        name,
        style: meta.style,
        description: meta.description,
    }));

    return {
        voices: voiceList,
        count: voiceList.length,
    };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: generateTTSDef, handler: generateTTSHandler },
        { definition: listTTSVoicesDef, handler: listTTSVoicesHandler },
    ];
};
