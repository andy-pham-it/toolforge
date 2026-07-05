# Toolforge — Personal Automation Toolbox

[![npm (scoped)](https://img.shields.io/badge/npm-@andy--toolforge-red)](https://www.npmjs.com/org/andy-toolforge)

**Monorepo chứa 10+ package npm dùng chung cho mọi dự án automation cá nhân.**
Triết lý: **Không copy-paste code.** Thay vào đó, mọi dự án đều import từ `@andy-toolforge/*` và được cập nhật qua `npm update`.

Toolforge giải quyết vấn đề gì?
- Bạn có nhiều dự án automation (podcast, content, SEO, research) và thấy mình copy code `llm.js` giữa các dự án
- Bạn muốn một bộ công cụ chung: LLM client, browser, logger, job queue
- Bạn muốn từng package được test, publish, và version riêng

---

## Tính năng tổng quan (Feature Overview)

Toolforge không chỉ là "thư viện LLM" — nó là **hệ sinh thái automation** bao gồm:

### 🤖 Trí tuệ nhân tạo (Core)
- **LLMClient** — Gọi Gemini, Groq, OpenAI qua unified API. Retry + exponential backoff, JSON mode.
- **BrowserManager** — Puppeteer browser lifecycle. Dùng để crawl, scrape, screenshot.
- **Logger** — Structured logging với level (debug/info/warn/error).
- **JobQueue** — Async FIFO queue với concurrency control.

### 🎬 Sản xuất Podcast/Video (footage-generation)
- Phân tích script podcast → sinh visual segments
- Sinh prompt cho image generation (5 styles: Surrealist, Lineart, Infographic...)
- Map nhạc nền + sound design theo segment
- Gợi ý cover art (series, episode, thumbnail)

### 📈 SEO & Content (seo-generation + content-research)
- Phân tích SEO cho YouTube, TikTok, Facebook
- Sinh tiêu đề, description, tags, hashtags
- Content arbitrage: repurpose content qua các nền tảng
- Tóm tắt nội dung, sinh ý tưởng, quản lý article
- Phân tích competitor từ URL (crawl + LLM analysis)

### 📋 Content Operations (content-operations)
- Research trends theo niche + platform
- Keyword analysis, gap analysis
- Content planning, creation, distribution, analytics
- Linter content: audit markdown files theo required sequence

### 💼 Business Analysis (ba-support)
- Crawl competitor profiles
- Phân tích pricing data
- SWOT analysis từ competitor data
- Track market trends theo keywords
- Sinh business report (markdown/plain)

### 📚 Viết sách (book-writing)
- Sinh outline từ topic
- Viết chapter với continuity check
- Review manuscript (consistency, contradictions, repetition)
- Export sang markdown / plain / HTML

### 📊 Project Management (pm-support)
- Quản lý project & tasks
- Time tracking
- Sinh reports và invoices

### 🔧 Code Analysis (coding-support)
- Đếm dòng code (LOC) theo glob patterns
- Tìm dead code (exports không được require)
- Sinh dependency graph
- Complexity report (functions, decisions, nesting depth)

---

## Packages

| Package | npm | Mô tả | Dùng cho |
|---------|-----|-------|----------|
| `@andy-toolforge/core` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/core)](https://npmjs.com/package/@andy-toolforge/core) | LLM, Browser, Logger, Queue | Mọi dự án |
| `@andy-toolforge/footage-generation` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/footage-generation)](https://npmjs.com/package/@andy-toolforge/footage-generation) | Sinh ảnh/video cho podcast | Content creators |
| `@andy-toolforge/seo-generation` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/seo-generation)](https://npmjs.com/package/@andy-toolforge/seo-generation) | SEO cho YouTube, TikTok, blog | SEO specialists |
| `@andy-toolforge/content-research` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/content-research)](https://npmjs.com/package/@andy-toolforge/content-research) | Nghiên cứu: tóm tắt, ý tưởng, article | Content teams |
| `@andy-toolforge/content-operations` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/content-operations)](https://npmjs.com/package/@andy-toolforge/content-operations) | Content ops lifecycle | Content ops |
| `@andy-toolforge/ba-support` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/ba-support)](https://npmjs.com/package/@andy-toolforge/ba-support) | Competitor, SWOT, pricing, trends | Business analysts |
| `@andy-toolforge/book-writing` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/book-writing)](https://npmjs.com/package/@andy-toolforge/book-writing) | Viết sách: outline → chapter → review → export | Authors |
| `@andy-toolforge/pm-support` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/pm-support)](https://npmjs.com/package/@andy-toolforge/pm-support) | Task tracking, reports, invoices | PMs |
| `@andy-toolforge/coding-support` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/coding-support)](https://npmjs.com/package/@andy-toolforge/coding-support) | Code analysis, dead code, complexity | Developers |
| `@andy-toolforge/mcp` | [![npm](https://img.shields.io/npm/v/@andy-toolforge/mcp)](https://npmjs.com/package/@andy-toolforge/mcp) | MCP server — plugin discovery | AI agents |

---

## Workflow Examples (End-to-End)

### 🎙️ Sản xuất Podcast Episode

```
Script (text) 
  → @andy-toolforge/mcp phân tích script (analyze_script)
  → Sinh visual segments + image prompts
  → Map nhạc nền (generate_mapping)
  → Gợi ý cover art (suggest_cover)
  → @andy-toolforge/seo-generation sinh SEO metadata
  → Publish lên YouTube/TikTok/Facebook (MultiPlatformPublisher)
```

Trong code:
```javascript
const { createServer } = require('@andy-toolforge/mcp');
const { SEOAnalyzer } = require('@andy-toolforge/seo-generation');

// MCP server auto-discovers footage-generation tools
const server = createServer({ provider: 'gemini', apiKey });

// Trực tiếp dùng footage-generation API
const { LLMClient } = require('@andy-toolforge/footage-generation');
const llm = new LLMClient({ provider: 'gemini', apiKey });

// Bước 1: Phân tích script → segments
const segments = await llm.analyzeScript(script, 'Episode 1', 'Outline...');

// Bước 2: Sinh SEO metadata
const seo = new SEOAnalyzer({ apiKey });
const metadata = await seo.analyzeYouTube(title, description, ['tag1', 'tag2']);
```

### 📊 Nghiên cứu Thị trường & Đối thủ

```
Competitor URLs 
  → @andy-toolforge/ba-support crawlCompetitor()
  → Array<profile> → swotAnalysis()
  → trackTrends() cho keywords
  → generateReport() → Markdown report
```

```javascript
const { MarketResearcher } = require('@andy-toolforge/ba-support');
const { LLMClient } = require('@andy-toolforge/core');

const llm = new LLMClient({ provider: 'gemini', apiKey });
const researcher = new MarketResearcher({ llmClient: llm });

// Crawl competitor
const profile = await researcher.crawlCompetitor('https://competitor.com');

// SWOT
const swot = await researcher.swotAnalysis([profile]);

// Report
const report = await researcher.generateReport({ swot, profile });
```

### 📚 Viết sách từ A→Z

```
Topic 
  → generateOutline() → Array<Chapter>
  → writeChapter(1), writeChapter(2), ... → với continuity check
  → reviewConsistency() → issues + score
  → exportFormat('markdown' | 'html')
```

```javascript
const { BookWriter } = require('@andy-toolforge/book-writing');
const llm = new LLMClient({ provider: 'gemini', apiKey });
const writer = new BookWriter({ llmClient: llm });

const outline = await writer.generateOutline('Lập trình với Node.js', 8);
let prevContent = '';
for (let i = 1; i <= outline.chapters.length; i++) {
    const chapter = await writer.writeChapter(outline, i, prevContent);
    prevContent = chapter.slice(-500);
}
const review = await writer.reviewConsistency({ title: outline.title, chapters });
const book = await writer.exportFormat({ title: outline.title, chapters }, 'html');
```

---

## Architecture

```
@andy-toolforge/core           ←  Nền tảng (LLM, Browser, Logger, Queue)
       ↑
┌──────┴─────────┐
│ Domain packages │  ←  Mỗi package chỉ phụ thuộc vào core
│                 │     Không phụ thuộc lẫn nhau
│ footage-gen     │
│ seo-gen         │
│ content-research│
│ content-ops     │
│ ba-support      │
│ book-writing    │
│ pm-support      │
│ coding-support  │
└─────────────────┘
       ↓
@andy-toolforge/mcp            ←  Tự động phát hiện mcp-tools.js từ domain packages
```

### LLMClient Hierarchy

- **Core** (`@andy-toolforge/core/lib/llm.js`): `LLMClient` — generic `chat()` với provider routing (Gemini, Groq, OpenAI). Retry + exponential backoff + full-jitter.
- **Domain** (`@andy-toolforge/<domain>/lib/llm.js`): Extends Core, thêm method domain-specific (ví dụ `analyzeScript()` trong footage-generation), đọc skill files từ `.opencode/skills/`.

Rule: **KHÔNG thêm domain logic vào core.** Core chỉ có `chat()`. Mọi method domain-specific (analyzeScript, generateCoverPrompts) nằm ở domain package.

---

## MCP Server

`@andy-toolforge/mcp` là MCP server với **plugin discovery**. Khi bạn cài bất kỳ `@andy-toolforge/*` nào, nếu package đó có `mcp-tools.js`, MCP server tự động phát hiện và expose tool qua MCP protocol.

```bash
# CLI (standalone)
export GEMINI_API_KEY="your-key"
npx toolforge-mcp
```

```javascript
// Embed trong code
const { createServer } = require('@andy-toolforge/mcp');
const server = createServer({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });
server.start(); // stdio transport
```

Hiện tại có **20+ tools** được auto-discover từ 6 domain packages. Xem chi tiết tại [packages/mcp/README.md](./packages/mcp/README.md).

---

## Quick Start

```bash
# Trong project của bạn
npm install @andy-toolforge/core
npm install @andy-toolforge/mcp    # nếu muốn MCP server
```

```javascript
const { LLMClient, Logger } = require('@andy-toolforge/core');

const log = new Logger({ level: 'info' });
const llm = new LLMClient({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
});

const reply = await llm.chat('Bạn là AI assistant', 'Xin chào!');
log.info('LLM reply', { reply });
```

---

## Development

```bash
# Clone & install
git clone <repo-url>
cd toolforge
npm install

# Test tất cả packages
npm test --workspaces

# Test một package
npm test -w @andy-toolforge/core

# Thêm package mới
mkdir packages/<name>
# ... code ...
# Thêm vào workspaces trong root package.json
```

### CI/CD

GitHub Actions tự động publish lên npmjs khi push lên `main`:

- `.github/workflows/publish.yml` — build, test, publish tất cả packages
- Cần `NPM_TOKEN` secret (npm Automation token với quyền read+write) trong GitHub repo settings

---

## Documentation

| File | Mô tả |
|------|-------|
| `docs/architecture.md` | Kiến trúc chi tiết & design decisions |
| `docs/andy-toolforge-mcp-spec.md` | MCP server spec |
| `packages/*/README.md` | Hướng dẫn chi tiết từng package |
| `packages/*/AGENTS.md` | AI agent context cho từng domain |

> **Personal use only.** Không designed cho open-source contribution.
