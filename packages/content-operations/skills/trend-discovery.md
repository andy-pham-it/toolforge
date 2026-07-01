---
name: content-operations-trend-discovery
description: Discover content trends for a niche across platforms (YouTube, TikTok, Facebook, Blog). Use when you need to research what topics are trending, find content gaps, analyze competitors, or generate data-backed content ideas for a specific niche and target audience.
---

# Trend Discovery — Content Research

Use `ContentResearcher` to discover trends, analyze keywords, research competitors, find content gaps, and generate content ideas.

## Usage

```javascript
const { ContentResearcher } = require('@andy-toolforge/content-operations');
const { LLMClient } = require('@andy-toolforge/core');

const researcher = new ContentResearcher({
    llmClient: new LLMClient({ provider: 'openai' }),
});
```

## Methods

### discoverTrends(niche, platform, options)
Discover current trends for a niche on a specific platform or across all platforms.

- `niche` (string, required) — e.g. "digital marketing", "cooking"
- `platform` (string, optional) — "youtube" | "tiktok" | "facebook" | "blog" | "all" (default)
- `options.region` (string, optional) — e.g. "US", "VN"
- Returns: `{ trends: [...], niche, platform }`

### analyzeKeywords(niche, language)
Analyze keywords for a niche with volume estimates and difficulty ratings.

- `niche` (string, required)
- `language` (string, default: "vi") — "vi" | "en"
- Returns: `{ primaryKeywords, longTailKeywords, suggestedTags }`

### analyzeCompetitor(url)
Analyze a competitor's content strategy from their URL.

- `url` (string, required)
- Returns: `{ contentStrategy, strengths, weaknesses, estimatedAudience, contentTypeMix, recommendedActions }`

### findContentGaps(niche, competitors)
Find underserved content opportunities in a niche.

- `niche` (string, required)
- `competitors` (string[], optional) — competitor URLs or names
- Returns: `{ gaps, topOpportunities, marketTrend }`

### generateContentIdeas(niche, count)
Generate creative content ideas for a niche.

- `niche` (string, required)
- `count` (number, default: 10, range: 1-50)
- Returns: `{ ideas: [...], niche, count }`

## Example

```javascript
const trends = await researcher.discoverTrends('digital marketing', 'youtube', { region: 'US' });
console.log(trends.trends);
// [{ name: 'AI Marketing', momentum: 'rising', ... }]
```
