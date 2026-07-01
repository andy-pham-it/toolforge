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
