---
name: content-operations-content-repurposing
description: Repurpose content across multiple platforms and formats. Use when you need to adapt existing content (blog, video, podcast) for different platforms, schedule batch publishing, or create cross-platform distribution strategies.
---

# Content Repurposing — Distribution

Use `ContentDistributor` to repurpose content, schedule batch publishing, cross-post across platforms, and generate repurpose plans.

## Usage

```javascript
const { ContentDistributor } = require('@andy-toolforge/content-operations');
const { LLMClient } = require('@andy-toolforge/core');

const distributor = new ContentDistributor({
    llmClient: new LLMClient({ provider: 'openai' }),
});
```

## Methods

### repurposeContent(source, targetPlatforms)
Adapt existing content for multiple platforms with platform-specific adjustments.

- `source` (string, required) — original content text
- `targetPlatforms` (string[], required) — e.g. ["youtube", "blog", "twitter"]
- Returns: `{ platformPlans: [...], crossPromotionIdeas, bestPlatform, notes }`

### batchSchedule(contents, schedule)
Schedule multiple content pieces for automated publishing.

- `contents` (array, required) — array of `{ title, content }` objects
- `schedule.timeSlot` (string, default: "09:00")
- `schedule.timezone` (string, default: "Asia/Ho_Chi_Minh")
- `schedule.intervalHours` (number, default: 24)
- Returns: `{ scheduled: [...], timezone, totalItems }`

### crossPost(platforms, content)
Adapt a single piece of content for simultaneous cross-platform posting.

- `platforms` (string[], required) — e.g. ["twitter", "linkedin", "facebook"]
- `content` (string, required)
- Returns: `{ adaptations: [...], postingOrder, optimalTimes, warnings }`

### generateRepurposePlan(source, targetFormats)
Create a step-by-step plan to repurpose content into different formats.

- `source` (string, required)
- `targetFormats` (string[], required) — e.g. ["blog", "social", "infographic"]
- Returns: `{ plan: [...], quickestWins, totalEstimatedTime, recommendations }`

## Example

```javascript
const result = await distributor.repurposeContent(
    'Long-form blog about AI trends...',
    ['youtube', 'twitter', 'linkedin']
);
console.log(result.bestPlatform);
// "YouTube"
```
