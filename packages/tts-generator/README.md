# @andy-toolforge/tts-generator

[![npm](https://img.shields.io/npm/v/@andy-toolforge/tts-generator)](https://npmjs.com/package/@andy-toolforge/tts-generator)
[![License](https://img.shields.io/npm/l/@andy-toolforge/tts-generator)](https://github.com/andy-pham-it/toolforge)

**Text-to-speech generation using Gemini TTS models — script segmentation, multi-voice, batch/stream/single output.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này thay thế hoàn toàn workflow thủ công (chia script trong AI Studio → generate từng đoạn → ghép trong CapCut) bằng một API tự động, hỗ trợ:

- **Smart segmentation:** LLM-based chia script thành các đoạn logical (tự động fallback regex nếu LLM không available)
- **30 Gemini TTS voices:** Từ Zephyr (Bright) đến Sulafat (Warm), mỗi giọng có style riêng
- **Audio tags:** 200+ expressive tags ([whispers], [laughs], [determination]...) để điều khiển giọng đọc
- **3 output modes:** batch (mảng segment-audio pairs), single (concatenated audio), stream (ordered với position metadata)
- **Multi-speaker:** Hỗ trợ đến 2 speakers trong cùng một interaction
- **403 quota fallback:** Tự động fallback từ Gemini 3.1 Flash TTS → 2.5 Flash TTS khi hết quota
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
    TTSGenerator,      // Gemini TTS API client
    OutputFormatter,   // Output formatting (batch/single/stream)
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
    ▼
TTSGenerator (Gemini Interactions API)
    │  Gọi API với rate-limit retry + 403 fallback
    ▼
Audio Buffers (WAV)
    │
    ├─ OutputFormatter.formatBatch()   → { segments: [{ id, text, audio }] }
    ├─ OutputFormatter.formatSingle()  → Buffer (concatenated WAV)
    └─ OutputFormatter.formatStream()  → AsyncGenerator<Segment>
```

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — Nền tảng LLM client
- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp) — MCP server với plugin discovery
- [Google Gemini TTS API](https://ai.google.dev/gemini-api/docs/interactions/speech-generation) — Official API docs
