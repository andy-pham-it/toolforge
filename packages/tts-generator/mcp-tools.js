'use strict';

/**
 * @andy-toolforge/tts-generator MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 *
 * Tools:
 *   generate_tts    — Full TTS pipeline: script → planner → TTS → output
 *   list_tts_voices — List all 30 Gemini TTS voices with descriptions
 */

const { GoogleGenAI } = require('@google/genai');
const { TTSPlanner, TTSGenerator, LiveTTSGenerator, OutputFormatter, VOICES, VOICE_NAMES, pickVoiceForTone, LIVE_MODEL_NAMES } = require('./lib');

// ---------------------------------------------------------------------------
// generate_tts
// ---------------------------------------------------------------------------
const generateTTSDef = {
    name: 'generate_tts',
    description: 'Generate voice audio from podcast script using Gemini TTS API. Supports smart segmentation (LLM-based), 30-voice selection, AI-powered audio tag injection, and batch/single/stream output modes.',
    inputSchema: {
        type: 'object',
        properties: {
            script:   { type: 'string', description: 'Full podcast script text to convert to speech' },
            title:    { type: 'string', description: 'Episode title (provides context for planner segmentation)' },
            voice:    { type: 'string', description: `Voice name override. One of: ${VOICE_NAMES.join(', ')}. Default: "auto" (smart selection by content tone)`, default: 'auto' },
            api_mode: { type: 'string', enum: ['interactions', 'live'], description: 'API mode: "interactions" (REST, default) uses gemini-*-tts-preview models; "live" (WebSocket) uses gemini-live-*-preview models with native audio', default: 'interactions' },
            live_model: { type: 'string', enum: LIVE_MODEL_NAMES, description: `Live API model to use. Only applies when api_mode="live". Default: "${LIVE_MODEL_NAMES[0]}" (smart chain fallback)`, default: undefined },
            mode:     { type: 'string', enum: ['batch', 'single', 'stream'], description: 'Output mode: batch (array of segment-audio pairs), single (concatenated audio), stream (ordered segments, each with audio)', default: 'batch' },
            language: { type: 'string', description: 'Language code: "vi", "en", or "auto" detect', default: 'auto' },
            pace:     { type: 'string', enum: ['slow', 'normal', 'fast'], description: 'Speech pace', default: 'normal' },
            tags:     { type: 'string', description: 'Comma-separated audio tags for expressiveness (e.g. "determination,positive,whispers")' },
            style_prompt: { type: 'string', description: 'Optional style/tone guidance for audio tag injection. E.g. "slow, philosophical tone for deep segments, energetic for storytelling parts"' },
            tag_backend: { type: 'string', enum: ['google-api', 'gemini-web'], description: 'AI backend for audio tag injection: "google-api" (Gemini REST API, requires API key) or "gemini-web" (Puppeteer + gemini.google.com, requires Chrome running)', default: undefined },
            segments:     { type: 'array', description: 'Pre-tagged segments from inject_tts_tags. If provided, overrides script-based auto-segmentation; tag_backend is ignored.' },
            segment_delay: { type: 'number', description: 'Delay in milliseconds between segment generations (default: 5000). Helps avoid rate limiting', default: undefined },
        },
        required: [],
    },
};

async function generateTTSHandler(llm, args) {
    const { script, title, segments: preTaggedSegments, voice = 'auto', api_mode = 'interactions', live_model, mode = 'batch', language = 'auto', pace = 'normal', tags = '', style_prompt, tag_backend, segment_delay } = args;

    // Input validation: need either script+title OR pre-tagged segments
    const hasPreTagged = preTaggedSegments && Array.isArray(preTaggedSegments) && preTaggedSegments.length > 0;
    if (!hasPreTagged) {
        if (!script || typeof script !== 'string' || script.trim().length === 0) {
            throw new Error('generate_tts: "script" must be a non-empty string (or provide "segments")');
        }
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            throw new Error('generate_tts: "title" must be a non-empty string (or provide "segments")');
        }
    }

    const audioTags = tags
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    const genAI = module.exports._pluginConfig?.apiKey
        ? new GoogleGenAI({ apiKey: module.exports._pluginConfig.apiKey })
        : null;
    const planner = new TTSPlanner({ llm, genai: genAI });

    // 1. Plan: segment the script or use pre-tagged segments
    let plan;
    if (hasPreTagged) {
        plan = {
            segments: preTaggedSegments.map(s => ({
                ...s,
                voice: s.voice || (voice !== 'auto' ? voice : s.voice || 'auto'),
            })),
            metadata: { totalEstimatedDuration: 0, voiceCount: 0, languages: ['auto'] },
        };
    } else {
        plan = await planner.plan(script, title, { voice, language, pace });
    }

    // 2. Apply user's audio tags + resolve voice = "auto" to a real voice
    let resolvedSegments = plan.segments.map(s => {
        const mergedTags = audioTags.length > 0
            ? [...new Set([...(s.audioTags || []), ...audioTags])]
            : s.audioTags;

        let resolvedVoice = s.voice;
        if (resolvedVoice === 'auto' || !resolvedVoice) {
            resolvedVoice = voice !== 'auto' ? voice : pickVoiceForTone('informative');
        }

        return {
            ...s,
            audioTags: mergedTags,
            voice: resolvedVoice,
        };
    });

    // 2.5. Inject audio tags via AI reasoning model (skip if pre-tagged segments provided)
    if (tag_backend && !hasPreTagged) {
        try {
            const tagged = await planner.injectTags(resolvedSegments, script, {
                backend: tag_backend,
                stylePrompt: style_prompt || '',
            });
            // Merge injected tags back — preserve voice override from step 2
            const taggedMap = new Map(tagged.map(s => [s.id, s]));
            resolvedSegments = resolvedSegments.map(s => {
                const t = taggedMap.get(s.id);
                if (!t) return s;
                return {
                    ...t,
                    voice: s.voice,  // Preserve voice override from step 2
                };
            });
        } catch (err) {
            console.warn(`generate_tts: tag injection failed (${err.message}), continuing without tags`);
        }
    }

    // 3. Generate: choose API mode
    let audioResults;

    if (api_mode === 'live') {
        // Live API (WebSocket) with native audio models
        const cfg = module.exports._pluginConfig || {};
        const liveOpts = {};
        if (live_model) {
            liveOpts.models = [live_model];
        }
        const gen = new LiveTTSGenerator({
            apiKey: cfg.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
            live: liveOpts,
        });
        audioResults = await gen.generateBatch(resolvedSegments, { segmentDelay: segment_delay });
    } else {
        // Interactions API (REST) with TTS models (default)
        const cfg = module.exports._pluginConfig || {};
        const gen = new TTSGenerator({
            apiKey: cfg.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
            tts: {
                model: 'gemini-3.1-flash-tts-preview',
                fallback: 'gemini-2.5-flash-preview-tts',
            },
        });
        audioResults = await gen.generateBatch(resolvedSegments, { segmentDelay: segment_delay });
    }

    // 4. Format output
    const formatter = new OutputFormatter();
    const successful = audioResults.filter(r => !r.error);
    const successfulSegments = resolvedSegments.filter(s =>
        !audioResults.find(r => r.error && r.id === s.id)
    );

    if (mode === 'single') {
        const buffers = successful.map(r => r.audio);
        const combined = formatter.formatSingle(buffers);
        return {
            audio: combined.toString('base64'),
            format: successful[0]?.format || 'wav',
            segments: audioResults,
        };
    }

    // Stream mode: returns ordered segments (true streaming over SSE not available via MCP).
    // Each segment is fully generated before the next starts, and the response includes
    // position metadata for reconstructing the full audio.
    if (mode === 'stream') {
        const batch = formatter.formatBatch(
            successfulSegments,
            successful.map(r => r.audio),
        );
        return {
            segments: batch.segments.map((s, i) => ({
                ...s,
                position: i + 1,
                total: batch.segments.length,
                audio: s.audio.toString('base64'),
            })),
            mode: 'stream',
            metadata: plan.metadata,
        };
    }

    // mode === 'batch' (default)
    const batch = formatter.formatBatch(
        successfulSegments,
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

// ---------------------------------------------------------------------------
// inject_tts_tags
// ---------------------------------------------------------------------------
const injectTTSTagsDef = {
    name: 'inject_tts_tags',
    description: 'Analyze and enhance a podcast script with AI-generated audio tags for TTS expressiveness. Returns both a tagged script string (with [tag] markers) and structured tagged segments — preview and/or edit before generating audio.',
    inputSchema: {
        type: 'object',
        properties: {
            script:       { type: 'string', description: 'Full podcast script to analyze and tag. If provided without segments, auto-segments via LLM.' },
            segments:     { type: 'array', description: 'Pre-segmented array from plan(). Overrides script-based auto-segmentation. Items: {id, text, title, voice, pace, audioTags, language, estimatedDuration}.' },
            title:        { type: 'string', description: 'Episode title (required if script is provided for auto-segmentation)' },
            style_prompt: { type: 'string', description: 'Optional style/tone guidance for tag injection' },
            tag_backend:  { type: 'string', enum: ['google-api', 'gemini-web'], description: 'AI backend for tag injection', default: 'google-api' },
            model:        { type: 'string', description: 'Gemini model override (e.g. "gemini-3.1-flash-lite")' },
        },
        required: [],
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
// inject_tts_tags handler
// ---------------------------------------------------------------------------
async function injectTTSTagsHandler(llm, args) {
    const { script, segments, title, style_prompt, tag_backend = 'google-api', model } = args;

    // Validate: need at least script or segments
    if (!script && (!segments || !Array.isArray(segments) || segments.length === 0)) {
        throw new Error('inject_tts_tags: either "script" or "segments" must be provided');
    }
    if (script && !title) {
        throw new Error('inject_tts_tags: "title" is required when "script" is provided');
    }

    // Build input for planner
    const input = segments || script;
    const effectiveTitle = title || '';

    // Create planner (genai null — planner will create default from env)
    const planner = new TTSPlanner({ llm, genai: null });

    const result = await planner.injectTagsToScript(input, effectiveTitle, {
        backend: tag_backend,
        stylePrompt: style_prompt || '',
        model,
    });

    return {
        tagged_script: result.tagged_script,
        tagged_segments: result.tagged_segments,
        metadata: result.metadata,
    };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function (config = {}) {
    // Store config for use in handlers (MCP server passes { apiKey, provider })
    // Handlers below reference the module-level _pluginConfig set here.
    // This is a module-level cache — each instantiation of the MCP server
    // creates a fresh plugin context.
    module.exports._pluginConfig = config;
    return [
        { definition: generateTTSDef, handler: generateTTSHandler },
        { definition: injectTTSTagsDef, handler: injectTTSTagsHandler },
        { definition: listTTSVoicesDef, handler: listTTSVoicesHandler },
    ];
};
