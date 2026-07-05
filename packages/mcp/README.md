# @andy-toolforge/mcp

[![npm](https://img.shields.io/npm/v/@andy-toolforge/mcp)](https://npmjs.com/package/@andy-toolforge/mcp)
[![License](https://img.shields.io/npm/l/@andy-toolforge/mcp)](https://github.com/andy-pham-it/toolforge)

**MCP (Model Context Protocol) server** cho hệ sinh thái @andy-toolforge. Expose 20+ tools qua MCP protocol để AI agents có thể sử dụng trực tiếp. Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

## Tính năng

- **Plugin discovery** — tự động phát hiện tools từ tất cả `@andy-toolforge/*` packages đã cài
- **20+ tools** — phân tích script, SEO, research, business analysis, book writing
- **`toolforge_suggest`** — LLM-powered router: gõ câu hỏi tự nhiên, server gợi ý đúng tool
- **Không config** — cài package là có tools ngay

## Installation

```bash
npm install @andy-toolforge/mcp
```

Sẽ tự động cài kèm `@andy-toolforge/core` + `@andy-toolforge/footage-generation` + `@andy-toolforge/content-research`.

## Usage

### CLI (standalone)

```bash
export GEMINI_API_KEY="your-key"
npx toolforge-mcp
```

Server nhận diện provider từ env: `GROQ_API_KEY` > `GEMINI_API_KEY`. Có thể set `GROQ_MODEL` / `GEMINI_MODEL`.

### Embed trong code

```javascript
const { createServer } = require('@andy-toolforge/mcp');

const server = createServer({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    // discover: false  // Tắt plugin discovery nếu muốn
});
server.start(); // stdio transport
```

### Cấu hình trong OpenCode / Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "toolforge": {
      "command": "npx",
      "args": ["toolforge-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    }
  }
}
```

## Plugin Discovery — Cách hoạt động

Khi MCP server khởi động:

1. Quét `node_modules/@andy-toolforge/*/mcp-tools.js`
2. Load mỗi file, gọi hàm export với config
3. Nếu tool name trùng với built-in → built-in được ưu tiên (ghi log warning)
4. Lỗi ở một package không ảnh hưởng đến các package khác
5. Cuối cùng, thêm `toolforge_suggest` — LLM router

```javascript
// Cấu trúc một mcp-tools.js điển hình:
module.exports = function(config) {
    return [
        {
            definition: { name: 'my_tool', description: '...', inputSchema: { ... } },
            handler: async (llm, args) => { /* ... */ }
        }
    ];
};
```

### toolforge_suggest

Built-in LLM router tool. Mô tả task bằng ngôn ngữ tự nhiên, server trả về tool phù hợp:

```javascript
// Input: { "task": "Tôi muốn phân tích script podcast mới" }
// Output:
{
  "bestTool": "analyze_script",
  "reason": "Phân tích script podcast → visual segments",
  "suggestedArgs": { "script": "...", "title": "..." }
}
```

## Full Tool List (20+ tools)

### Từ footage-generation (4 tools)

| Tool | Description |
|------|-------------|
| `analyze_script` | Analyze podcast script → visual segments + prompts |
| `generate_prompts` | Generate 5 image prompts per segment (5 visual styles) |
| `generate_mapping` | Map background music + sound design per segment |
| `suggest_cover` | Suggest cover art (series/episode/thumbnail) |

### Từ seo-generation (1 tool)

| Tool | Description |
|------|-------------|
| `toolforge_seo_generate` | Generate SEO metadata for YouTube, TikTok, Facebook |

### Từ content-research (4 tools)

| Tool | Description |
|------|-------------|
| `andy_toolforge_content_summarizer` | Summarize articles/reports via LLM |
| `andy_toolforge_content_ideator` | Generate content ideas |
| `andy_toolforge_article_manager` | Classify, tag, summarize, improve articles |
| `andy_toolforge_competitor_analyzer` | Crawl competitor URL + LLM analysis |

### Từ content-operations (1 tool)

| Tool | Description |
|------|-------------|
| `toolforge_content_research` | Research trends, keywords, competitors, gaps, ideas |

### Từ ba-support (5 tools)

| Tool | Description |
|------|-------------|
| `toolforge_competitor_analysis` | Crawl competitor data + profile |
| `toolforge_pricing_analysis` | Analyze pricing data, strategic insights |
| `toolforge_swot_analysis` | Generate SWOT from competitor data |
| `toolforge_trend_analysis` | Analyze market trends for keywords |
| `toolforge_business_report` | Generate comprehensive business report |

### Từ book-writing (4 tools)

| Tool | Description |
|------|-------------|
| `toolforge_book_outline` | Generate book outline from topic |
| `toolforge_book_write_chapter` | Write a chapter with continuity |
| `toolforge_book_review` | Review manuscript for consistency |
| `toolforge_book_export` | Export to markdown/plain/html |

### Built-in (1 tool)

| Tool | Description |
|------|-------------|
| `toolforge_suggest` | LLM-powered router: mô tả task → gợi ý tool phù hợp |

## Cài thêm tools

```bash
# Install thêm package → tools tự động xuất hiện
npm install @andy-toolforge/ba-support   # +5 tools (competitor, pricing, SWOT, trends, report)
npm install @andy-toolforge/book-writing # +4 tools (outline, write, review, export)
# Không cần config lại MCP server — plugin discovery tự động
```

## API Reference (Embed)

```javascript
const { createServer, MCPServer } = require('@andy-toolforge/mcp');

// createServer(config) — shorthand
const server = createServer({
    apiKey: '...',      // required
    provider: 'gemini',  // 'gemini' | 'groq'
    model: '...',        // override default model
    discover: true,      // false để tắt plugin discovery
});
server.start();

// MCPServer class — full control
const server2 = new MCPServer({ ... });
await server2.start();
```

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — LLMClient used internally
- [Đọc spec đầy đủ](../../docs/andy-toolforge-mcp-spec.md) — Architecture decisions & future plans
- Model Context Protocol — [spec](https://modelcontextprotocol.io/)
