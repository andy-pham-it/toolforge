---
name: content-operations-editorial-calendar
description: Build editorial calendars and content strategies. Use when you need to plan content publishing schedules, create content strategies, generate batch production plans, or find optimal posting times for a niche across platforms.
---

# Editorial Calendar — Content Planning

Use `ContentPlanner` to build editorial calendars, create strategies, generate batch plans, and optimize posting schedules.

## Usage

```javascript
const { ContentPlanner } = require('@andy-toolforge/content-operations');
const { LLMClient } = require('@andy-toolforge/core');

const planner = new ContentPlanner({
    llmClient: new LLMClient({ provider: 'openai' }),
});
```

## Methods

### buildCalendar(niche, frequency, options)
Build a content calendar for a niche with specified publishing frequency.

- `niche` (string, required)
- `frequency` (string, default: "weekly") — "daily" | "weekly" | "monthly"
- `options.period` (string, optional) — e.g. "Q3 2026"
- Returns: `{ calendar: [...], niche, frequency }`

### createContentStrategy(niche, goals)
Create a comprehensive content strategy for a niche.

- `niche` (string, required)
- `goals` (string[], optional) — e.g. ["brand awareness", "lead generation"]
- Returns: `{ mission, targetAudience, contentPillars, recommendedFormats, publishingCadence, distributionChannels, successMetrics, competitiveAngle }`

### generateBatchPlan(calendar, weekRange)
Generate a batch production plan from a calendar.

- `calendar` (array, required) — calendar items from `buildCalendar`
- `weekRange` (number, default: 1)
- Returns: `{ plan: { productionOrder, dependencies, totalEstimatedHours, bottlenecks, recommendations } }`

### suggestOptimalTimes(targetAudience, platforms)
Suggest optimal posting times for a target audience.

- `targetAudience` (string, required) — e.g. "small business owners in Vietnam"
- `platforms` (string[], optional) — e.g. ["youtube", "tiktok", "facebook"]
- Returns: `{ recommendations: [...], generalAdvice }`

## Example

```javascript
const calendar = await planner.buildCalendar('digital marketing', 'weekly');
const strategy = await planner.createContentStrategy('digital marketing', ['lead gen']);
```

## 📋 Prerequisites

- `LLMClient` instance with valid API key (required for strategy generation)
- Defined niche and publishing frequency
- Optional: target audience description for optimal timing suggestions

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Calendar generation fails | Niche too vague | Provide more specific niche (e.g. "AI tools for small business" vs "technology") |
| Strategy lacks differentiation | Niche too broad | Narrow to specific angle or audience segment |
| Batch plan bottlenecks | All content in same format | Mix formats (video, blog, social) in calendar entries |

## 🔗 Integration

- **MCP tool:** `toolforge_content_research` — research trends before building calendar
- **Domain packages:** Calendar entries become briefs for `ContentCreator` and `ContentDistributor`
- **Skill chain:** Trend discovery → Calendar → Script/Blog writing → SEO optimization → Distribution → Performance analysis

## 📚 Related Skills

- `content-operations-trend-discovery` — research before planning
- `content-operations-script-writing` — execute calendar items
- `content-operations-content-repurposing` — distribute planned content
- `content-operations-performance-analysis` — measure calendar effectiveness
- `andy-toolforge` (MCP Bridge) — invoke via `skill_mcp`
