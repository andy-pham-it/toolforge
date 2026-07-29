# @andy-toolforge/tts-generator — Text-to-Speech Generator

> Domain package for AI-powered text-to-speech generation using Gemini TTS APIs.
> Supports REST-based (Interactions API) and WebSocket-based (Live API) generation,
> LLM-powered script segmentation, multi-voice selection, and configurable audio output.

## Structure

```
packages/tts-generator/
  lib/
    index.js         — Entry: exports { TTSGenerator, LiveTTSGenerator, TTSPlanner,
                         OutputFormatter, TTSPlugin, VOICES, VOICE_NAMES,
                         getVoice, pickVoiceForTone, LIVE_MODELS, LIVE_MODEL_NAMES }
    generator.js     — TTSGenerator — Gemini TTS via Interactions REST API
    live-generator.js — LiveTTSGenerator — Gemini TTS via Live WebSocket API
    planner.js       — TTSPlanner — LLM-based script segmentation
    output.js        — OutputFormatter — batch/single/stream audio output
    plugin.js        — TTSPlugin — Express/NestJS plugin wrapper
    voices.js        — VOICES/VOICE_NAMES — 30 voice definitions + utilities
  mcp-tools.js       — MCP tool handlers for TTS
  skills/
    postinstall.js
    tts-generator.md
  package.json       — deps: @andy-toolforge/core, @google/genai
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `TTSGenerator` | `lib/generator.js` | REST-based TTS via `gemini-*-tts-preview` models. Constructor: `new TTSGenerator({ apiKey?, model?, fallback?, maxRetries?, baseDelay? })`. Methods: `generate(segment[])`, `setConfig(options)`. |
| `LiveTTSGenerator` | `lib/live-generator.js` | WebSocket-based TTS via `gemini-live-*-preview` models. Transmits audio as PCM→WAV. Constructor: `new LiveTTSGenerator({ apiKey?, model?, generationConfig? })`. Methods: `generate(text, voice?)`, `setModel(model)`. |
| `TTSPlanner` | `lib/planner.js` | LLM-based script segmentation. Splits scripts into 30-120s segments with voice/pace/tags per segment. Methods: `plan(script, title?)`, `planSegments(segments)`. |
| `OutputFormatter` | `lib/output.js` | Audio output formatting. Methods: `formatBatch(segments)`, `formatSingle(audio, metadata)`, `formatStream(segments)`. |
| `TTSPlugin` | `lib/plugin.js` | Express/NestJS plugin wrapper for REST endpoints. |
| `getVoice(name)` | `lib/voices.js` | Look up a voice by name. |
| `pickVoiceForTone(tone)` | `lib/voices.js` | Smart voice selection by content tone. |

### Voice utilities

| Export | Type | Description |
|--------|------|-------------|
| `VOICES` | Object | `{ Zephyr: { desc, gender, styleTags, tone }, ... }` — 30 voices |
| `VOICE_NAMES` | Array | `['Zephyr', 'Puck', 'Charon', ...]` — sorted voice names |
| `LIVE_MODELS` | Object | Live API model definitions |
| `LIVE_MODEL_NAMES` | Array | Sorted live model names |

## Conventions

- Uses `@google/genai` SDK — not raw HTTP calls (except legacy path in TTSGenerator).
- TTSGenerator uses REST Interactions API; LiveTTSGenerator uses WebSocket Live API.
- Script segmentation uses core LLMClient internally (via TTSPlanner).
- Skill files prefixed with `tts-generator-`.
- Audio output defaults to WAV (PCM 24kHz mono from Live, configurable from REST).
- MCP tools registered via `mcp-tools.js` — loaded dynamically by mcp server.

## Testing

```bash
npm test -w @andy-toolforge/tts-generator
```

## See also

- `packages/tts-generator/skills/` — skill prompt files
- `@andy-toolforge/core/lib/llm.js` — core LLMClient
