# @andy-toolforge/core

[![npm](https://img.shields.io/npm/v/@andy-toolforge/core)](https://npmjs.com/package/@andy-toolforge/core)
[![License](https://img.shields.io/npm/l/@andy-toolforge/core)](https://github.com/andy-pham-it/toolforge)

**Toolforge foundation package.** Cung cấp 4 dịch vụ nền tảng: LLM client, browser automation, structured logger, và job queue. Tất cả domain packages (`footage-generation`, `ba-support`, `book-writing`, ...) đều dựa trên package này.

> ⚠️ **Quan trọng:** Core KHÔNG chứa domain-specific logic (không có `analyzeScript`, `generateXxx`). Những method đó nằm trong domain package's LLMClient subclass.

## Installation

```bash
npm install @andy-toolforge/core
```

## API Reference

---

### LLMClient

Generic LLM client với multi-provider routing. Supports Gemini, Groq, OpenAI qua unified API.

**Constructor params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `provider` | string | `'gemini'` | `'gemini'` \| `'groq'` \| `'openai'` |
| `apiKey` | string | (required) | API key từ provider |
| `model` | string | Provider default | Tên model |
| `maxRetries` | number | `3` | Số lần retry tối đa |
| `baseDelay` | number | `2000` | Base delay cho exponential backoff (ms) |

**Phương thức:**

| Method | Params | Returns | Mô tả |
|--------|--------|---------|-------|
| `chat()` | `systemPrompt, userPrompt, jsonMode?, fetchFn?` | `Promise<string>` | Gửi chat completion. Nếu `jsonMode=true` yêu cầu JSON response |

**Providers hỗ trợ:**

| Provider | API Key Env | Model mặc định | Khi nào dùng |
|----------|-------------|----------------|--------------|
| **Gemini** | `GEMINI_API_KEY` | `gemini-2.0-flash` | Mặc định. Tốc độ cao, free tier hào phóng |
| **Groq** | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Inference cực nhanh. Tốt cho real-time |
| **OpenAI** | `OPENAI_API_KEY` | Provider default | Khi cần GPT-4 quality |

**Ví dụ cơ bản:**

```javascript
const { LLMClient } = require('@andy-toolforge/core');

const llm = new LLMClient({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
});

// Chat thông thường
const reply = await llm.chat('Bạn là trợ lý tiếng Việt', 'Xin chào!');
console.log(reply);

// JSON mode — response sẽ là JSON string
const json = await llm.chat(
    'Return JSON with { name, age }',
    'Tôi tên là An, 25 tuổi',
    true   // jsonMode
);
const data = JSON.parse(json);
console.log(data.name); // "An"
```

**Ví dụ với error handling:**

```javascript
try {
    const reply = await llm.chat('System prompt', 'User message');
} catch (err) {
    if (err.message.includes('429')) {
        // Rate limited — để LLMClient tự retry (mặc định 3 lần)
        console.error('Still failing after retries, consider reducing rate');
    } else if (err.message.includes('401')) {
        console.error('Invalid API key — check your env vars');
    } else {
        console.error('LLM call failed:', err.message);
    }
}
```

---

### BrowserManager

Puppeteer browser lifecycle management. Singleton-safe: chỉ launch một browser duy nhất.

**Constructor params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `headless` | boolean | `true` | Chạy headless (không UI) |

**Phương thức:**

| Method | Returns | Mô tả |
|--------|---------|-------|
| `launch()` | `Promise<Browser>` | Khởi động Puppeteer browser |
| `close()` | `Promise<void>` | Đóng browser |
| `newPage()` | `Promise<Page>` | Tạo page mới (tự động launch nếu chưa có) |

**Ví dụ — crawl một trang web:**

```javascript
const { BrowserManager } = require('@andy-toolforge/core');

const browser = new BrowserManager({ headless: true });
const page = await browser.newPage();
await page.goto('https://example.com', { waitUntil: 'networkidle2' });

const title = await page.title();
const content = await page.content();

console.log('Title:', title);
await browser.close();
```

**Lưu ý:**
- Cần cài Puppeteer (`puppeteer` là peer dependency)
- Trên macOS/Linux, Puppeteer tự động download Chromium
- Gọi `close()` sau khi dùng xong để giải phóng tài nguyên

---

### Logger

Structured logging với 4 levels. Output ra console với timestamp + context.

**Constructor params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `level` | string | `'info'` | `'debug'` \| `'info'` \| `'warn'` \| `'error'` |
| (name) | string | optional | Tên logger (hiển thị trong log) |

**Phương thức:**

| Method | Params | Mô tả |
|--------|--------|-------|
| `debug()` | `message, context?` | Chỉ hiển thị khi level = debug |
| `info()` | `message, context?` | Thông tin thông thường |
| `warn()` | `message, context?` | Cảnh báo |
| `error()` | `message, error?` | Lỗi |

**Ví dụ:**

```javascript
const { Logger } = require('@andy-toolforge/core');

const log = new Logger('MyApp', 'debug');
// Hoặc: new Logger({ level: 'info' });

log.debug('Connecting to DB', { host: 'localhost', port: 5432 });
log.info('Server started', { port: 3000 });
log.warn('Rate limit approaching', { requestsLeft: 10 });
log.error('Failed to connect', err);
// Output: [2026-07-05T10:30:00.000Z] [INFO] MyApp: Server started {"port":3000}
```

---

### JobQueue

In-memory async FIFO job queue. Tạo, theo dõi, và quản lý jobs.

**Phương thức:**

| Method | Params | Returns | Mô tả |
|--------|--------|---------|-------|
| `create()` | `params` | `Job` | Tạo job mới, trả về job object |
| `get()` | `id` | `Job \| undefined` | Lấy job theo ID |
| `update()` | `id, updates` | `void` | Cập nhật job state |
| `list()` | `filter?` | `Job[]` | Liệt kê jobs, có thể filter |
| `remove()` | `id` | `void` | Xoá job |

**Job object:**

```javascript
{
    id: 'uuid',
    state: 'pending' | 'running' | 'done' | 'failed',
    currentStep: null,
    completedSteps: [],
    params: { ... },
    error: null,
    startTime: 'ISO date',
}
```

**Ví dụ:**

```javascript
const { JobQueue } = require('@andy-toolforge/core');

const queue = new JobQueue();

// Tạo jobs
const job1 = queue.create({ type: 'scrape', url: 'https://example.com' });
const job2 = queue.create({ type: 'process', file: 'data.csv' });

// List jobs đang pending
const pending = queue.list({ state: 'pending' });

// Cập nhật job progress
queue.update(job1.id, { state: 'running' });
queue.update(job1.id, { state: 'done', completedSteps: ['scrape'] });
```

---

## Error Handling Checklist

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|-------------|
| LLM không response | API key sai | Kiểm tra `GEMINI_API_KEY` / `GROQ_API_KEY` env |
| LLM trả về 429 | Rate limit | LLMClient tự retry, tăng `baseDelay` nếu cần |
| LLM trả về error | Network error | `maxRetries: 5` + kiểm tra network |
| Browser không launch | Puppeteer chưa cài | `npm install puppeteer` |
| Browser page crash | Memory | Gọi `browser.close()` giữa các lần crawl |

## Related

- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp) — MCP server dùng LLMClient
- [@andy-toolforge/footage-generation](https://npmjs.com/package/@andy-toolforge/footage-generation) — Extends LLMClient với domain methods
- [@andy-toolforge/content-research](https://npmjs.com/package/@andy-toolforge/content-research) — Extends LLMClient cho research tasks
