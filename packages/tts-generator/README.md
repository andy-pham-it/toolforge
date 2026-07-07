# @andy-toolforge/tts-generator

[![npm](https://img.shields.io/npm/v/@andy-toolforge/tts-generator)](https://npmjs.com/package/@andy-toolforge/tts-generator)
[![License](https://img.shields.io/npm/l/@andy-toolforge/tts-generator)](https://github.com/andy-pham-it/toolforge)

**Text-to-speech generation using Gemini TTS models — script segmentation, multi-voice, batch/stream/single output.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này hỗ trợ **hai API mode** song song:

| Mode | API | Models | Use case |
|------|-----|--------|----------|
| `interactions` (REST) | Gemini Interactions API | `gemini-*-tts-preview` | Batch TTS đơn giản, gọi REST một lần → WAV |
| `live` (WebSocket) | Gemini Live API (BidiGenerateContent) | `gemini-live-*-native-audio`, `gemini-*-live-*` | Real-time streaming, bidirectional audio dialog |

Package này thay thế hoàn toàn workflow thủ công (chia script trong AI Studio → generate từng đoạn → ghép trong CapCut) bằng một API tự động, hỗ trợ:

- **Smart segmentation:** LLM-based chia script thành các đoạn logical (tự động fallback regex nếu LLM không available)
- **30 Gemini TTS voices:** Từ Zephyr (Bright) đến Sulafat (Warm), mỗi giọng có style riêng
- **Audio tags:** 200+ expressive tags ([whispers], [laughs], [determination]...) để điều khiển giọng đọc
- **3 output modes:** batch (mảng segment-audio pairs), single (concatenated audio), stream (ordered với position metadata)
- **Multi-speaker:** Hỗ trợ đến 2 speakers trong cùng một interaction
- **403 quota fallback:** Tự động fallback cross-model (trong cùng mode) khi hết quota
- **Batching:** Configurable concurrency để tránh rate limit

## Installation

```bash
npm install @andy-toolforge/tts-generator
```

Yêu cầu: `@andy-toolforge/core` (tự động cài kèm) và Gemini API key.

## Quick Start

```javascript
const { TTSPlanner, TTSGenerator, OutputFormatter } = require('@andy-toolforge/tts-generator');

// 1. Segmentation với LLM
const planner = new TTSPlanner({ llm });
const plan = await planner.plan(script, title);

// 2. Generate audio với Gemini TTS
const gen = new TTSGenerator({
    apiKey: process.env.GEMINI_API_KEY,
});
const results = await gen.generateBatch(plan.segments);

// 3. Format output
const formatter = new OutputFormatter();
const batch = formatter.formatBatch(plan.segments, results.map(r => r.audio));
```

## API Reference

```javascript
const {
    VOICES,            // { voiceName: { style, description } }
    VOICE_NAMES,       // ['Zephyr', 'Puck', ...]
    getVoice,          // (name) → { style, description } | null
    pickVoiceForTone,  // (tone) → voice name

    TTSPlanner,        // Script segmentation
    TTSGenerator,      // Gemini TTS API client (Interactions REST)
    LiveTTSGenerator,  // Gemini TTS API client (Live WebSocket)
    OutputFormatter,   // Output formatting (batch/single/stream)

    LIVE_MODELS,       // { modelName: { description } }
    LIVE_MODEL_NAMES,  // ['gemini-live-2.5-flash-native-audio', ...]
} = require('@andy-toolforge/tts-generator');
```

---

### VOICES / VOICE_NAMES / getVoice / pickVoiceForTone

Xem danh sách và chọn giọng đọc từ 30 Gemini TTS voices.

```javascript
const { VOICES, VOICE_NAMES, getVoice, pickVoiceForTone } = require('@andy-toolforge/tts-generator');

// Danh sách đầy đủ
console.log(VOICE_NAMES);         // ['Zephyr', 'Puck', 'Charon', ...]
console.log(VOICES.Kore);         // { style: 'Firm', description: 'Assertive...' }

// Tra cứu (case-insensitive)
const v = getVoice('kore');       // → { style: 'Firm', description: '...' }

// Chọn giọng theo tone nội dung
pickVoiceForTone('informative');  // → 'Charon' | 'Iapetus' | 'Sadaltager'
pickVoiceForTone('upbeat');       // → 'Zephyr' | 'Puck' | 'Laomedeia'
pickVoiceForTone('calm');         // → 'Callirrhoe' | 'Umbriel' | 'Vindemiatrix'
pickVoiceForTone('authoritative');// → 'Kore' | 'Orus' | 'Alnilam'
pickVoiceForTone('friendly');     // → 'Achird' | 'Sulafat' | 'Despina'
```

| Tone | Voices |
|------|--------|
| `informative` | Charon, Iapetus, Sadaltager |
| `upbeat` | Zephyr, Puck, Laomedeia |
| `calm` | Callirrhoe, Umbriel, Vindemiatrix |
| `authoritative` | Kore, Orus, Alnilam |
| `friendly` | Achird, Sulafat, Despina |

---

### TTSPlanner

Chia script thành các logical segments cho TTS. Sử dụng LLM (nếu được cung cấp) hoặc fallback regex paragraph splitting.

**Constructor:** `new TTSPlanner({ llm, maxRetries })`

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `llm` | Object | required | LLM-compatible instance với `chat()` method. Nếu không có, dùng regex fallback. |
| `maxRetries` | number | `1` | Số lần retry khi LLM trả về invalid JSON |

**Method: `plan(script, title, options)`**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `script` | string | required | Full script text |
| `title` | string | required | Episode title |
| `options.voice` | string | `'auto'` | Override voice cho tất cả segments |
| `options.language` | string | `'auto'` | Language code (vi, en, auto) |
| `options.pace` | string | `'normal'` | Speed (slow, normal, fast) |

**Return: `{ segments: Segment[], metadata: Metadata }`**

```javascript
const { TTSPlanner } = require('@andy-toolforge/tts-generator');
const planner = new TTSPlanner({ llm });

const plan = await planner.plan(script, 'Tập 1: AI và Tương Lai', {
    voice: 'Charon',
    pace: 'normal',
});

// plan.segments → [
//   { id: 1, text: '...', title: 'Giới thiệu', voice: 'Charon', pace: 'normal',
//     audioTags: ['neutral'], language: 'vi', estimatedDuration: 30 },
//   ...
// ]
// plan.metadata → { totalEstimatedDuration: 300, voiceCount: 1, languages: ['vi'] }
```

**Mỗi segment có cấu trúc:**

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | number | Segment index (1-based) |
| `text` | string | Nội dung text cần TTS |
| `title` | string | Short descriptive title |
| `voice` | string | Voice name hoặc `"auto"` |
| `pace` | string | `"slow"` \| `"normal"` \| `"fast"` |
| `audioTags` | string[] | Expressive tags: `["determination", "whispers"]` |
| `language` | string | `"vi"` \| `"en"` \| `"auto"` |
| `estimatedDuration` | number | Estimated seconds |

---

### TTSGenerator

Gọi Gemini Interactions API để sinh audio từ text segments.

**Constructor:** `new TTSGenerator(config)`

```javascript
const { TTSGenerator } = require('@andy-toolforge/tts-generator');

const gen = new TTSGenerator({
    apiKey: process.env.GEMINI_API_KEY,  // Hoặc set env GEMINI_API_KEY / GOOGLE_API_KEY
    tts: {
        model: 'gemini-3.1-flash-tts-preview',   // Default
        fallback: 'gemini-2.5-flash-preview-tts', // Fallback khi 403
    },
    maxRetries: 2,  // Retries per model
    baseDelay: 1000, // Exponential backoff base (ms)
});
```

| Config | Type | Default | Mô tả |
|--------|------|---------|-------|
| `apiKey` | string | `GEMINI_API_KEY` env | Gemini API key (required) |
| `tts.model` | string | `gemini-3.1-flash-tts-preview` | Primary model |
| `tts.fallback` | string | `gemini-2.5-flash-preview-tts` | Fallback on 403 |
| `maxRetries` | number | `2` | Retries per model |
| `baseDelay` | number | `1000` | Backoff base (ms) |

**Method: `generate(segment)` → `{ id, text, audio: Buffer, voice, format }`**

Sinh audio cho một segment.

```javascript
const result = await gen.generate({
    id: 1,
    text: 'Xin chào các bạn, hôm nay chúng ta sẽ nói về AI.',
    voice: 'Charon',
    audioTags: ['determination'],
});

console.log(result.audio);  // Buffer (WAV)
console.log(result.format); // 'wav'
```

**Method: `generateBatch(segments, options)` → `Array<Result>`**

Sinh audio cho nhiều segments với concurrency control. Failed segments được trả về với `error` property thay vì throw.

```javascript
const results = await gen.generateBatch(plan.segments, { concurrency: 3 });

results.forEach(r => {
    if (r.error) {
        console.error(`Segment ${r.id} failed: ${r.error}`);
    } else {
        console.log(`Segment ${r.id}: ${r.audio.length} bytes`);
    }
});
```

| Option | Type | Default | Mô tả |
|--------|------|---------|-------|
| `concurrency` | number | `3` | Max concurrent API calls |

**Request body format (Interactions API):**

```json
{
  "model": "gemini-3.1-flash-tts-preview",
  "input": "[neutral] Xin chào các bạn...",
  "response_format": { "type": "audio" },
  "generation_config": {
    "speech_config": [{ "voice": "Charon" }]
  }
}
```

Audio tags được nhúng inline dạng `[tag]` markers trong input text. Voice config là array để hỗ trợ multi-speaker.

---

### LiveTTSGenerator

Gọi **Gemini Live API (WebSocket)** để sinh audio từ text segments. Hỗ trợ 3 models Live API với auto-fallback chain.

```javascript
const { LiveTTSGenerator } = require('@andy-toolforge/tts-generator');

const gen = new LiveTTSGenerator({
    apiKey: process.env.GEMINI_API_KEY,
    live: {
        models: [
            'gemini-live-2.5-flash-native-audio',  // Primary
            'gemini-3.1-flash-live-preview',        // Fallback 1
            'gemini-3.5-live-translate-preview',     // Fallback 2
        ],
    },
    maxRetries: 2,
    baseDelay: 1000,
});
```

**Constructor: `new LiveTTSGenerator(config)`**

| Config | Type | Default | Mô tả |
|--------|------|---------|-------|
| `apiKey` | string | `GEMINI_API_KEY` env | Gemini API key (required) |
| `live.models` | string[] | `[gemini-live-2.5-flash-native-audio, gemini-3.1-flash-live-preview, gemini-3.5-live-translate-preview]` | Model chain (auto-fallback) |
| `maxRetries` | number | `2` | Retries per model trước khi fallback |
| `baseDelay` | number | `1000` | Exponential backoff base (ms) |
| `WebSocket` | Function | Native `WebSocket` | Custom WS constructor (cho test) |

**Protocol flow:**

```
Client → Server (WebSocket):
  1. setup:  { model, generationConfig: { responseModalities, speechConfig } }
  2. clientContent: { turns: [{ role, parts }], turnComplete: true }

Server → Client:
  1. setupComplete: {}
  2. serverContent: { modelTurn: { parts: [{ inlineData: { mimeType, data: base64 } }] } }
```

**Method: `generate(segment)` → `{ id, text, audio: Buffer, voice, format }`**

Mở WebSocket → send setup → gửi text → nhận audio chunks → close.

```javascript
const result = await gen.generate({
    id: 1,
    text: 'Xin chào các bạn, hôm nay chúng ta sẽ nói về AI.',
    voice: 'Charon',
});

console.log(result.audio);   // Buffer (WAV/L16)
console.log(result.format);  // 'wav' or 'l16'
```

Audio response có thể là WAV (`audio/wav`) hoặc PCM16 (`audio/L16`) tùy model và config.

**Method: `generateBatch(segments, options)` → `Array<Result>`**

Mở WebSocket riêng cho mỗi segment. Failed segments trả về với `error` property.

```javascript
const results = await gen.generateBatch(plan.segments, { concurrency: 2 });

results.forEach(r => {
    if (r.error) {
        console.error(`Segment ${r.id} failed: ${r.error}`);
    }
});
```

| Option | Type | Default | Mô tả |
|--------|------|---------|-------|
| `concurrency` | number | `2` | Max concurrent WebSocket connections |

**Model fallback chain:**

Khi một model trả về lỗi (quota, rate limit, server error), `LiveTTSGenerator` tự động fallback sang model tiếp theo trong danh sách. Nếu hết model, trả về error.

```javascript
// Auto-fallback: nếu gemini-live-2.5-flash-native-audio bị 429
// → gemini-3.1-flash-live-preview → gemini-3.5-live-translate-preview
```

**Voice config trong Live API:**

```javascript
// Voice được cấu hình qua speechConfig trong setup message:
{
    setup: {
        model: 'models/gemini-live-2.5-flash-native-audio',
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: 'Charon'
                    }
                }
            }
        }
    }
}
```

Các voice tương thích với Live API: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat.

---

### OutputFormatter

Định dạng output từ segments + audio buffers.

```javascript
const { OutputFormatter } = require('@andy-toolforge/tts-generator');
const formatter = new OutputFormatter();
```

**`formatBatch(segments, audioBuffers)`** → `{ segments: Array }`

Trả về mảng segment-audio pairs.

```javascript
const batch = formatter.formatBatch(plan.segments, audioBuffers);
// batch.segments[0] → { id: 1, text: '...', audio: Buffer, voice: 'Charon', duration: 30 }
```

**`formatSingle(audioBuffers)`** → `Buffer`

Nối tất cả audio thành một file duy nhất. WAV-aware: tự động strip RIFF headers từ các file phụ và update size fields.

```javascript
const combined = formatter.formatSingle(audioBuffers);
// combined → Buffer of concatenated WAV audio
```

**`formatStream(segments, audioBuffers)`** → `AsyncGenerator`

Yields từng segment-audio pair dạng async generator.

```javascript
for await (const item of formatter.formatStream(plan.segments, audioBuffers)) {
    console.log(`Segment ${item.id}: ${item.audio.length} bytes`);
}
```

---

## Tutorial: Tạo Podcast Tự Động (A→Z)

```javascript
const { TTSPlanner, TTSGenerator, OutputFormatter } = require('@andy-toolforge/tts-generator');

async function producePodcastAudio(script, title, options = {}) {
    // 1. Segment script
    const planner = new TTSPlanner({ llm: options.llm });
    const plan = await planner.plan(script, title, {
        voice: options.voice || 'auto',
        pace: options.pace || 'normal',
    });
    console.log(`→ ${plan.segments.length} segments, ~${plan.metadata.totalEstimatedDuration}s`);

    // 2. Generate audio
    const gen = new TTSGenerator({
        apiKey: process.env.GEMINI_API_KEY,
        tts: { model: options.model },
    });
    const results = await gen.generateBatch(plan.segments, { concurrency: 3 });

    // Check errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
        console.warn(`⚠ ${errors.length} segments failed:`, errors.map(e => `${e.id}: ${e.error}`));
    }

    // 3. Output
    const formatter = new OutputFormatter();
    const successful = results.filter(r => !r.error);

    const batch = formatter.formatBatch(
        plan.segments.filter(s => !errors.find(e => e.id === s.id)),
        successful.map(r => r.audio),
    );

    const single = formatter.formatSingle(successful.map(r => r.audio));

    return {
        segments: batch.segments,
        combinedAudio: single,
        metadata: plan.metadata,
        errors,
    };
}

// Usage
const result = await producePodcastAudio(
    'Xin chào các bạn...\n\nHôm nay chúng ta sẽ nói về AI...',
    'Tập 1: AI và Cuộc Sống',
    { voice: 'Charon', pace: 'normal' }
);

// Lưu audio
const fs = require('fs');
fs.writeFileSync('podcast.wav', result.combinedAudio);
```

## MCP Tools

Khi dùng với [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp), package này auto-discover 2 tools:

| Tool | Description |
|------|-------------|
| `generate_tts` | Full TTS pipeline: script → planner → TTS → output (batch/single/stream modes) |
| `list_tts_voices` | List all 30 Gemini TTS voices with descriptions and style guides |

Không cần config thêm — tools tự xuất hiện khi MCP server start.

### generate_tts parameters

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `script` | string | required | Full podcast script |
| `title` | string | required | Episode title |
| `voice` | string | `"auto"` | Voice override (30 options) |
| `mode` | string | `"batch"` | `batch` \| `single` \| `stream` |
| `language` | string | `"auto"` | `vi` \| `en` \| `auto` |
| `pace` | string | `"normal"` | `slow` \| `normal` \| `fast` |
| `tags` | string | `""` | Comma-separated audio tags |
| `api_mode` | string | `"interactions"` | `interactions` (REST TTS API) \| `live` (WebSocket Live API) |

## Gemini TTS Voice List (30 voices)

| Voice | Style | Mô tả |
|-------|-------|-------|
| Zephyr | Bright | Energetic, positive — great for introductions |
| Puck | Upbeat | Playful, lively — good for light-hearted segments |
| Charon | Informative | Educational, calm — ideal for explanatory narration |
| Kore | Firm | Assertive, authoritative — strong for persuasive content |
| Fenrir | Excitable | Passionate, enthusiastic — high-energy delivery |
| Leda | Youthful | Fresh, young — good for casual/younger audience |
| Orus | Firm | Steady, grounded — warmer alternative to Kore |
| Aoede | Breezy | Light, airy — effortless narration style |
| Callirrhoe | Easy-going | Relaxed, conversational — natural dialogue feel |
| Autonoe | Bright | Radiant, clear — similar to Zephyr with softer edge |
| Enceladus | Breathy | Intimate — good for emotional/personal segments |
| Iapetus | Clear | Crisp, precise — excellent for technical content |
| Umbriel | Easy-going | Laid-back, unhurried — slow-paced narration |
| Algieba | Smooth | Velvety, polished — luxurious listening experience |
| Despina | Smooth | Silky, flowing — seamless narration flow |
| Erinome | Clear | Bright-clear hybrid — articulate with warmth |
| Algenib | Gravelly | Raspy, textured — distinctive character voice |
| Rasalgethi | Informative | Deep, knowledgeable — authoritative explainer |
| Laomedeia | Upbeat | Bouncy, cheerful — energetic short segments |
| Achernar | Soft | Gentle, whispery — quiet introspective moments |
| Alnilam | Firm | Bold, commanding — strong narrative presence |
| Schedar | Even | Balanced, neutral — consistent all-purpose voice |
| Gacrux | Mature | Seasoned, wise — older authoritative tone |
| Pulcherrima | Forward | Direct, engaging — keeps listener attention |
| Achird | Friendly | Warm, approachable — like a trusted friend |
| Zubenelgenubi | Casual | Informal, everyday — relaxed conversation |
| Vindemiatrix | Gentle | Tender, soothing — calming narration |
| Sadachbia | Lively | Spirited, animated — lively storytelling |
| Sadaltager | Knowledgeable | Well-informed, measured — expert narrator |
| Sulafat | Warm | Rich, inviting — classic storytelling warmth |

## Supported Languages

Gemini TTS hỗ trợ 70+ languages, tự động detect từ input text. Bao gồm:

- **Vietnamese** (vi) — hỗ trợ đầy đủ
- **English** (en) — hỗ trợ đầy đủ
- **Chinese (Mandarin)** (cmn)
- **Japanese** (ja), **Korean** (ko)
- **French** (fr), **German** (de), **Spanish** (es)
- Và nhiều hơn nữa — xem [Google AI TTS docs](https://ai.google.dev/gemini-api/docs/interactions/speech-generation)

## Integration với các packages khác

- **+ [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core):** Cung cấp LLMClient cho TTSPlanner
- **+ [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):** Expose tools qua MCP protocol
- **+ [@andy-toolforge/footage-generation](https://npmjs.com/package/@andy-toolforge/footage-generation):** Kết hợp TTS với image generation cho podcast video

## Architecture

```
Script Text
    │
    ▼
TTSPlanner (LLM + regex fallback)
    │  Chia script → logical segments
    │
    ├─ api_mode: "interactions" ────────────────────────── api_mode: "live" ───
    │                                                                         │
    ▼                                                                         ▼
TTSGenerator (Gemini Interactions REST)          LiveTTSGenerator (Gemini Live WebSocket)
    │  wss://generativelanguage.googleapis.com/       │  wss://...BidiGenerateContent?key=
    │  ws/google.ai.generativelanguage.v1beta.        │
    │  GenerativeService.BidiGenerateContent          │
    │                                                │
    ▼                                                ▼
Audio Buffers (WAV / PCM16)                    Audio Buffers (WAV / L16)
    │                                                │
    └──────────────────┬─────────────────────────────┘
                       ▼
        OutputFormatter.formatBatch()   → { segments: [{ id, text, audio }] }
        OutputFormatter.formatSingle()  → Buffer (concatenated WAV)
        OutputFormatter.formatStream()  → AsyncGenerator<Segment>
```

## API Mode Comparison

| Aspect | Interactions (REST) | Live (WebSocket) |
|--------|--------------------|--------------------|
| Transport | HTTP POST (REST) | WebSocket bidirectional |
| Models | `gemini-*-tts-preview` | `gemini-live-*-native-audio`, `gemini-*-live-*` |
| Audio format | WAV (audio/wav) | WAV or L16 PCM (audio/L16) |
| Voice config | `speech_config[]` array | `speechConfig.voiceConfig.prebuiltVoiceConfig` |
| Audio tags | `[tag]` inline in text | N/A (conversation-based) |
| Multi-speaker | `speech_config[]` objects | Per-turn config |
| Concurrency | HTTP connection pool | Per-segment WebSocket connection |
| Best for | Batch TTS, pre-recorded content | Real-time dialog, interactive voice |

## Live API Models

| Model ID | Description |
|----------|-------------|
| `gemini-live-2.5-flash-native-audio` | Flash model with native audio I/O — best quality TTS |
| `gemini-3.1-flash-live-preview` | Live API variant of Gemini 3.1 Flash — fast, general-purpose |
| `gemini-3.5-live-translate-preview` | Live translation model — supports real-time translation + TTS |

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — Nền tảng LLM client
- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp) — MCP server với plugin discovery
- [Google Gemini TTS API](https://ai.google.dev/gemini-api/docs/interactions/speech-generation) — Official Interactions API docs
- [Google Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api) — Official Live API docs
