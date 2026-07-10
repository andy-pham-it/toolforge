---
name: content-operations-script-writing
description: Write video scripts for YouTube, TikTok, podcasts, and shorts. Use when you need to create engaging video scripts with hooks, segment breakdowns, and calls-to-action for any topic and platform format.
---

# Script Writing — Content Creation

Use `ContentCreator` to write video scripts, generate hashtags, create thumbnail ideas, and write social media posts.

## Usage

```javascript
const { ContentCreator } = require('@andy-toolforge/content-operations');
const { LLMClient } = require('@andy-toolforge/core');

const creator = new ContentCreator({
    llmClient: new LLMClient({ provider: 'openai' }),
});
```

## Methods

### writeScript(topic, duration, format)
Write a timed video script with hooks, segments, and CTA.

- `topic` (string, required)
- `duration` (number, required, range: 15-3600) — seconds
- `format` (string, default: "youtube") — "youtube" | "tiktok" | "podcast" | "short"
- Returns: `{ hook, segments: [...], callToAction, estimatedWordCount, keyTakeaways }`

### writeSocialPost(content, platform, tone)
Repurpose content into a platform-optimized social media post.

- `content` (string, required)
- `platform` (string, default: "facebook") — "facebook" | "twitter" | "linkedin" | "instagram" | "tiktok"
- `tone` (string, default: "professional") — "professional" | "casual" | "humorous"
- Returns: `{ post, hashtags, bestPostingTime, characterCount, tips }`

### generateHashtags(topic, platform, count)
Generate platform-optimized hashtags for a topic.

- `topic` (string, required)
- `platform` (string, default: "tiktok") — "tiktok" | "instagram" | "facebook" | "twitter" | "linkedin" | "youtube"
- `count` (number, default: 5, range: 1-30)
- Returns: `{ hashtags, categories: { highVolume, niche, brand }, recommendation }`

### generateThumbnailIdeas(topic, platform)
Generate creative thumbnail design ideas for video content.

- `topic` (string, required)
- `platform` (string, default: "youtube") — "youtube" | "tiktok" | "instagram" | "facebook"
- Returns: `{ ideas: [...], topPick, compositionTips }`

## Example

```javascript
const script = await creator.writeScript('How to edit videos', 120, 'youtube');
console.log(script.hook);
// "Want to edit videos like a pro in just 2 minutes?"
```

## 📋 Prerequisites

- `LLMClient` instance with valid API key (Groq or Gemini)
- Topic and target format must be specified
- For timed scripts, provide accurate duration in seconds (15–3600)

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `LLMClient` times out | API key invalid or quota exceeded | Check API key, try different provider |
| Script too short for duration | Insufficient topic detail | Provide richer topic description |
| Platform format unsupported | Custom format string | Use: "youtube" \| "tiktok" \| "podcast" \| "short" |

## 🔗 Integration

- **MCP tool:** `toolforge_content_research` (`packages/mcp/lib/tools/content-research.js`) can research trending topics before script writing
- **Domain packages:** Results feed into `ContentPlanner` for calendar scheduling, or `ContentDistributor` for publishing
- **Skill chain:** See `content-operations-hub.md` for the full content lifecycle

## 📚 Related Skills

- `content-operations-trend-discovery` — research topics before writing
- `content-operations-blog-writing` — alternative format for written content
- `content-operations-editorial-calendar` — plan scripts into a calendar
- `andy-toolforge` (MCP Bridge) — invoke script writing via `skill_mcp`
