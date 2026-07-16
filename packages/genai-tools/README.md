# @andy-toolforge/genai-tools

> Google GenAI SDK tools: search grounding and structured data extraction.

## Features

- **Search-grounding queries** — answer questions with Google Search citations via Gemini
- **Structured extraction** — extract JSON data from unstructured text using `responseSchema`
- **GenAIClient** — lightweight wrapper around `@google/genai` SDK
- **MCP tools** — `search_grounding` and `extract_structured` for agent integration
- **Model selection** — configurable per-call (default: `gemini-3.1-flash-lite`)

## Installation

```bash
npm install @andy-toolforge/genai-tools
```

Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable.

## Exports

| Export | File | Purpose |
|--------|------|---------|
| `GenAIClient` | `lib/genai-client.js` | Gemini API client wrapper |
| `GenAIAdapter` | `lib/genai-adapter.js` | ProviderAdapter — dùng `@google/genai` SDK trong LLMClient adapter chain |
| `searchGrounding` | `lib/tools/search-grounding.js` | Google Search–grounded Q&A |
| `extractStructured` | `lib/tools/extract-structured.js` | Structured JSON extraction via responseSchema |

## Quick Start

### Search Grounding

```javascript
const { GenAIClient, searchGrounding } = require('@andy-toolforge/genai-tools');

const client = new GenAIClient(process.env.GEMINI_API_KEY);
const result = await searchGrounding(client, {
    query: 'Latest developments in AI 2026',
    model: 'gemini-2.5-flash',
});

console.log(result.answer);
// "Google DeepMind announced Gemini 3.1..."

console.log(result.citations);
// [{ title: 'Google AI Blog', uri: '...', snippet: '...' }, ...]
```

### Structured Extraction

```javascript
const { extractStructured } = require('@andy-toolforge/genai-tools');

const result = await extractStructured(client, {
    content: 'Invoice #12345 dated Jan 15, 2026 for $299.99 from Acme Corp',
    schema: {
        type: 'object',
        properties: {
            invoiceNumber: { type: 'string' },
            date: { type: 'string' },
            amount: { type: 'number' },
            vendor: { type: 'string' },
        },
    },
});

console.log(result.data);
// { invoiceNumber: '12345', date: '2026-01-15', amount: 299.99, vendor: 'Acme Corp' }
```

## API Reference

### GenAIAdapter

ProviderAdapter implementation wrapping `@google/genai` SDK. Dùng trong LLMClient adapter chain để gọi Gemini models qua GenAI SDK (không qua REST fetch).

**Constructor:** `new GenAIAdapter(apiKey?)`

| Parameter | Description |
|-----------|-------------|
| `apiKey` | Gemini API key. Falls back to `GEMINI_API_KEY` or `GOOGLE_API_KEY` env vars |

**Ví dụ — dùng trong adapter chain:**

```javascript
const { LLMClient, OpenAIAdapter } = require('@andy-toolforge/core');
const { GenAIAdapter } = require('@andy-toolforge/genai-tools');

const llm = new LLMClient({
    adapters: [
        new GenAIAdapter(process.env.GEMINI_API_KEY),
        new OpenAIAdapter('groq', process.env.GROQ_API_KEY),
    ],
});
```

**So sánh OpenAIAdapter vs GenAIAdapter (Gemini):**

| | OpenAIAdapter | GenAIAdapter |
|--|--------------|--------------|
| Backend | OpenAI-compatible REST API | `@google/genai` SDK |
| Tính năng | Tương thích Groq/OpenAI | Hỗ trợ Gemini-exclusive features |
| Khi nào dùng | Gemini cơ bản + Groq/OpenAI fallback | Gemini-optimized, multi-modal |


### GenAIClient

```javascript
new GenAIClient(apiKey?)
```

| Parameter | Description |
|-----------|-------------|
| `apiKey` | Gemini API key. Falls back to `GEMINI_API_KEY` or `GOOGLE_API_KEY` env vars |

#### Static Methods

| Method | Description |
|--------|-------------|
| `resolveApiKey()` | Returns `GEMINI_API_KEY` or `GOOGLE_API_KEY` from env, or empty string |

#### Instance Methods

| Method | Description |
|--------|-------------|
| `generateContent({ model, prompt, config? })` | Generate content with optional tools/responseSchema config. Returns `{ text, raw }` |

### searchGrounding(client, opts)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `query` | `string` | **required** | Question to answer |
| `model` | `string` | `gemini-3.1-flash-lite` | Model name |

Returns: `Promise<{ answer: string, citations: Array<{title, uri, snippet}>, model: string }>`

### extractStructured(client, opts)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `content` | `string` | **required** | Text to extract data from |
| `schema` | `object` | **required** | JSON Schema for desired output shape |
| `instruction` | `string` | — | Custom extraction instruction |
| `model` | `string` | `gemini-3.1-flash-lite` | Model name |

Returns: `Promise<{ data: object, model: string }>`

## MCP Tools

Auto-discovered by `@andy-toolforge/mcp`:

| Tool | Description |
|------|-------------|
| `search_grounding` | Answer a query using Google Search–grounded Gemini; returns answer with cited sources |
| `extract_structured` | Extract structured JSON data from text using Gemini's `responseSchema` |

## Development

```bash
npm test -w @andy-toolforge/genai-tools
```
