# @andy-toolforge/content-research

[![npm](https://img.shields.io/npm/v/@andy-toolforge/content-research)](https://npmjs.com/package/@andy-toolforge/content-research)
[![License](https://img.shields.io/npm/l/@andy-toolforge/content-research)](https://github.com/andy-pham-it/toolforge)

**Nghiên cứu nội dung đa nền tảng.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Tóm tắt articles, reports, content dài
- Sinh ý tưởng content theo topic + audience + format
- Quản lý article lifecycle (classify, tag, summarize, improve)
- Phân tích competitor websites (crawl + LLM analysis)

## Installation

```bash
npm install @andy-toolforge/content-research
```

Yêu cầu: `puppeteer` (cho competitor crawl), `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const {
    ContentSummarizer,   // Tóm tắt nội dung
    ContentIdeator,      // Sinh ý tưởng content
    ArticleManager,      // Quản lý article lifecycle
    CompetitorAnalyzer,  // Phân tích competitor (crawl + LLM)
    LLMClient,           // LLMClient mở rộng với domain methods
} = require('@andy-toolforge/content-research');
```

---

### ContentSummarizer

Tóm tắt articles, reports, hoặc bất kỳ nội dung nào.

**Constructor:** `new ContentSummarizer({ provider, apiKey, model? })`

| Method | Params | Returns | Mô tả |
|--------|--------|---------|-------|
| `summarize()` | `content, title, lang` | `Promise<string>` | Tóm tắt nội dung |

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `content` | string | required | Full content text |
| `title` | string | required | Title của content |
| `lang` | string | `'vi'` | Language code |

**Ví dụ:**

```javascript
const { ContentSummarizer } = require('@andy-toolforge/content-research');

const summarizer = new ContentSummarizer({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
});

const summary = await summarizer.summarize(
    'Long article content here...',
    'Article Title',
    'vi'
);
console.log(summary);
```

---

### ContentIdeator

Sinh ý tưởng content dựa trên topic, audience, format.

**Constructor:** `new ContentIdeator({ provider, apiKey, model? })`

| Method | Params | Returns | Mô tả |
|--------|--------|---------|-------|
| `generate()` | `topic, audience, format, numIdeas?, lang?` | `Promise<string>` | Sinh ý tưởng |

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `topic` | string | required | Chủ đề |
| `audience` | string | required | Đối tượng mục tiêu |
| `format` | string | required | Format (blog post, video, social) |
| `numIdeas` | number | `3` | Số ý tưởng (1-10) |
| `lang` | string | `'vi'` | Language code |

**Ví dụ:**

```javascript
const { ContentIdeator } = require('@andy-toolforge/content-research');

const ideator = new ContentIdeator({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });
const ideas = await ideator.generate(
    'Làm giàu từ đầu tư chứng khoán',
    'Người mới bắt đầu, 25-35 tuổi',
    'blog post',
    5,
    'vi'
);
console.log(ideas);
```

---

### ArticleManager

Quản lý article lifecycle với các actions: classify, tag, summarize, improve, full.

**Constructor:** `new ArticleManager({ provider, apiKey, model? })`

| Method | Params | Returns | Mô tả |
|--------|--------|---------|-------|
| `processArticle()` | `articleContent, articleTitle, action, lang?` | `Promise<string>` | Xử lý article |

**Actions:**

| Action | Mô tả |
|--------|-------|
| `classify` | Phân loại article (chủ đề, thể loại) |
| `tag` | Gợi ý tags |
| `summarize` | Tóm tắt article |
| `improve` | Đề xuất cải thiện |
| `full` | Làm tất cả |

---

### CompetitorAnalyzer

Phân tích competitor website: crawl nội dung → LLM analysis (dùng Puppeteer).

**Constructor:** `new CompetitorAnalyzer({ provider, apiKey, model? })`

| Method | Params | Returns | Mô tả |
|--------|--------|---------|-------|
| `analyze()` | `competitorUrl, analysisScope, lang?` | `Promise<string>` | Crawl + analyze |

| Param | Type | Mô tả |
|-------|------|-------|
| `competitorUrl` | string | URL của competitor |
| `analysisScope` | string | Scope (full, content, seo, social) |
| `lang` | string | Language code (default: 'vi') |

---

## Tutorial: Research Workflow

```javascript
const { ContentSummarizer, ContentIdeator, CompetitorAnalyzer } = require('@andy-toolforge/content-research');

const config = { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY };

async function researchWorkflow(topic, competitorUrl) {
    const summarizer = new ContentSummarizer(config);
    const ideator = new ContentIdeator(config);
    const analyzer = new CompetitorAnalyzer(config);

    // Bước 1: Phân tích đối thủ
    console.log('🔍 Analyzing competitor...');
    const insights = await analyzer.analyze(competitorUrl, 'full', 'vi');

    // Bước 2: Tóm tắt insights
    console.log('📝 Summarizing...');
    const summary = await summarizer.summarize(insights, 'Competitor Analysis', 'vi');

    // Bước 3: Sinh ý tưởng content
    console.log('💡 Generating ideas...');
    const ideas = await ideator.generate(topic, 'Content creators', 'blog post', 5, 'vi');

    return { insights, summary, ideas };
}
```

## MCP Tools

Khi dùng với [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp), package này cung cấp:

| Tool | Description |
|------|-------------|
| `andy_toolforge_content_summarizer` | Summarize articles, reports via LLM |
| `andy_toolforge_content_ideator` | Generate content ideas |
| `andy_toolforge_article_manager` | Classify, tag, summarize, improve articles |
| `andy_toolforge_competitor_analyzer` | Crawl competitor URL + LLM analysis |

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — Nền tảng LLM client
- [@andy-toolforge/content-operations](https://npmjs.com/package/@andy-toolforge/content-operations) — Content ops lifecycle (research → plan → create → distribute → analyze)
- [@andy-toolforge/ba-support](https://npmjs.com/package/@andy-toolforge/ba-support) — Business analysis (competitor, SWOT, pricing)
