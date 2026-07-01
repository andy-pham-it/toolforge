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
