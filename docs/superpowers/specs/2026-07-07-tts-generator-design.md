# @andy-toolforge/tts-generator — Design Spec

> **Date:** 2026-07-07
> **Status:** Draft
> **Package:** `@andy-toolforge/tts-generator`

---

## 1. Problem

User currently manually splits podcast scripts into <2-minute segments in Google AI Studio App, generates voice clips via Gemini TTS, and stitches them in CapCut. This is repetitive, manual, and doesn't scale.

**Goal:** Automate the entire workflow: script → smart segmentation → multi-voice TTS audio → ready-to-assemble clips.

---

## 2. Architecture: Two-Layer

```
Script text (full podcast, 10-15 min)
    ↓
┌──────────────────────────────────┐
│  TTSPlanner                       │
│  (configurable LLM, default:      │
│   Gemma 4 26B via Groq)           │
│  → splits script into segments    │
│  → assigns voice/pacing/tags      │
└──────────┬───────────────────────┘
           ↓ SegmentPlan (JSON)
┌──────────┴───────────────────────┐
│  TTSGenerator                     │
│  (Gemini Interactions API)        │
│  → calls Gemini TTS per segment   │
│  → handles rate limits/retry      │
└──────────┬───────────────────────┘
           ↓ AudioBuffer[]
┌──────────┴───────────────────────┐
│  OutputFormatter                  │
│  → batch | single | stream        │
└──────────────────────────────────┘
```

### Why Two-Layer?

- **TTSPlanner** handles reasoning (script analysis, segmentation, voice selection) — can use cheap/free models (Gemma 4 26B via Groq).
- **TTSGenerator** handles audio generation via Gemini TTS API — the only part that actually needs the TTS model.
- Independent scaling: upgrade planner without touching TTS, swap TTS provider without changing segmentation logic.
- Planner fallback: if LLM fails, fallback to regex-based paragraph splitting.

---

## 3. Package Structure

```
packages/tts-generator/
  package.json
  mcp-tools.js              ← MCP plugin discovery (auto-detected by @andy-toolforge/mcp)
  lib/
    index.js                ← Export { TTSGenerator, SegmentPlan }
    planner.js              ← TTSPlanner class
    generator.js            ← TTSGenerator class (Interactions API)
    output.js               ← OutputFormatter
    voices.js               ← 30 voice definitions + metadata
  skills/
    tts-generator-workflow.md
    tts-voice-selection.md
```

Follows the same pattern as `packages/footage-generation/`: `lib/` contains core classes, `mcp-tools.js` is a thin wrapper for MCP auto-discovery.

---

## 4. Core Classes

### 4.1 TTSPlanner

```
TTSPlanner(config)
  - config.planner.provider   // 'groq' | 'gemini' | 'ollama'
  - config.planner.model      // 'gemma-4-26b-it' | 'gemini-3.1-flash-lite'
  - config.planner.fallback   // { provider, model } — optional

  .plan(script, title, options?)
    → Promise<SegmentPlan>
```

**SegmentPlan:**

```typescript
interface SegmentPlan {
  segments: Array<{
    id: number;
    text: string;           // Segment text content
    title: string;          // Short segment title (for context)
    voice: string;          // Voice name (e.g. "Kore") or "auto"
    pace: 'slow' | 'normal' | 'fast';
    audioTags: string[];    // e.g. ["determination", "whispers"]
    language: string;       // "vi" | "en" | "auto"
    estimatedDuration: number; // seconds
  }>;
  metadata: {
    totalEstimatedDuration: number;
    voiceCount: number;
    languages: string[];
  };
}
```

**Planner prompt:** Instructs the LLM to analyze the script and produce a segmentation plan. Key criteria:
- Split at natural boundaries (paragraphs, topic shifts)
- Each segment 30-120 seconds of spoken audio
- Assign appropriate voice based on content tone
- Add audio tags for expressiveness ([determination], [whispers], etc.)
- Return ONLY valid JSON

**Fallback:** If LLM call fails, split by double-newline paragraphs.

### 4.2 TTSGenerator

```
TTSGenerator(config)
  - config.tts.model        // 'gemini-3.1-flash-tts-preview' (default)
  - config.tts.fallback     // 'gemini-2.5-flash-preview-tts'
  - config.apiKey           // Gemini API key

  .generate(segment, options?)
    → Promise<AudioSegment>
  .generateBatch(segments, options?)
    → Promise<AudioSegment[]>
```

**Gemini Interactions API call** (raw fetch, not LLMClient):

```
POST https://generativelanguage.googleapis.com/v1beta/interactions?key={apiKey}
{
  model: "gemini-3.1-flash-tts-preview",
  input: { text: segment.text },
  config: {
    generation_config: { response_modalities: ["audio"] },
    voice_config: { voice_name: segment.voice },
    speech_config: {
      "": segment.audioTags.map(tag => ({ tag }))
    }
  }
}
```

Returns base64-encoded audio → decode to Buffer.

**Rate limiting:** Retry with exponential backoff (1s, 2s, 4s) on 429/503.
**Quota fallback:** Auto-switch to `gemini-2.5-flash-preview-tts` if primary model returns quota errors.

### 4.3 OutputFormatter

```
OutputFormatter(config)

  .formatBatch(segments, audioBuffers)
    → { segments: Array<{ text, audio, voice, duration }> }

  .formatSingle(audioBuffers)
    → Buffer (concatenated audio)

  .formatStream(audioBuffers)
    → AsyncGenerator (yields one segment at a time)
```

### 4.4 Voices

30 prebuilt Gemini TTS voices, exported for reference:

```javascript
const VOICES = {
  Kore:     { style: "Firm", gender: "neutral", description: "Assertive, authoritative" },
  Charon:   { style: "Informative", gender: "neutral", description: "Educational, calm" },
  Zephyr:   { style: "Bright", gender: "neutral", description: "Energetic, positive" },
  // ... 27 more
};
```

---

## 5. MCP Tools

### Tool 1: `generate_tts`

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `script` | string | required | Full podcast script text |
| `title` | string | required | Episode title (for planner context) |
| `voice` | string | `"auto"` | Voice name or "auto" for smart selection |
| `mode` | string | `"batch"` | `batch` (array), `single` (merged), `stream` (async) |
| `language` | string | `"auto"` | `vi`, `en`, or `auto` detect |
| `pace` | string | `"normal"` | `slow`, `normal`, `fast` |
| `planner` | string | `""` | Override planner model (empty = use default) |
| `tags` | string | `""` | Comma-separated audio tags e.g. `"determination,positive"` |

### Tool 2: `list_tts_voices`

No arguments. Returns array of all 30 voices with descriptions.

---

## 6. Config Priorities

```javascript
{
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  planner: {
    provider: 'groq',           // Default: Groq (free Gemma tier)
    model: 'gemma-4-26b-it',    // User's preference
    fallback: {
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite'
    }
  },
  tts: {
    model: 'gemini-3.1-flash-tts-preview',
    fallback: 'gemini-2.5-flash-preview-tts'
  },
  output: {
    mode: 'batch'
  }
}
```

API key detection:
1. Explicit `config.apiKey`
2. `GEMINI_API_KEY` env var
3. `GOOGLE_API_KEY` env var

---

## 7. Error Handling

| Layer | Error | Handling |
|-------|-------|----------|
| Planner | LLM call fails | Fallback: regex paragraph split + auto voice |
| Planner | LLM returns invalid JSON | Retry with stricter prompt; max 2 retries |
| TTS | 429 rate limit | Exponential backoff (1s, 2s, 4s, 8s) |
| TTS | 403 quota exhausted | Fallback to 2.5 Flash TTS model |
| TTS | 5xx server error | Retry 3 times, then skip segment with warning |
| Output | Audio decode fail | Return error for specific segment, keep others |

---

## 8. Out of Scope (v1)

- Web server / REST API wrapper (v2)
- Multi-speaker TTS (2 voices alternating) — v1.1
- Audio file caching / dedup
- ElevenLabs or other TTS providers
- Streaming output via SSE (v2 with web server)
- Web UI / playground

## 9. Testing Strategy

| Test | Scope |
|------|-------|
| Unit: planner | Mock LLM, verify segment plan JSON parsing |
| Unit: generator | Mock fetch, verify API call structure |
| Unit: output | Verify buffer concatenation, format correctness |
| Integration | Real Gemma 4 26B call (Groq) + real Gemini TTS API |
| E2E | Full pipeline: script → planner → TTS → audio files |

---

## 10. Dependencies

- `@andy-toolforge/core` (for LLMClient and Logger)
- No other runtime deps (raw `fetch` for Gemini TTS API)
- Dev: standard test tooling
