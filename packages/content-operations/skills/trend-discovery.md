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

## 📋 Prerequisites

- `LLMClient` instance with valid API key
- For competitor analysis: valid competitor URL accessible from the network
- For keyword analysis: specify language (`"vi"` or `"en"`) matching the target audience

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Competitor URL unreachable | URL invalid or site blocks crawlers | Verify URL, try a different competitor URL |
| No trend data returned | Niche too narrow or platform-specific | Broaden niche or remove platform filter |
| Low-quality keyword suggestions | Language mismatch | Ensure `language` param matches niche's primary language |

## 🔗 Integration

- **MCP tool:** `toolforge_content_research` (`packages/mcp/lib/tools/content-research.js`) — use via `skill_mcp` for quick research without code
- **Domain packages:** Research output feeds `ContentPlanner` for calendar building and `ContentCreator` for script writing
- **Skill chain:** Trend discovery → Script writing → Performance analysis

## 📚 Related Skills

- `content-operations-script-writing` — turn discovered trends into scripts
- `content-operations-editorial-calendar` — schedule trend-based content
- `content-operations-performance-analysis` — measure trend performance
- `content-operations-hub` — overview of all content-ops workflows
- `andy-toolforge` (MCP Bridge) — invoke via `skill_mcp`
