# @andy-toolforge/seo-generation

[![npm](https://img.shields.io/npm/v/@andy-toolforge/seo-generation)](https://npmjs.com/package/@andy-toolforge/seo-generation)
[![License](https://img.shields.io/npm/l/@andy-toolforge/seo-generation)](https://github.com/andy-pham-it/toolforge)

**Tối ưu SEO content cho YouTube, TikTok, Facebook, blog.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Phân tích SEO cho YouTube (title, description, tags, hashtags)
- Tối ưu TikTok và Facebook content
- Repurpose content qua các nền tảng (blog → video → social)
- Publish trực tiếp lên YouTube/TikTok/Facebook qua REST API

## Installation

```bash
npm install @andy-toolforge/seo-generation
```

Yêu cầu `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const {
    SEOAnalyzer,              // YouTube/TikTok/Facebook SEO analysis
    ContentArbitrageEngine,   // Repurpose content across platforms
    MultiPlatformPublisher,   // Publish via REST API
} = require('@andy-toolforge/seo-generation');
```

---

### SEOAnalyzer

Phân tích và tối ưu SEO cho từng nền tảng.

**Constructor:** `new SEOAnalyzer(config)`

**Method: `analyzeYouTube(title, description, tags)`**

| Param | Type | Mô tả |
|-------|------|-------|
| `title` | string | Video title |
| `description` | string | Video description |
| `tags` | string[] | Array of tags |

**Return:** `{ suggestions, checks, score }`

Phân tích:
- Keyword có xuất hiện trong 2 dòng đầu description không?
- Độ dài description (200-500 chars tối ưu)
- Số lượng tags (3-5 tối ưu)
- Hashtags trong description

**Ví dụ:**

```javascript
const { SEOAnalyzer } = require('@andy-toolforge/seo-generation');

const seo = new SEOAnalyzer();
const result = await seo.analyzeYouTube(
    'Cách làm giàu từ chứng khoán',
    'Hướng dẫn đầu tư chứng khoán cho người mới...',
    ['chứng khoán', 'đầu tư', 'làm giàu']
);

console.log(result.suggestions);
// ["Include primary keyword in first 2 lines of description"]
console.log(result.score); // 85/100
```

Tương tự: `analyzeTikTok(content)`, `analyzeFacebook(content)`.

---

### ContentArbitrageEngine

Repurpose content across platforms: tối ưu nội dung cho từng nền tảng.

**Method: `plan(content, sourcePlatform)`**

| Param | Type | Mô tả |
|-------|------|-------|
| `content` | string | Original content |
| `sourcePlatform` | string | Nền tảng gốc (blog, youtube, tiktok) |

**Return:** Platform-specific adaptations (title, description, format)

```javascript
const engine = new ContentArbitrageEngine(llm);
const plan = await engine.plan('Blog post about AI...', 'blog');
// → adaptations for YouTube, TikTok, Facebook
```

---

### MultiPlatformPublisher

Publish content lên YouTube, TikTok, Facebook qua REST API.

```javascript
const publisher = new MultiPlatformPublisher({ apiKey: '...' });
await publisher.publish('youtube', { title: '...', video: buffer, description: '...' });
```

---

## MCP Tools

Khi dùng với [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):

| Tool | Description |
|------|-------------|
| `toolforge_seo_generate` | Generate SEO metadata (title, description, tags, hashtags) cho video/audio |

## Integration

- **+ [@andy-toolforge/footage-generation](https://npmjs.com/package/@andy-toolforge/footage-generation):** Phân tích script → sinh visuals → SEO metadata → publish
- **+ [@andy-toolforge/content-research](https://npmjs.com/package/@andy-toolforge/content-research):** Research topic → SEO optimization

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core)
- [@andy-toolforge/footage-generation](https://npmjs.com/package/@andy-toolforge/footage-generation)
- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp)
