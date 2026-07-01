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
