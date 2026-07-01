---
name: content-operations-blog-writing
description: Write and optimize blog posts with AI. Use when you need to create SEO-optimized blog content, expand outlines, generate headlines, or produce full articles for a given topic and target audience.
---

# Blog Writing — Content Creation

Use `ContentCreator` to write blog posts, expand outlines, suggest headlines, and optimize for SEO.

## Usage

```javascript
const { ContentCreator } = require('@andy-toolforge/content-operations');
const { LLMClient } = require('@andy-toolforge/core');

const creator = new ContentCreator({
    llmClient: new LLMClient({ provider: 'openai' }),
});
```

## Methods

### writeBlogPost(topic, options)
Write a complete blog post with SEO metadata.

- `topic` (string, required)
- `options.wordCount` (number, default: 1500)
- `options.tone` (string, default: "informative") — "informative" | "conversational" | "professional"
- `options.language` (string, default: "vi") — "vi" | "en"
- `options.targetAudience` (string, optional)
- `options.seoKeywords` (string[], optional)
- Returns: `{ title, metaDescription, slug, content, estimatedReadingTime, keywordsUsed }`

### expandOutline(outline, depth)
Expand a content outline to specified detail depth.

- `outline` (string, required)
- `depth` (number, default: 2, range: 1-4)
- Returns: `{ expandedOutline, sections: [...], totalEstimatedWords }`

### suggestHeadlines(keywords, count)
Generate compelling headlines based on keywords.

- `keywords` (string[], required)
- `count` (number, default: 5, range: 1-20)
- Returns: `{ headlines: [...], bestPick, tips }`

## Example

```javascript
const post = await creator.writeBlogPost('Cách học tiếng Anh tại nhà', {
    wordCount: 2000,
    tone: 'informative',
    language: 'vi',
    seoKeywords: ['học tiếng Anh', 'tự học'],
});
```
