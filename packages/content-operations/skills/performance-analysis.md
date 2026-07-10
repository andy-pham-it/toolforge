---
name: content-operations-performance-analysis
description: Analyze content performance, identify trends, and generate optimization recommendations. Use when you need to evaluate content metrics, track performance trends, generate insights from data, or get actionable recommendations to improve content strategy.
---

# Performance Analysis — Analytics

Use `ContentAnalytics` to analyze content performance, identify trends, generate insights, and recommend optimizations.

## Usage

```javascript
const { ContentAnalytics } = require('@andy-toolforge/content-operations');

const analytics = new ContentAnalytics();
```

## Methods

### generatePerformanceReport(contentIds, period)
Generate a performance report for specific content pieces.

- `contentIds` (string[], required)
- `period.start` (string, optional) — ISO date
- `period.end` (string, optional) — ISO date
- Returns: `{ contentIds, period, metrics: { totalViews, totalEngagement, averageCompletionRate, shareRate }, topPerformers, generatedAt }`

### identifyTrends(historicalData)
Identify performance trends from historical data.

- `historicalData` (array, optional) — array of data points with metrics
- Returns: `{ trends: [{ metric, direction, changePercent, confidence }], summary }`

### generateInsights(report)
Generate actionable insights from a performance report.

- `report` (object, required) — from `generatePerformanceReport`
- Returns: `{ insights: [...], topInsight, generatedAt }`

### recommendOptimizations(insights)
Generate optimization recommendations based on data insights.

- `insights` (object, required) — from `generateInsights`
- Returns: `{ recommendations: [{ category, action, expectedImpact, effort }], priority }`

## Example

```javascript
const report = await analytics.generatePerformanceReport(
    ['post-1', 'post-2', 'post-3'],
    { start: '2026-01-01', end: '2026-06-30' }
);
const insights = await analytics.generateInsights(report);
const optimizations = await analytics.recommendOptimizations(insights);
console.log(optimizations.priority);
```

## 📋 Prerequisites

- `ContentAnalytics` instance (no `LLMClient` needed for basic metrics — only for insights/recommendations)
- Content IDs from your CMS or tracking system
- Historical data for trend identification (optional, auto-collects if omitted)

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Empty metrics returned | Invalid content IDs or no data in period | Verify content IDs exist and period has data |
| Trend detection fails | Insufficient historical data | Provide more data points or longer period |
| Insights generation fails | Missing LLMClient | Pass an `LLMClient` instance or skip to manual analysis |

## 🔗 Integration

- **MCP tool:** `toolforge_content_research` — use to fuel research before content creation, then measure results with analytics
- **Domain packages:** Pair with `ContentPlanner` to adjust strategy based on performance data
- **Cross-domain:** Combine with `pm-support`'s `TaskTracker` to track optimization tasks

## 📚 Related Skills

- `content-operations-editorial-calendar` — plan content to measure later
- `content-operations-seo-optimization` — apply recommendations
- `content-operations-hub` — full content lifecycle
- `pm-support-hub` — track optimization tasks
- `andy-toolforge` (MCP Bridge) — invoke via `skill_mcp`
