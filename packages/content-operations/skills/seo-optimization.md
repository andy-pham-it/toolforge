---
name: content-operations-seo-optimization
description: Optimize content for search engines across platforms. Use when you need to improve content SEO scores, analyze keyword density, get optimization recommendations, or optimize content for specific platforms like blogs, YouTube, or social media.
---

# SEO Optimization — Content Creation

Use `ContentCreator` to optimize content for search engines with keyword analysis, scoring, and actionable recommendations.

## Usage

```javascript
const { ContentCreator } = require('@andy-toolforge/content-operations');
const { LLMClient } = require('@andy-toolforge/core');

const creator = new ContentCreator({
    llmClient: new LLMClient({ provider: 'openai' }),
});
```

## Methods

### optimizeForSEO(content, platform, keywords)
Analyze and optimize content for SEO with scoring and recommendations.

- `content` (string, required)
- `platform` (string, default: "blog") — "blog" | "youtube" | "web"
- `keywords` (string[], optional) — target SEO keywords
- Returns: `{ optimizedContent, seoScore, improvements, keywordDensity, missingElements, recommendations }`

### writeBlogPost(topic, options)
Write SEO-optimized blog posts with meta descriptions, slug, and keyword tracking.

See [Blog Writing](skills/content-operations-blog-writing.md) for details.

## SEO Best Practices

The module follows these principles:

1. **Keyword density**: Primary keyword 1-2%, secondary keywords naturally placed
2. **Meta description**: 150-160 characters with keyword + CTA
3. **Content structure**: Proper H1/H2/H3 hierarchy
4. **Readability**: Short paragraphs, bullet points, clear headings
5. **Internal linking**: Related content references where appropriate

## Example

```javascript
const result = await creator.optimizeForSEO(
    'Your blog content here...',
    'blog',
    ['content marketing', 'digital strategy']
);
console.log(`SEO Score: ${result.seoScore}/100`);
console.log('Improvements:', result.improvements);
```

## 📋 Prerequisites

- `LLMClient` instance with valid API key
- Base content to optimize (cannot optimize from scratch — use `writeBlogPost` or `writeScript` first)
- Optional: target keyword list for focused optimization

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Low SEO score (<30) | Content too short or no keywords | Provide more detailed content or explicit keywords |
| Platform unsupported | Invalid platform string | Use: "blog" \| "youtube" \| "web" |
| Missing recommendations | Content already well-optimized | That's OK — score should be high |

## 🔗 Integration

- **MCP tool:** `toolforge_content_research` — use for keyword research before optimization
- **Domain packages:** Optimized content can be published via `ContentDistributor` or analyzed via `ContentAnalytics`
- **Cross-domain:** Use `@andy-toolforge/seo-generation`'s `SEOAnalyzer` for platform-specific metadata (YouTube, TikTok, Facebook)

## 📚 Related Skills

- `content-operations-script-writing` — create base content first
- `content-operations-blog-writing` — create SEO-optimized blog posts
- `content-operations-performance-analysis` — measure SEO impact
- `seo-generation-hub` — platform-specific SEO metadata
- `andy-toolforge` (MCP Bridge) — invoke via `skill_mcp`
