# inject_tts_tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a separate `inject_tts_tags` tool and TTSPlanner method that returns tagged script + segments for preview/editing before audio generation, and allow `generate_tts` to accept pre-tagged segments.

**Architecture:** Lightweight extension to existing `TTSPlanner` class — new `injectTagsToScript()` method chains `plan()` → `injectTags()` → tagged script reconstruction. New MCP tool wraps it. `generate_tts` gets a new `segments` param to accept pre-tagged segments.

**Tech Stack:** Node.js (CommonJS), `@google/genai` SDK, TTSPlanner (existing)

## Global Constraints

- CommonJS (`require` / `module.exports`) — no ESM
- All packages are under `packages/tts-generator/`
- Follow existing patterns in `planner.js` and `mcp-tools.js`
- No new npm dependencies
- Tests with Node.js built-in test runner (`node:test` / `node:assert`)

---

### Task 1: Add `injectTagsToScript()` to TTSPlanner

**Files:**
- Modify: `packages/tts-generator/lib/planner.js` (after `injectTags()` at line 241)

**Interfaces:**
- Consumes: `TTSPlanner.plan(script, title, options)`, `TTSPlanner.injectTags(segments, originalScript, options)`
- Produces: `TTSPlanner.injectTagsToScript(scriptOrSegments, title, options)` → `{ tagged_script, tagged_segments, metadata }`

- [ ] **Step 1: Write the failing test**

Create `packages/tts-generator/lib/planner.test.js` (or append to existing if found):

```javascript
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const TTSPlanner = require('./planner');

describe('TTSPlanner.injectTagsToScript', () => {
  it('should reject empty input', async () => {
    const planner = new TTSPlanner({ llm: null });
    await assert.rejects(
      () => planner.injectTagsToScript('', 'Test'),
      /scriptOrSegments must be a non-empty string or array/
    );
  });

  it('should reject non-string non-array input', async () => {
    const planner = new TTSPlanner({ llm: null });
    await assert.rejects(
      () => planner.injectTagsToScript(123, 'Test'),
      /scriptOrSegments must be a non-empty string or array/
    );
  });

  it('should reconstruct tagged_script from segments with tags', () => {
    const planner = new TTSPlanner({ llm: null });
    const segments = [
      { id: 1, text: '[slow][philosophical] Hello world', audioTags: ['slow', 'philosophical'] },
      { id: 2, text: '[fast][excited] Second part', audioTags: ['fast', 'excited'] },
    ];
    const result = planner._reconstructTaggedScript(segments);
    assert.equal(result, '[slow][philosophical] Hello world\n\n[fast][excited] Second part');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test packages/tts-generator/lib/planner.test.js
```
Expected: FAIL — `injectTagsToScript` not defined, `_reconstructTaggedScript` not defined

- [ ] **Step 3: Write the implementation**

Add the following methods to `TTSPlanner` class in `planner.js`, right after `injectTags()` method (after line 241):

```javascript
    /**
     * Inject tags into a script (or pre-segmented segments) and return
     * both a human-readable tagged script string and structured tagged segments.
     *
     * @param {string|Array} scriptOrSegments - Full script text OR array of segments from plan()
     * @param {string} title - Episode title (required if auto-segmenting a string)
     * @param {Object} [options]
     * @param {string} [options.backend='google-api'] - Tag injection backend
     * @param {string} [options.stylePrompt=''] - Style/tone guidance
     * @param {string} [options.model] - Gemini model override
     * @param {AbortSignal} [options.signal] - Cancellation signal
     * @param {string} [options.voice='auto'] - Voice override for plan()
     * @param {string} [options.language='auto'] - Language override for plan()
     * @param {string} [options.pace='normal'] - Pace override for plan()
     * @returns {Promise<{tagged_script: string, tagged_segments: Array, metadata: Object}>}
     */
    async injectTagsToScript(scriptOrSegments, title, options = {}) {
        // Validate input
        if (typeof scriptOrSegments === 'string') {
            if (!scriptOrSegments.trim()) {
                throw new Error('TTSPlanner.injectTagsToScript: scriptOrSegments must be a non-empty string or array');
            }
        } else if (Array.isArray(scriptOrSegments)) {
            if (scriptOrSegments.length === 0) {
                throw new Error('TTSPlanner.injectTagsToScript: scriptOrSegments must be a non-empty string or array');
            }
        } else {
            throw new Error('TTSPlanner.injectTagsToScript: scriptOrSegments must be a non-empty string or array');
        }

        const { backend = 'google-api', stylePrompt = '', model, signal, voice, language, pace } = options;
        const originalScript = typeof scriptOrSegments === 'string' ? scriptOrSegments : (options.originalScript || '');

        // Step 1: Auto-segment if given a string
        let segments, metadata;
        if (typeof scriptOrSegments === 'string') {
            const planResult = await this.plan(scriptOrSegments, title, { voice, language, pace });
            segments = planResult.segments;
            metadata = planResult.metadata;
        } else {
            segments = scriptOrSegments;
            metadata = {};
        }

        // Step 2: Inject tags
        const enhanced = await this.injectTags(segments, originalScript, {
            backend,
            stylePrompt,
            model,
            signal,
        });

        // Step 3: Reconstruct tagged script string
        const taggedScript = this._reconstructTaggedScript(enhanced);

        return {
            tagged_script: taggedScript,
            tagged_segments: enhanced,
            metadata,
        };
    }

    /**
     * Reconstruct a full tagged script string from enhanced segments.
     * Each segment's text (with [tag] markers) joined by double newlines.
     * @private
     */
    _reconstructTaggedScript(enhancedSegments) {
        return enhancedSegments
            .map(s => s.text || '')
            .filter(Boolean)
            .join('\n\n');
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test packages/tts-generator/lib/planner.test.js
```
Expected: PASS (3 tests)

- [ ] **Step 5: Verify syntax**

```bash
node -c packages/tts-generator/lib/planner.js
```
Expected: syntax OK (exit 0)

---

### Task 2: Add `inject_tts_tags` MCP tool + update `generate_tts`

**Files:**
- Modify: `packages/tts-generator/mcp-tools.js`

**Interfaces:**
- Consumes: `TTSPlanner.injectTagsToScript()` from Task 1
- Produces: MCP tool `inject_tts_tags` + updated `generate_tts` with `segments` param

- [ ] **Step 1: Read current mcp-tools.js to confirm base state**

```bash
node -c packages/tts-generator/mcp-tools.js
```

- [ ] **Step 2: Add `inject_tts_tags` tool definition**

After `generateTTSDef` (around line 12), add:

```javascript
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
```

- [ ] **Step 3: Add `inject_tts_tags` handler**

Before the `module.exports` line at the end, add:

```javascript
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

    // Create planner
    const genAI = module.exports._pluginConfig?.apiKey
        ? new GoogleGenAI({ apiKey: module.exports._pluginConfig.apiKey })
        : null;
    const planner = new TTSPlanner({ llm, genai: genAI });

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
```

- [ ] **Step 4: Update `generateTTSDef` — add `segments` param**

In `generateTTSDef.inputSchema.properties`, add `segments` before the closing brace:

```javascript
            segments:    { type: 'array', description: 'Pre-tagged segments from inject_tts_tags. If provided, overrides script-based auto-segmentation and tag_backend is ignored.' },
```

- [ ] **Step 5: Update `generateTTSHandler` — accept pre-tagged segments**

In `generateTTSHandler`, replace the section that calls `planner.plan()` with logic that checks for pre-tagged segments:

Find this block (around lines 55-60):
```javascript
    // 1. Plan: segment the script using the MCP runtime LLM
    const genAI = module.exports._pluginConfig?.apiKey
        ? new GoogleGenAI({ apiKey: module.exports._pluginConfig.apiKey })
        : null;
    const planner = new TTSPlanner({ llm, genai: genAI });
    const plan = await planner.plan(script, title, { voice, language, pace });
```

Replace with:
```javascript
    // 1. Plan: segment the script or use pre-tagged segments
    const genAI = module.exports._pluginConfig?.apiKey
        ? new GoogleGenAI({ apiKey: module.exports._pluginConfig.apiKey })
        : null;
    const planner = new TTSPlanner({ llm, genai: genAI });

    let plan;
    if (args.segments && Array.isArray(args.segments) && args.segments.length > 0) {
        // Use pre-tagged segments directly — skip plan() and tag injection
        plan = {
            segments: args.segments.map(s => ({
                ...s,
                voice: s.voice || (voice !== 'auto' ? voice : s.voice || 'auto'),
            })),
            metadata: { totalEstimatedDuration: 0, voiceCount: 0, languages: ['auto'] },
        };
    } else {
        plan = await planner.plan(script, title, { voice, language, pace });
    }
```

Also update the `tag_backend` check below it. Currently it's:
```javascript
    // 2.5. Inject audio tags via AI reasoning model
    if (tag_backend) {
```

This stays as-is — the `if (tag_backend)` guard already means it only runs when explicitly provided. The only change needed is: if `args.segments` is provided, we should also skip tag_backend injection (since segments are already tagged). Update the condition:

```javascript
    // 2.5. Inject audio tags via AI reasoning model (skip if pre-tagged segments provided)
    if (tag_backend && !args.segments) {
```

- [ ] **Step 6: Register the new tool in the exports**

Find the `module.exports` function at the end of mcp-tools.js (around line 225):

```javascript
module.exports = function (config = {}) {
    module.exports._pluginConfig = config;
    return [
        { definition: generateTTSDef, handler: generateTTSHandler },
        { definition: listTTSVoicesDef, handler: listTTSVoicesHandler },
    ];
};
```

Add the new tool to the returned array:
```javascript
module.exports = function (config = {}) {
    module.exports._pluginConfig = config;
    return [
        { definition: generateTTSDef, handler: generateTTSHandler },
        { definition: injectTTSTagsDef, handler: injectTTSTagsHandler },
        { definition: listTTSVoicesDef, handler: listTTSVoicesHandler },
    ];
};
```

- [ ] **Step 7: Verify syntax**

```bash
node -c packages/tts-generator/mcp-tools.js
```
Expected: syntax OK (exit 0)

- [ ] **Step 8: Run unit tests**

```bash
node --test packages/tts-generator/lib/planner.test.js
```
Expected: PASS (all tests)

---

### Task 3: Manual integration test

- [ ] **Step 1: Run the MCP tool via the existing test infrastructure**

```bash
node -e "
const { TTSPlanner } = require('./packages/tts-generator/lib');
const planner = new TTSPlanner({ llm: null });

// Test with pre-segmented array
const segments = [
  { id: 1, text: 'Hello world, this is a test.', title: 'Intro', voice: 'auto', pace: 'normal', audioTags: [], language: 'en', estimatedDuration: 5 },
  { id: 2, text: 'This is the second segment for the podcast.', title: 'Body', voice: 'auto', pace: 'slow', audioTags: [], language: 'en', estimatedDuration: 8 },
];

planner.injectTagsToScript(segments, 'Test Episode', { backend: 'google-api' })
  .then(r => {
    console.log('tagged_script:', JSON.stringify(r.tagged_script.substring(0, 200)));
    console.log('tagged_segments:', r.tagged_segments.length);
    console.log('first segment tags:', r.tagged_segments[0]?.audioTags);
    console.log('PASS: injectTagsToScript works with pre-segmented input');
  })
  .catch(err => {
    // Expected if no API key — the planner will try _createDefaultGenAI
    // but the point is to verify the method exists and calls through
    console.log('Expected error (no API key):', err.message);
  });
"
```
Expected: Method runs without crashing; either returns tagged segments or throws a clear API-key error.

- [ ] **Step 2: Verify backward compatibility**

Check that existing `generate_tts` calls without `segments` param still work:
- `script` + `title` → plan() + generate → works (no change in behavior)
- `script` + `title` + `tag_backend` → plan() + injectTags() + generate → works (no change)
