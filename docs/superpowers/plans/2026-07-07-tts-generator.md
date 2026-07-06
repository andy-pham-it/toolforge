# @andy-toolforge/tts-generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `@andy-toolforge/tts-generator` package — a TTS plugin for script-to-audio generation with smart segmentation (LLM-based planner) and Gemini TTS API integration, exposed as an MCP tool.

**Architecture:** Two-layer: TTSPlanner (configurable LLM for script segmentation) → TTSGenerator (Gemini Interactions API for audio) → OutputFormatter (batch/single/stream). Follows existing `packages/footage-generation/` patterns exactly.

**Tech Stack:** Node.js CJS, `@andy-toolforge/core` (LLMClient), raw `fetch` for Gemini TTS API, `node --test` for testing.

## Global Constraints

- CommonJS (`require()` / `module.exports`) — no ESM
- Use `@andy-toolforge/core` for LLMClient (planner) and Logger
- No other runtime dependencies — raw `fetch` for TTS API calls
- All package metadata in `package.json` — `@andy-toolforge/tts-generator` scope
- Test with `node --test` — use `mock` from `node:test`
- Follow `packages/footage-generation/` patterns: `lib/` classes, `mcp-tools.js` thin wrapper, `skills/` with `postinstall.js`

---

## File Structure

```
packages/tts-generator/
  package.json              ← Package manifest (TASK 1)
  mcp-tools.js              ← MCP plugin: generate_tts + list_tts_voices (TASK 5)
  lib/
    index.js                ← Exports { TTSPlanner, TTSGenerator, OutputFormatter, VOICES } (TASK 1)
    voices.js               ← 30 voice definitions + metadata (TASK 1)
    planner.js              ← TTSPlanner class (TASK 2)
    planner.test.js         ← TTSPlanner tests (TASK 2)
    generator.js            ← TTSGenerator class (Interactions API) (TASK 3)
    generator.test.js       ← TTSGenerator tests (TASK 3)
    output.js               ← OutputFormatter (TASK 4)
    output.test.js          ← OutputFormatter tests (TASK 4)
  skills/
    postinstall.js          ← Symlinks skill .md files → .opencode/skills/ (TASK 5)
    tts-generator-workflow.md    ← Workflow skill (TASK 5)
    tts-voice-selection.md       ← Voice selection guide (TASK 5)
```

---

### Task 1: Package scaffold + voices data

**Files:**
- Create: `packages/tts-generator/package.json`
- Create: `packages/tts-generator/lib/voices.js`
- Create: `packages/tts-generator/lib/index.js`

**Interfaces:**
- Produces: `{ VOICES }` from `lib/voices.js`
- Produces: `{ TTSPlanner, TTSGenerator, OutputFormatter, VOICES }` from `lib/index.js` (classes exported as stubs from empty files for now — they'll be filled in Tasks 2-4)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@andy-toolforge/tts-generator",
  "version": "1.0.0",
  "description": "Toolforge domain: text-to-speech generation with Gemini TTS API — script segmentation, multi-voice, batch/stream output",
  "main": "lib/index.js",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/andy-pham-it/toolforge.git"
  },
  "scripts": {
    "postinstall": "node skills/postinstall.js",
    "test": "node --test lib/*.test.js"
  },
  "dependencies": {
    "@andy-toolforge/core": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create lib/voices.js**

```js
'use strict';

const VOICES = {
    Zephyr:          { style: 'Bright',       gender: 'neutral', description: 'Energetic, positive delivery' },
    Puck:            { style: 'Upbeat',        gender: 'neutral', description: 'Lively, cheerful tone' },
    Charon:          { style: 'Informative',   gender: 'neutral', description: 'Educational, calm narration' },
    Kore:            { style: 'Firm',          gender: 'neutral', description: 'Assertive, authoritative' },
    Fenrir:          { style: 'Excitable',     gender: 'neutral', description: 'Enthusiastic, passionate' },
    Leda:            { style: 'Youthful',      gender: 'neutral', description: 'Young, fresh perspective' },
    Orus:            { style: 'Firm',          gender: 'neutral', description: 'Steady, grounded presence' },
    Aoede:           { style: 'Breezy',        gender: 'neutral', description: 'Light, airy delivery' },
    Callirrhoe:      { style: 'Easy-going',    gender: 'neutral', description: 'Relaxed, effortless' },
    Autonoe:         { style: 'Bright',        gender: 'neutral', description: 'Radiant, warm tone' },
    Enceladus:       { style: 'Breathy',       gender: 'neutral', description: 'Intimate, hushed quality' },
    Iapetus:         { style: 'Clear',         gender: 'neutral', description: 'Precise, articulate' },
    Umbriel:         { style: 'Easy-going',    gender: 'neutral', description: 'Casual, conversational' },
    Algieba:         { style: 'Smooth',        gender: 'neutral', description: 'Fluid, seamless flow' },
    Despina:         { style: 'Smooth',        gender: 'neutral', description: 'Silky, polished delivery' },
    Erinome:         { style: 'Clear',         gender: 'neutral', description: 'Crisp, well-articulated' },
    Algenib:         { style: 'Gravelly',      gender: 'neutral', description: 'Rich, textured voice' },
    Rasalgethi:      { style: 'Informative',   gender: 'neutral', description: 'Detailed, thorough explanation' },
    Laomedeia:       { style: 'Upbeat',        gender: 'neutral', description: 'Bouncy, optimistic energy' },
    Achernar:        { style: 'Soft',          gender: 'neutral', description: 'Gentle, soothing tone' },
    Alnilam:         { style: 'Firm',          gender: 'neutral', description: 'Strong, commanding presence' },
    Schedar:         { style: 'Even',          gender: 'neutral', description: 'Balanced, measured delivery' },
    Gacrux:          { style: 'Mature',        gender: 'neutral', description: 'Seasoned, experienced tone' },
    Pulcherrima:     { style: 'Forward',       gender: 'neutral', description: 'Direct, engaging presence' },
    Achird:          { style: 'Friendly',      gender: 'neutral', description: 'Warm, approachable tone' },
    Zubenelgenubi:   { style: 'Casual',        gender: 'neutral', description: 'Informal, relaxed chat' },
    Vindemiatrix:    { style: 'Gentle',        gender: 'neutral', description: 'Soft-spoken, caring delivery' },
    Sadachbia:       { style: 'Lively',        gender: 'neutral', description: 'Vibrant, animated tone' },
    Sadaltager:      { style: 'Knowledgeable', gender: 'neutral', description: 'Wise, informed perspective' },
    Sulafat:         { style: 'Warm',          gender: 'neutral', description: 'Cozy, comforting delivery' },
};

const VOICE_NAMES = Object.keys(VOICES);

const STYLE_DESCRIPTIONS = {
    Bright:       'Energetic and positive — good for optimistic content',
    Upbeat:       'Lively and cheerful — great for introductions',
    Informative:  'Clear and educational — ideal for explanations',
    Firm:         'Assertive and authoritative — use for strong opinions',
    Excitable:    'Enthusiastic and passionate — for exciting reveals',
    Youthful:     'Fresh and young — for modern, relatable content',
    Breezy:       'Light and airy — philosophical, contemplative segments',
    EasyGoing:    'Relaxed and casual — conversational tone',
    Breathy:      'Intimate and hushed — personal stories, emotional moments',
    Clear:        'Precise and articulate — technical explanations',
    Smooth:       'Fluid and polished — narrative flow',
    Gravelly:     'Rich and textured — dramatic narration',
    Soft:         'Gentle and soothing — calm, meditative sections',
    Mature:       'Seasoned and experienced — wisdom-sharing content',
    Forward:      'Direct and engaging — calls to action',
    Friendly:     'Warm and approachable — audience connection',
    Casual:       'Informal and relaxed — everyday conversation',
    Gentle:       'Soft-spoken and caring — sensitive topics',
    Lively:       'Vibrant and animated — entertainment content',
    Knowledgeable:'Wise and informed — expert commentary',
    Even:         'Balanced and measured — neutral narration',
    Warm:         'Cozy and comforting — closing segments',
};

module.exports = { VOICES, VOICE_NAMES, STYLE_DESCRIPTIONS };
```

- [ ] **Step 3: Create lib/index.js (stub exports — real classes implemented in Tasks 2-4)**

```js
'use strict';

const { VOICES, VOICE_NAMES, STYLE_DESCRIPTIONS } = require('./voices');
const TTSPlanner = require('./planner');
const TTSGenerator = require('./generator');
const OutputFormatter = require('./output');

module.exports = {
    TTSPlanner,
    TTSGenerator,
    OutputFormatter,
    VOICES,
    VOICE_NAMES,
    STYLE_DESCRIPTIONS,
};
```

- [ ] **Step 4: Verify scaffolding**

Create the empty stub files for planner.js, generator.js, output.js so the index.js require works:

```bash
touch packages/tts-generator/lib/planner.js
touch packages/tts-generator/lib/generator.js
touch packages/tts-generator/lib/output.js
```

Each stub should export a class:

```js
'use strict';
class TTSPlanner {}
module.exports = TTSPlanner;
```

(Same pattern for generator.js and output.js with their respective class names.)

- [ ] **Step 5: Verify package works**

```bash
npm install  # install workspace deps
node -e "require('@andy-toolforge/tts-generator')"
```

Expected: no error (exports empty classes).

- [ ] **Step 6: Commit**

```bash
git add packages/tts-generator/
git commit -m "feat(tts-generator): scaffold package with voices data"
```

---

### Task 2: TTSPlanner — smart segmentation

**Files:**
- Create: `packages/tts-generator/lib/planner.js`
- Create: `packages/tts-generator/lib/planner.test.js`

**Interfaces:**
- Consumes: `LLMClient` from `@andy-toolforge/core` for LLM-based planning
- Produces: `class TTSPlanner` with `constructor(config)` and `async plan(script, title, options?) → Promise<SegmentPlan>`

**SegmentPlan type:**
```js
{
  segments: [
    {
      id: number,
      text: string,
      title: string,
      voice: string,     // voice name or "auto"
      pace: 'slow' | 'normal' | 'fast',
      audioTags: string[],
      language: string,   // "vi" | "en" | "auto"
      estimatedDuration: number, // seconds
    }
  ],
  metadata: {
    totalEstimatedDuration: number,
    voiceCount: number,
    languages: string[],
  }
}
```

- [ ] **Step 1: Write the failing test — planner.test.js**

```js
'use strict';
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const TTSPlanner = require('./planner');

const SAMPLE_SCRIPT = `Xin chào các bạn, hôm nay chúng ta sẽ nói về trí tuệ nhân tạo.

AI đang thay đổi cách chúng ta làm việc và sống. Nó ảnh hưởng đến mọi ngành công nghiệp.

Trong lĩnh vực y tế, AI giúp chẩn đoán bệnh nhanh hơn và chính xác hơn.

Còn trong giáo dục, AI cá nhân hóa trải nghiệm học tập cho từng học sinh.

Cảm ơn các bạn đã lắng nghe. Hẹn gặp lại ở tập sau.`;

describe('TTSPlanner', () => {
    describe('plan() — LLM mode', () => {
        it('should call LLM and parse SegmentPlan from JSON response', async () => {
            const mockLlm = {
                chat: mock.fn(async () => JSON.stringify({
                    segments: [
                        {
                            id: 1,
                            text: 'Xin chào các bạn, hôm nay chúng ta sẽ nói về trí tuệ nhân tạo.',
                            title: 'Giới thiệu',
                            voice: 'Charon',
                            pace: 'normal',
                            audioTags: ['neutral'],
                            language: 'vi',
                            estimatedDuration: 10,
                        },
                        {
                            id: 2,
                            text: 'AI đang thay đổi cách chúng ta làm việc và sống.',
                            title: 'Tác động của AI',
                            voice: 'Kore',
                            pace: 'normal',
                            audioTags: ['determination'],
                            language: 'vi',
                            estimatedDuration: 8,
                        },
                    ],
                    metadata: {
                        totalEstimatedDuration: 18,
                        voiceCount: 2,
                        languages: ['vi'],
                    },
                })),
            };

            const planner = new TTSPlanner({ llm: mockLlm });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'AI và Tương Lai');

            assert.ok(plan, 'plan should be returned');
            assert.ok(Array.isArray(plan.segments), 'plan.segments should be an array');
            assert.equal(plan.segments.length, 2, 'should have 2 segments');
            assert.equal(plan.segments[0].title, 'Giới thiệu');
            assert.equal(plan.segments[1].voice, 'Kore');
            assert.equal(plan.metadata.totalEstimatedDuration, 18);
        });

        it('should throw if LLM returns non-JSON', async () => {
            const mockLlm = {
                chat: mock.fn(async () => 'not json at all'),
            };
            const planner = new TTSPlanner({ llm: mockLlm });
            await assert.rejects(
                () => planner.plan(SAMPLE_SCRIPT, 'Test'),
                { message: /failed to parse/i },
            );
        });

        it('should retry once on invalid JSON, then throw', async () => {
            let callCount = 0;
            const mockLlm = {
                chat: mock.fn(async () => {
                    callCount++;
                    return 'still not json';
                }),
            };
            const planner = new TTSPlanner({ llm: mockLlm, maxRetries: 1 });
            await assert.rejects(() => planner.plan(SAMPLE_SCRIPT, 'Test'));
            assert.equal(callCount, 2, 'should retry once');
        });
    });

    describe('plan() — regex fallback', () => {
        it('should split by double-newlines when LLM is null', async () => {
            const planner = new TTSPlanner({ llm: null });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'Fallback Test');

            assert.ok(plan, 'plan should be returned');
            // Sample has 5 paragraphs separated by blank lines
            assert.ok(plan.segments.length >= 4, `should split into paragraphs, got ${plan.segments.length}`);
            assert.ok(plan.segments.every(s => s.voice === 'auto'), 'all segments should have auto voice');
            assert.ok(plan.segments.every(s => s.pace === 'normal'), 'all segments should have normal pace');
            assert.ok(Array.isArray(plan.metadata.languages), 'metadata.languages should be an array');
        });

        it('should split by double-newlines when LLM throws', async () => {
            const mockLlm = {
                chat: mock.fn(async () => { throw new Error('API down'); }),
            };
            const planner = new TTSPlanner({ llm: mockLlm });
            const plan = await planner.plan(SAMPLE_SCRIPT, 'Fallback Test');

            assert.ok(plan, 'plan should be returned');
            assert.ok(plan.segments.length >= 4, 'should fallback to paragraph split');
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: FAIL — `planner.js` exports empty class, no `plan` method.

- [ ] **Step 3: Write planner.js — TTSPlanner class**

```js
'use strict';

const { LLMClient } = require('@andy-toolforge/core');

const PLANNER_SYSTEM_PROMPT = `You are a script segmentation expert for podcast production. Analyze the given script and split it into logical segments for text-to-speech generation.

Rules:
- Split at natural boundaries: topic shifts, paragraph transitions, logical sections
- Each segment should be 30-120 seconds when spoken (roughly 70-280 words)
- Assign an appropriate voice from: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat
- If unsure which voice, set voice to "auto"
- Add audio tags for expressiveness from: determination, enthusiasm, adoration, interest, awe, admiration, nervousness, frustration, excitement, curiosity, hope, annoyance, amusement, aggression, tension, agitation, confusion, anger, positive, neutral, negative, whispers, laughs
- Language is detected from text: "vi" for Vietnamese, "en" for English, "auto" if mixed
- Pace: "slow" for complex/philosophical content, "normal" for narrative, "fast" for exciting parts

Return ONLY valid JSON with this exact structure:
{
  "segments": [
    {
      "id": number,
      "text": "exact segment text",
      "title": "short descriptive title",
      "voice": "voice name or auto",
      "pace": "slow|normal|fast",
      "audioTags": ["tag1", "tag2"],
      "language": "vi|en|auto",
      "estimatedDuration": seconds
    }
  ],
  "metadata": {
    "totalEstimatedDuration": total_seconds,
    "voiceCount": number_of_unique_voices,
    "languages": ["vi", "en"]
  }
}`;

class TTSPlanner {
    /**
     * @param {Object} config
     * @param {Object} [config.llm] - An LLMClient-compatible instance with chat() method
     * @param {number} [config.maxRetries=1] - Max retries on invalid JSON
     */
    constructor(config = {}) {
        this.llm = config.llm;
        this.maxRetries = config.maxRetries ?? 1;
    }

    /**
     * Analyze a script and produce a SegmentPlan.
     * Falls back to regex paragraph splitting if LLM is unavailable or fails.
     *
     * @param {string} script - Full script text
     * @param {string} title - Episode title
     * @param {Object} [options]
     * @param {string} [options.voice] - Override voice for all segments ("auto")
     * @returns {Promise<{segments: Array, metadata: Object}>}
     */
    async plan(script, title, options = {}) {
        // Try LLM first
        if (this.llm && typeof this.llm.chat === 'function') {
            try {
                return await this._planWithLLM(script, title, options);
            } catch (err) {
                console.warn(`TTSPlanner: LLM failed (${err.message}), falling back to regex split`);
            }
        }

        // Fallback: regex paragraph splitting
        return this._planWithFallback(script, title, options);
    }

    async _planWithLLM(script, title, options) {
        const userPrompt = [
            `Episode title: ${title}`,
            options.voice ? `Voice override: ${options.voice}` : '',
            options.language ? `Language: ${options.language}` : '',
            options.pace ? `Pace: ${options.pace}` : '',
            '',
            `Script:`,
            script,
        ].filter(Boolean).join('\n');

        let lastError;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const raw = await this.llm.chat(PLANNER_SYSTEM_PROMPT, userPrompt, true);
                const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed.segments || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
                    throw new Error('LLM returned empty segments array');
                }

                return parsed;
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    console.warn(`TTSPlanner: retry ${attempt + 1}/${this.maxRetries} after invalid response`);
                }
            }
        }

        throw new Error(`TTSPlanner: failed to parse LLM response after ${this.maxRetries + 1} attempts — ${lastError.message}`);
    }

    _planWithFallback(script, title, options) {
        // Split by blank lines (double newline or more)
        const paragraphs = script
            .split(/\n\s*\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (paragraphs.length === 0) {
            // Single block — treat as one segment
            paragraphs.push(script.trim());
        }

        const segments = paragraphs.map((text, i) => {
            // Rough estimate: ~150 words per minute, ~3 chars/word for Vietnamese
            const wordCount = text.split(/\s+/).length;
            const estimatedDuration = Math.max(5, Math.round(wordCount / 3));

            return {
                id: i + 1,
                text,
                title: `Segment ${i + 1}`,
                voice: options.voice || 'auto',
                pace: options.pace || 'normal',
                audioTags: [],
                language: options.language || 'auto',
                estimatedDuration,
            };
        });

        const voices = new Set(segments.map(s => s.voice).filter(v => v !== 'auto'));
        const languages = new Set(segments.map(s => s.language).filter(l => l !== 'auto'));

        return {
            segments,
            metadata: {
                totalEstimatedDuration: segments.reduce((sum, s) => sum + s.estimatedDuration, 0),
                voiceCount: voices.size || 1,
                languages: languages.size > 0 ? [...languages] : ['auto'],
            },
        };
    }
}

module.exports = TTSPlanner;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tts-generator/lib/planner.js packages/tts-generator/lib/planner.test.js
git commit -m "feat(tts-generator): TTSPlanner with LLM + regex fallback segmentation"
```

---

### Task 3: TTSGenerator — Gemini Interactions API

**Files:**
- Create: `packages/tts-generator/lib/generator.js`
- Create: `packages/tts-generator/lib/generator.test.js`

**Interfaces:**
- Consumes: `SegmentPlan.segment` objects (text, voice, pace, audioTags, language)
- Produces: `class TTSGenerator` with:
  - `constructor(config)` — config.tts.model, config.tts.fallback, config.apiKey
  - `async generate(segment) → Promise<{ text, audio: Buffer, voice, duration, format }>`
  - `async generateBatch(segments, options?) → Promise<Array<...>>`

- [ ] **Step 1: Write the failing test — generator.test.js**

```js
'use strict';
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const TTSGenerator = require('./generator');

const SAMPLE_SEGMENT = {
    id: 1,
    text: 'Xin chào các bạn, hôm nay chúng ta sẽ nói về trí tuệ nhân tạo.',
    title: 'Giới thiệu',
    voice: 'Charon',
    pace: 'normal',
    audioTags: ['neutral'],
    language: 'vi',
    estimatedDuration: 10,
};

function makeMockFetch(statusCode, responseBody) {
    return mock.fn(async () => ({
        ok: statusCode >= 200 && statusCode < 300,
        status: statusCode,
        json: async () => responseBody,
        text: async () => JSON.stringify(responseBody),
    }));
}

describe('TTSGenerator', () => {
    describe('generate()', () => {
        it('should call Gemini Interactions API and return audio buffer', async () => {
            const mockAudioBase64 = Buffer.from('fake-audio-data').toString('base64');
            const mockResponse = {
                turns: [{
                    parts: [{
                        inlineData: {
                            mimeType: 'audio/wav',
                            data: mockAudioBase64,
                        },
                    }],
                }],
            };

            const fetchMock = makeMockFetch(200, mockResponse);
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);

            assert.ok(result, 'result should be returned');
            assert.ok(Buffer.isBuffer(result.audio), 'audio should be a Buffer');
            assert.equal(result.audio.toString(), 'fake-audio-data');
            assert.equal(result.text, SAMPLE_SEGMENT.text);
            assert.equal(result.voice, SAMPLE_SEGMENT.voice);
            assert.equal(result.format, 'wav');

            // Verify API call structure
            assert.equal(fetchMock.mock.calls.length, 1);
            const callUrl = fetchMock.mock.calls[0].arguments[0];
            assert.ok(callUrl.includes('generativelanguage.googleapis.com'));
            assert.ok(callUrl.includes('key=test-key'));

            const callBody = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
            assert.equal(callBody.model, 'gemini-3.1-flash-tts-preview');
            assert.equal(callBody.input.text, SAMPLE_SEGMENT.text);
        });

        it('should throw on non-ok response', async () => {
            const fetchMock = makeMockFetch(400, { error: { message: 'Bad request' } });
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            await assert.rejects(
                () => gen.generate(SAMPLE_SEGMENT),
                { message: /Gemini TTS API error/ },
            );
        });

        it('should retry on 429 and succeed', async () => {
            let callCount = 0;
            const mockAudioBase64 = Buffer.from('retry-success').toString('base64');
            const fetchMock = mock.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    return { ok: false, status: 429, text: async () => 'Rate limited' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        turns: [{
                            parts: [{
                                inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                            }],
                        }],
                    }),
                    text: async () => '',
                };
            });

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const result = await gen.generate(SAMPLE_SEGMENT);
            assert.ok(result);
            assert.equal(callCount, 2, 'should retry once');
        });
    });

    describe('generateBatch()', () => {
        it('should generate audio for multiple segments', async () => {
            const mockAudioBase64 = Buffer.from('audio-data').toString('base64');
            const mockResponse = {
                turns: [{
                    parts: [{
                        inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                    }],
                }],
            };

            const fetchMock = makeMockFetch(200, mockResponse);
            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const segments = [
                { ...SAMPLE_SEGMENT, id: 1, text: 'First segment.' },
                { ...SAMPLE_SEGMENT, id: 2, text: 'Second segment.' },
            ];

            const results = await gen.generateBatch(segments);
            assert.equal(results.length, 2);
            assert.equal(fetchMock.mock.calls.length, 2, 'should call API per segment');
        });

        it('should skip failed segments and return partial results', async () => {
            let callCount = 0;
            const fetchMock = mock.fn(async () => {
                callCount++;
                if (callCount === 2) {
                    return { ok: false, status: 500, text: async () => 'Server error' };
                }
                const mockAudioBase64 = Buffer.from(`audio-${callCount}`).toString('base64');
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        turns: [{
                            parts: [{
                                inlineData: { mimeType: 'audio/wav', data: mockAudioBase64 },
                            }],
                        }],
                    }),
                    text: async () => '',
                };
            });

            const gen = new TTSGenerator({
                apiKey: 'test-key',
                tts: { model: 'gemini-3.1-flash-tts-preview' },
                _fetch: fetchMock,
            });

            const segments = [
                { ...SAMPLE_SEGMENT, id: 1, text: 'First.' },
                { ...SAMPLE_SEGMENT, id: 2, text: 'Second.' },
                { ...SAMPLE_SEGMENT, id: 3, text: 'Third.' },
            ];

            const results = await gen.generateBatch(segments);
            // segment 2 fails — should still return 2 successful + 1 error
            assert.equal(results.length, 3, 'should return all segments');
            const failed = results.find(r => r.error);
            assert.ok(failed, 'failed segment should have error property');
            assert.equal(failed.id, 2);
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: FAIL — `generator.js` is still an empty class.

- [ ] **Step 3: Write generator.js — TTSGenerator class**

```js
'use strict';

const TTS_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions';

class TTSGenerator {
    /**
     * @param {Object} config
     * @param {string} config.apiKey - Gemini API key
     * @param {Object} [config.tts]
     * @param {string} [config.tts.model='gemini-3.1-flash-tts-preview']
     * @param {string} [config.tts.fallback='gemini-2.5-flash-preview-tts']
     * @param {Function} [config._fetch] - For testing: mock fetch
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        this.model = config.tts?.model || 'gemini-3.1-flash-tts-preview';
        this.fallbackModel = config.tts?.fallback || 'gemini-2.5-flash-preview-tts';
        this._fetch = config._fetch || globalThis.fetch;
        this.maxRetries = config.maxRetries ?? 3;
        this.baseDelay = config.baseDelay ?? 1000;
    }

    /**
     * Generate audio for a single segment.
     * @param {Object} segment - SegmentPlan segment object
     * @returns {Promise<{id: number, text: string, audio: Buffer, voice: string, duration: number|null, format: string}>}
     */
    async generate(segment) {
        const body = this._buildRequestBody(segment);
        let lastError;
        let usedFallback = false;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this._fetch(
                    `${TTS_API_BASE}?key=${this.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    },
                );

                if (response.ok) {
                    const data = await response.json();
                    return this._parseResponse(data, segment);
                }

                const status = response.status;

                // Quota exhausted — fallback to 2.5 Flash
                if (status === 403 && !usedFallback) {
                    console.warn(`TTSGenerator: quota exhausted on ${this.model}, falling back to ${this.fallbackModel}`);
                    body.model = this.fallbackModel;
                    usedFallback = true;
                    attempt = -1; // restart retry with fallback model
                    continue;
                }

                if (status === 429 && attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    console.warn(`TTSGenerator: rate limited (429), retrying in ${Math.round(delay)}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                const errText = await response.text();
                throw new Error(`Gemini TTS API error (${status}): ${errText.slice(0, 200)}`);
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    const delay = this._backoff(attempt);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        throw lastError || new Error('TTSGenerator: max retries exceeded');
    }

    /**
     * Generate audio for multiple segments.
     * Failed segments include an error property instead of throwing.
     *
     * @param {Array} segments - Array of segment objects
     * @param {Object} [options]
     * @param {number} [options.concurrency=3] - Max concurrent API calls
     * @returns {Promise<Array<{id, text, audio?, voice?, error?}>>}
     */
    async generateBatch(segments, options = {}) {
        const concurrency = options.concurrency ?? 3;
        const results = [];

        // Process in chunks to avoid overwhelming the API
        for (let i = 0; i < segments.length; i += concurrency) {
            const chunk = segments.slice(i, i + concurrency);
            const chunkResults = await Promise.allSettled(
                chunk.map(seg => this.generate(seg).catch(err => ({
                    id: seg.id,
                    text: seg.text,
                    error: err.message,
                }))),
            );

            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({ error: result.reason?.message || 'Unknown error' });
                }
            }
        }

        return results;
    }

    _buildRequestBody(segment) {
        const body = {
            model: this.model,
            input: { text: segment.text },
            config: {
                generation_config: {
                    response_modalities: ['audio'],
                },
            },
        };

        if (segment.voice && segment.voice !== 'auto') {
            body.config.voice_config = { voice_name: segment.voice };
        }

        if (segment.audioTags && segment.audioTags.length > 0) {
            body.config.speech_config = {
                '': segment.audioTags.map(tag => ({ tag })),
            };
        }

        if (segment.pace && segment.pace !== 'normal') {
            if (!body.config.speech_config) {
                body.config.speech_config = { '': [] };
            }
            body.config.speech_config[''].push({ tag: segment.pace === 'slow' ? 'slow' : 'fast' });
        }

        return body;
    }

    _parseResponse(data, segment) {
        if (!data.turns || data.turns.length === 0) {
            throw new Error('Gemini TTS: empty response (no turns)');
        }

        const parts = data.turns[0].parts || [];
        const audioPart = parts.find(p => p.inlineData && p.inlineData.data);

        if (!audioPart) {
            throw new Error('Gemini TTS: no audio data in response');
        }

        const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
        const format = mimeType.split('/').pop() || 'wav';
        const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

        return {
            id: segment.id,
            text: segment.text,
            audio: audioBuffer,
            voice: segment.voice || 'auto',
            duration: segment.estimatedDuration || null,
            format,
        };
    }

    _backoff(attempt) {
        const cap = 30000;
        const exp = Math.min(cap, this.baseDelay * Math.pow(2, attempt));
        return Math.random() * exp;
    }
}

module.exports = TTSGenerator;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: all TTSGenerator tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tts-generator/lib/generator.js packages/tts-generator/lib/generator.test.js
git commit -m "feat(tts-generator): TTSGenerator with Gemini Interactions API + retry/fallback"
```

---

### Task 4: OutputFormatter — batch/single/stream

**Files:**
- Create: `packages/tts-generator/lib/output.js`
- Create: `packages/tts-generator/lib/output.test.js`

**Interfaces:**
- Consumes: segments array + audio Buffers
- Produces: `class OutputFormatter` with:
  - `formatBatch(segments, audioBuffers) → { segments: Array<{ text, audio, voice, duration }> }`
  - `formatSingle(audioBuffers) → Buffer` (concatenated WAV)
  - `formatStream(audioBuffers) → AsyncGenerator` (yields one segment at a time)

- [ ] **Step 1: Write the failing test — output.test.js**

```js
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const OutputFormatter = require('./output');

const SAMPLE_SEGMENTS = [
    { id: 1, text: 'First segment.', voice: 'Charon', duration: 10 },
    { id: 2, text: 'Second segment.', voice: 'Kore', duration: 8 },
];

const SAMPLE_AUDIO = [
    Buffer.from('audio-data-1'),
    Buffer.from('audio-data-2'),
];

describe('OutputFormatter', () => {
    describe('formatBatch()', () => {
        it('should return array of segment + audio pairs', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatBatch(SAMPLE_SEGMENTS, SAMPLE_AUDIO);

            assert.ok(result, 'result should be returned');
            assert.ok(Array.isArray(result.segments), 'result.segments should be array');
            assert.equal(result.segments.length, 2);

            assert.equal(result.segments[0].text, 'First segment.');
            assert.equal(result.segments[0].voice, 'Charon');
            assert.ok(Buffer.isBuffer(result.segments[0].audio));
            assert.equal(result.segments[0].audio.toString(), 'audio-data-1');

            assert.equal(result.segments[1].text, 'Second segment.');
            assert.equal(result.segments[1].voice, 'Kore');
        });

        it('should handle empty arrays', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatBatch([], []);
            assert.ok(result);
            assert.equal(result.segments.length, 0);
        });

        it('should throw if arrays have different lengths', () => {
            const formatter = new OutputFormatter();
            assert.throws(
                () => formatter.formatBatch(SAMPLE_SEGMENTS, [Buffer.from('only-one')]),
                { message: /mismatch/i },
            );
        });
    });

    describe('formatSingle()', () => {
        it('should concatenate audio buffers into one', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatSingle(SAMPLE_AUDIO);

            assert.ok(Buffer.isBuffer(result), 'result should be a Buffer');
            assert.equal(result.toString(), 'audio-data-1audio-data-2');
        });

        it('should return empty buffer for empty input', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatSingle([]);
            assert.ok(Buffer.isBuffer(result));
            assert.equal(result.length, 0);
        });
    });

    describe('formatStream()', () => {
        it('should yield each segment audio sequentially', async () => {
            const formatter = new OutputFormatter();
            const stream = formatter.formatStream(SAMPLE_SEGMENTS, SAMPLE_AUDIO);

            const items = [];
            for await (const item of stream) {
                items.push(item);
            }

            assert.equal(items.length, 2);
            assert.equal(items[0].text, 'First segment.');
            assert.equal(items[1].text, 'Second segment.');
            assert.ok(Buffer.isBuffer(items[0].audio));
        });

        it('should yield from empty input without error', async () => {
            const formatter = new OutputFormatter();
            const stream = formatter.formatStream([], []);
            const items = [];
            for await (const item of stream) {
                items.push(item);
            }
            assert.equal(items.length, 0);
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: FAIL — `output.js` is still an empty class.

- [ ] **Step 3: Write output.js — OutputFormatter class**

```js
'use strict';

class OutputFormatter {
    /**
     * Format batch output: structured segment-audio pairs.
     * @param {Array} segments - Original segment objects
     * @param {Buffer[]} audioBuffers - Audio buffers in same order
     * @returns {{ segments: Array<{id, text, audio, voice, duration}> }}
     */
    formatBatch(segments, audioBuffers) {
        if (segments.length !== audioBuffers.length) {
            throw new Error(`OutputFormatter: segment/audio length mismatch (${segments.length} vs ${audioBuffers.length})`);
        }

        const paired = segments.map((seg, i) => ({
            id: seg.id || i + 1,
            text: seg.text,
            audio: audioBuffers[i],
            voice: seg.voice || 'auto',
            duration: seg.duration || seg.estimatedDuration || null,
        }));

        return { segments: paired };
    }

    /**
     * Concatenate all audio buffers into a single buffer.
     * Note: For production use, proper WAV concatenation may be needed.
     * For v1, simple buffer concatenation for same-format audio clips.
     *
     * @param {Buffer[]} audioBuffers
     * @returns {Buffer}
     */
    formatSingle(audioBuffers) {
        return Buffer.concat(audioBuffers);
    }

    /**
     * Stream output: yields one segment-audio pair at a time.
     *
     * @param {Array} segments
     * @param {Buffer[]} audioBuffers
     * @returns {AsyncGenerator}
     */
    async *formatStream(segments, audioBuffers) {
        if (segments.length !== audioBuffers.length) {
            throw new Error(`OutputFormatter: segment/audio length mismatch (${segments.length} vs ${audioBuffers.length})`);
        }

        for (let i = 0; i < segments.length; i++) {
            yield {
                id: segments[i].id || i + 1,
                text: segments[i].text,
                audio: audioBuffers[i],
                voice: segments[i].voice || 'auto',
                duration: segments[i].duration || segments[i].estimatedDuration || null,
            };
        }
    }
}

module.exports = OutputFormatter;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: all OutputFormatter tests PASS. All tests from Tasks 2-4 also pass.

- [ ] **Step 5: Commit**

```bash
git add packages/tts-generator/lib/output.js packages/tts-generator/lib/output.test.js
git commit -m "feat(tts-generator): OutputFormatter with batch/single/stream modes"
```

---

### Task 5: MCP tools + skills

**Files:**
- Create: `packages/tts-generator/mcp-tools.js`
- Create: `packages/tts-generator/skills/postinstall.js`
- Create: `packages/tts-generator/skills/tts-generator-workflow.md`
- Create: `packages/tts-generator/skills/tts-voice-selection.md`

**Interfaces:**
- Consumes: `{ TTSPlanner, TTSGenerator, OutputFormatter, VOICES }` from lib
- Produces: Two MCP tools (`generate_tts`, `list_tts_voices`) registered via `module.exports = function()`

- [ ] **Step 1: Write mcp-tools.js**

```js
'use strict';

/**
 * @andy-toolforge/tts-generator MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 */

const { TTSPlanner, TTSGenerator, OutputFormatter, VOICES, VOICE_NAMES } = require('./lib');

// ---------------------------------------------------------------------------
// generate_tts
// ---------------------------------------------------------------------------
const generateTTSDef = {
    name: 'generate_tts',
    description: 'Generate voice audio from podcast script using Gemini TTS API. Supports smart segmentation (LLM-based), multi-voice selection, and batch/single/stream output modes.',
    inputSchema: {
        type: 'object',
        properties: {
            script: { type: 'string', description: 'Full podcast script text to convert to speech' },
            title: { type: 'string', description: 'Episode title (provides context for planner segmentation)' },
            voice: { type: 'string', description: `Voice name override. One of: ${VOICE_NAMES.join(', ')}. Default: "auto" (smart selection)`, default: 'auto' },
            mode: { type: 'string', enum: ['batch', 'single', 'stream'], description: 'Output mode: batch (array of segment-audio pairs), single (concatenated audio), stream (iterable segments)', default: 'batch' },
            language: { type: 'string', description: 'Language: "vi", "en", or "auto" detect', default: 'auto' },
            pace: { type: 'string', enum: ['slow', 'normal', 'fast'], description: 'Speech pace', default: 'normal' },
            tags: { type: 'string', description: 'Comma-separated audio tags (e.g. "determination,positive,whispers"). See Gemini TTS audio tags.' },
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

    // 1. Plan: segment the script using the configured LLM
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

    // Apply global tags to all segments if provided
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
        // For MCP tools, return segments array with base64 audio
        // (true streaming would need SSE, which is v2)
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
```

- [ ] **Step 2: Write skills/postinstall.js**

```js
const fs = require('fs');
const path = require('path');

const DOMAIN = 'tts-generator';
const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, '.opencode', 'skills');
const sourceDir = path.join(__dirname);

fs.mkdirSync(targetDir, { recursive: true });

fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.md') && file !== 'postinstall.js') {
        const src = path.join(sourceDir, file);
        const destName = `${DOMAIN}-${file.replace(/\s+/g, '_')}`;
        const dest = path.join(targetDir, destName);
        if (!fs.existsSync(dest)) {
            try {
                fs.symlinkSync(path.relative(targetDir, src), dest);
                console.log(`  🔗 Linked ${destName}`);
            } catch (e) {
                fs.copyFileSync(src, dest);
                console.log(`  📄 Copied ${destName}`);
            }
        }
    }
});
```

- [ ] **Step 3: Write skills/tts-generator-workflow.md**

```markdown
# TTS Generator Workflow

## When to use

Use this skill when you need to convert podcast/video scripts to voice audio. The TTS Generator handles:
- Smart script segmentation (LLM-based paragraph analysis)
- Multi-voice selection from 30 Gemini TTS voices
- Batch, single, or stream audio output

## Workflow

1. **Prepare script**: Full podcast script text with clear paragraph breaks
2. **Choose voice**: "auto" for smart selection, or pick from 30 voices (see tts-voice-selection skill)
3. **Run batch generation**: The tool segments and generates audio in parallel
4. **Assemble output**: Audio clips ready for final editing

## MCP Tools

- `generate_tts` — Full pipeline: script → segments → audio
- `list_tts_voices` — Browse available voices with descriptions

## Audio tags for expressiveness

Add comma-separated tags for emotional tone: determination, enthusiasm, excitement, curiosity, whispers, laughs, positive, neutral, negative, frustration, anger, amusement, awe, admiration
```

- [ ] **Step 4: Write skills/tts-voice-selection.md**

```markdown
# TTS Voice Selection Guide

## Quick picks by content type

| Content type | Recommended voice | Why |
|-------------|------------------|-----|
| Philosophical/contemplative | Charon (Informative) | Calm, educational tone |
| Energetic opening | Zephyr (Bright) | Positive, energetic |
| Authoritative statement | Kore (Firm) | Assertive, commanding |
| Emotional/personal | Achernar (Soft) | Gentle, intimate |
| Technical explanation | Iapetus (Clear) | Precise, articulate |
| Friendly/conversational | Achird (Friendly) | Warm, approachable |
| Closing/wrap-up | Sulafat (Warm) | Cozy, comforting |

## All 30 voices

Use `list_tts_voices` MCP tool to see all available voices with descriptions.

## Tags for emotional control

Add audio tags to shape delivery: [determination], [whispers], [laughs], [excitement], [curiosity], [amusement], [awe]
```

- [ ] **Step 5: Run full test suite to verify everything still works**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: all tests PASS.

- [ ] **Step 6: Verify npm install / postinstall runs without error**

```bash
npm install
```

Expected: no errors during postinstall.

- [ ] **Step 7: Commit**

```bash
git add packages/tts-generator/mcp-tools.js packages/tts-generator/skills/
git commit -m "feat(tts-generator): MCP tools + skills (generate_tts, list_tts_voices)"
```

---

### Task 6: Integration verification

**Files:**
- Verify: full end-to-end flow using local tests

- [ ] **Step 1: Run all tests**

```bash
npm test -w @andy-toolforge/tts-generator
```

Expected: PASS for all tests (planner: 4, generator: 4, output: 6 = 14 tests).

- [ ] **Step 2: Verify module loading from workspace**

```bash
node -e "
const { TTSPlanner, TTSGenerator, OutputFormatter, VOICES, VOICE_NAMES } = require('@andy-toolforge/tts-generator');
console.log('TTSPlanner:', typeof TTSPlanner);
console.log('TTSGenerator:', typeof TTSGenerator);
console.log('OutputFormatter:', typeof OutputFormatter);
console.log('Voices loaded:', VOICE_NAMES.length);
console.log('OK: package loads correctly');
"
```

Expected: prints all class types and "OK" message.

- [ ] **Step 3: Verify MCP tool discovery**

```bash
node -e "
const mcpTools = require('./packages/tts-generator/mcp-tools');
const tools = mcpTools();
console.log('MCP tools:', tools.length);
tools.forEach(t => console.log(' -', t.definition.name));
"
```

Expected: prints 2 tools (`generate_tts`, `list_tts_voices`).

- [ ] **Step 4: Final commit — create root package.json workspace entry if missing**

Check if `@andy-toolforge/tts-generator` is already covered by the workspace glob `packages/*` in root `package.json`:

```bash
grep '"workspaces"' package.json
```

If the root uses `"workspaces": ["packages/*"]`, the new package is already included. No change needed.

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore(tts-generator): integration verification"
```

---

## Summary

After all 6 tasks:

| Task | Files | Tests |
|------|-------|-------|
| 1. Package scaffold + voices | 3 files | — |
| 2. TTSPlanner | 2 files (planner.js + test) | 4 tests |
| 3. TTSGenerator | 2 files (generator.js + test) | 4 tests |
| 4. OutputFormatter | 2 files (output.js + test) | 6 tests |
| 5. MCP tools + skills | 4 files | — |
| 6. Integration verification | 0 files | 14 total passing |

**Total: ~13 files, 14 tests, 2 MCP tools, 2 skill files.**
