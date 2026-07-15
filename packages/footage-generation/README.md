# @andy-toolforge/footage-generation

[![npm](https://img.shields.io/npm/v/@andy-toolforge/footage-generation)](https://npmjs.com/package/@andy-toolforge/footage-generation)
[![License](https://img.shields.io/npm/l/@andy-toolforge/footage-generation)](https://github.com/andy-pham-it/toolforge)

**Image and video generation toolkit for podcasts and content creation.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Phân tích script podcast → chia thành visual segments với image prompts
- Sinh prompt cho image generation (5 visual styles)
- Overlay text lên ảnh (dùng sharp)
- Map nhạc nền + sound design cho từng segment
- Gợi ý cover art cho series/episode/thumbnail

## Installation

```bash
npm install @andy-toolforge/footage-generation
```

Yêu cầu: `sharp` (xử lý ảnh) và `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const {
    ImageGenerator,    // Sinh ảnh/video từ prompts
    TextOverlayer,     // Overlay text lên ảnh
    PromptWriter,      // Quản lý prompt templates
    LLMClient,         // LLMClient mở rộng với domain methods (analyzeScript, generateCoverPrompts)
    Imagen4Generator,  // Google Imagen 4 image generation (3 model tiers, quota tracking)
    MODEL_TIERS,       // { FAST, GENERATE, ULTRA } — model tier identifiers
} = require('@andy-toolforge/footage-generation');
```

---

### LLMClient

Extends `@andy-toolforge/core`'s LLMClient với các method domain-specific. Tự động load skill files từ `.opencode/skills/`.

**Method: `analyzeScript()`**

Phân tích podcast script, trả về mảng visual segments.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `script` | string | required | Full script text |
| `title` | string | required | Episode title |
| `outline` | string | `''` | Optional outline |
| `density` | number | `2` | Images per segment (1-5) |
| `lang` | string | `'vi'` | Language code (vi/en) |

**Return: `Array<Segment>`**

```javascript
[
  {
    id: 1,
    title: 'Giới thiệu',
    summary: 'Mở đầu về chủ đề...',
    visualType: 'Surrealist', // Surrealist | Lineart | Comparison | Typography | Infographic
    startTime: '00:00',
    endTime: '02:30',
    prompts: {
      a: 'A surreal landscape...',
      b: 'Close-up of...',
      c: 'Abstract visualization...',
      d: 'Split screen comparison...',
      e: 'Infographic showing...'
    },
    editSuggestions: {
      zoom: 'Slow zoom in',
      context: 'Cut to speaker',
      mood: 'Mysterious'
    }
  }
]
```

**Ví dụ:**

```javascript
const { LLMClient } = require('@andy-toolforge/footage-generation');

const llm = new LLMClient({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });
const segments = await llm.analyzeScript(
    'Xin chào các bạn, hôm nay chúng ta sẽ nói về...',
    'Tập 1: Khởi đầu',
    '1. Giới thiệu\n2. Nội dung chính\n3. Kết luận',
    3,  // 3 images per segment
    'vi'
);

// segments[0].prompts.a → prompt cho image đầu tiên
```

**Method: `generateCoverPrompts()`**

Sinh cover art prompts cho series + chapters.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `title` | string | required | Episode/series title |
| `outline` | string | `''` | Chapter outline |
| `lang` | string | `'vi'` | Language code |

**Return:**

```javascript
{
  seriesCover: { prompt: '...', style: '...' },
  chapterCovers: [
    { chapter: 1, title: 'Chương 1', prompt: '...', style: '...' },
    // ...
  ]
}
```

---

### ImageGenerator

Spawn image/video generation từ prompts.

**Constructor:** `new ImageGenerator({ outputDir })`

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `outputDir` | string | required | Thư mục output |

**Method: `generate()`**

| Param | Type | Mô tả |
|-------|------|-------|
| `prompt` | string | Image generation prompt |
| `count` | number | Số lượng ảnh (default: 1) |

```javascript
const { ImageGenerator } = require('@andy-toolforge/footage-generation');
const gen = new ImageGenerator({ outputDir: './output' });
await gen.generate({ prompt: 'A serene mountain landscape at sunset', count: 3 });
```

---

### TextOverlayer

Overlay text lên ảnh (via sharp).

**Method: `overlay()`**

| Param | Type | Mô tả |
|-------|------|-------|
| `imagePath` | string | Path ảnh gốc |
| `text` | string | Text cần overlay |
| `outputPath` | string | Path ảnh output |

```javascript
const { TextOverlayer } = require('@andy-toolforge/footage-generation');
const overlay = new TextOverlayer();
await overlay.overlay('input.jpg', 'Hello World', 'output.jpg');
```

---

### PromptWriter

Quản lý prompt templates. Load template từ thư mục `templates/` và substitute variables.

```javascript
const { PromptWriter } = require('@andy-toolforge/footage-generation');
const writer = new PromptWriter();
const prompt = writer.buildPrompt('podcast-intro', { title: 'Tập 1', guest: 'John' });
```

---

### Imagen4Generator

Google Imagen 4 image generation với 3 model tiers, tự động routing visual style và quota tracking (25 requests/day per tier).

> Yêu cầu: `GOOGLE_API_KEY` hoặc `GEMINI_API_KEY` environment variable.

**Constructor:** `new Imagen4Generator(options)`

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `apiKey` | string | `GOOGLE_API_KEY` | Google AI API key |
| `aspectRatio` | string | `'16:9'` | Aspect ratio (`16:9`, `9:16`, `1:1`, `3:4`, `4:3`) |
| `language` | string | `'vi'` | Language code |
| `onProgress` | function | `null` | Progress callback `({current, total, name, status, file, error})` |
| `signal` | AbortSignal | `null` | AbortController signal |

**Visual Type → Model Tier routing:**

| Visual Type | Model Tier | Use case |
|-------------|-----------|----------|
| `Typography`, `Infographic` | **Fast** (`imagen-4.0-fast-generate-001`) | Text-heavy, simple graphics |
| `Lineart`, `Comparison` | **Generate** (`imagen-4.0-generate-001`) | Moderate illustrations |
| `Surrealist`, `Portrait`, `Scene` | **Ultra** (`imagen-4.0-ultra-generate-001`) | Complex creative, photorealistic |

```javascript
const { Imagen4Generator, MODEL_TIERS } = require('@andy-toolforge/footage-generation');

// Generate single image
const gen = new Imagen4Generator();
const result = await gen.generateImage('A serene mountain landscape at sunset', 'Surrealist');
fs.writeFileSync('output.png', result.imageBytes);
// → result: { imageBytes: Buffer, model: 'imagen-4.0-ultra-generate-001', raiReason: null }

// Batch generate from segments
const batchResult = await gen.generateBatch([
    { name: 'intro', prompt: 'Mountain landscape', visualType: 'Surrealist' },
    { name: 'chart', prompt: 'Bar chart showing growth', visualType: 'Infographic' },
], './output');
// → batchResult: { successCount, totalCount, skippedCount, results }

// Check quota
console.log(gen.getQuota());
// → { 'imagen-4.0-fast-generate-001': { used: 2, limit: 25, remaining: 23 }, ... }
```

**MODEL_TIERS:**

```javascript
MODEL_TIERS.FAST     // 'imagen-4.0-fast-generate-001'
MODEL_TIERS.GENERATE // 'imagen-4.0-generate-001'
MODEL_TIERS.ULTRA    // 'imagen-4.0-ultra-generate-001'
```

---

## Tutorial: Sản xuất Podcast Episode (A→Z)

```javascript
const { LLMClient } = require('@andy-toolforge/footage-generation');

async function producePodcast(script, title, outline) {
    const llm = new LLMClient({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });

    // Bước 1: Phân tích script → segments
    console.log('🔍 Analyzing script...');
    const segments = await llm.analyzeScript(script, title, outline, 2, 'vi');
    console.log(`→ ${segments.length} segments detected`);

    // Bước 2: Sinh cover art
    console.log('🎨 Generating cover art...');
    const covers = await llm.generateCoverPrompts(title, outline, 'vi');
    console.log(`→ Series cover + ${covers.chapterCovers.length} chapter covers`);

    return { segments, covers };
}

// Dùng với MCP server
const { createServer } = require('@andy-toolforge/mcp');
const server = createServer({ provider: 'gemini', apiKey });
// Tools: analyze_script, generate_prompts, generate_mapping, suggest_cover
// được auto-discover từ package này
```

## MCP Tools

Khi dùng với [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp), package này cung cấp:

| Tool | Description |
|------|-------------|
| `analyze_script` | Analyze podcast script → visual segments + prompts |
| `generate_prompts` | Generate 5 image prompts per segment (Surrealist, Lineart, Comparison, Typography, Infographic) |
| `generate_mapping` | Map background music + sound design per segment |
| `suggest_cover` | Suggest cover art (series/episode/thumbnail) + generation prompt |

Các tools được auto-discover khi MCP server start — không cần config thêm.

## Integration với các packages khác

- **+ [@andy-toolforge/seo-generation](https://npmjs.com/package/@andy-toolforge/seo-generation):** Phân tích script → sinh SEO metadata cho YouTube/TikTok
- **+ [@andy-toolforge/content-research](https://npmjs.com/package/@andy-toolforge/content-research):** Nghiên cứu nội dung → phát triển thành script → sinh visuals
- **+ [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):** Expose tools qua MCP protocol cho AI agents

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — Nền tảng LLM client
- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp) — MCP server với plugin discovery
- [sharp](https://sharp.pixelplumbing.com/) — Image processing library
