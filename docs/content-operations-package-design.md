# Content Operations Package — Design Spec

> Package: `@andy-toolforge/content-operations`  
> Status: Design  
> Version: 1.0.0  
> Date: 2026-07-01

---

## 1. Purpose

Automate end-to-end content operations for individual creators and small teams: from researching content ideas and planning a calendar, through writing and optimizing content, repurposing it across platforms, and analyzing performance to feed back into the next cycle.

The package follows the Toolforge monorepo conventions (CommonJS, single dependency on `@andy-toolforge/core`, skill file mechanism, node --test).

---

## 2. Architecture Overview

### 2.1 Five-Phase Pipeline

```
Research & Discovery ──→ Strategy & Planning ──→ Creation & Optimization
       │                                                      │
       └───────────────────── Cycle ──────────────────────────┘
       │                                                      │
       │                     Analysis & Iteration ←── Repurposing & Distribution
```

| Phase | Module | Purpose |
|-------|--------|---------|
| 1 | `researcher.js` | Discover trending topics, keywords, competitor content |
| 2 | `planner.js` | Build editorial calendars, content strategies, batch plans |
| 3 | `creator.js` | Generate, optimize, and format content (blogs, scripts, posts) |
| 4 | `distributor.js` | Repurpose content across platforms, schedule distribution |
| 5 | `analytics.js` | Track performance, generate insights, feed back to Phase 1 |

### 2.2 Dependency Direction

```
@andy-toolforge/core
  └── @andy-toolforge/content-operations
        ├── lib/researcher.js    → core::BrowserManager, core::LLMClient
        ├── lib/planner.js       → core::Logger
        ├── lib/creator.js       → core::LLMClient
        ├── lib/distributor.js   → core::BrowserManager, core::JobQueue
        └── lib/analytics.js     → core::Logger
```

No dependency between content-operations and any other domain package.

---

## 3. Module Specifications

### 3.1 `lib/researcher.js` — Research & Discovery

```javascript
class ContentResearcher {
    constructor(config)
    async discoverTrends(niche, platform, options)
    async analyzeKeywords(niche, language)
    async analyzeCompetitor(url)
    async findContentGaps(niche, competitors)
    async generateContentIdeas(niche, count)
}
```

| Method | Input | Output | Dependencies |
|--------|-------|--------|-------------|
| `discoverTrends` | niche, platform ('youtube'|'tiktok'|'google'), options | Trending topics with metadata | BrowserManager, LLMClient |
| `analyzeKeywords` | niche, language | Keyword list: volume, difficulty, related | LLMClient |
| `analyzeCompetitor` | competitor URL | Content strategy report | BrowserManager, LLMClient |
| `findContentGaps` | niche, competitor list | Gap analysis: topics competitors cover but we don't | LLMClient |
| `generateContentIdeas` | niche, count | Content idea list with angle, format suggestion | LLMClient |

**Edge cases:**
- Empty niche → throw `ContentResearcherError` with message "Niche is required"
- Unsupported platform → throw with supported list
- Competitor URL unreachable → log warning via core::Logger, return partial results
- Identical results across consecutive calls → append timestamp to force diversity

---

### 3.2 `lib/planner.js` — Strategy & Planning

```javascript
class ContentPlanner {
    constructor(config)
    async buildCalendar(niche, frequency, options)
    async createContentStrategy(niche, goals)
    async generateBatchPlan(calendar, weekRange)
    async suggestOptimalTimes(targetAudience, platforms)
}
```

| Method | Input | Output |
|--------|-------|--------|
| `buildCalendar` | niche, frequency (posts/week), options | Monthly editorial calendar (date, topic, format, platform, status) |
| `createContentStrategy` | niche, goals (brand awareness, engagement, sales) | Strategy doc: pillars, channels, KPIs, milestones |
| `generateBatchPlan` | calendar, week range | Batch production plan grouping similar content types |
| `suggestOptimalTimes` | target audience, platforms | Best posting times per platform |

**Edge cases:**
- frequency=0 → throw "Frequency must be > 0"
- Empty calendar input for `generateBatchPlan` → return empty array
- Overlapping topics in same week → deduplicate with different angle
- Target audience descriptor too vague → use defaults (e.g., "general" → 9am-5pm weekday)

---

### 3.3 `lib/creator.js` — Creation & Optimization

```javascript
class ContentCreator {
    constructor(config)
    async writeBlogPost(topic, options)
    async writeScript(topic, duration, format)
    async writeSocialPost(content, platform, tone)
    async optimizeForSEO(content, platform, keywords)
    async generateHashtags(topic, platform, count)
    async generateThumbnailIdeas(topic, platform)
    async expandOutline(outline, depth)
    async suggestHeadlines(keywords, count)
}
```

| Method | Input | Output |
|--------|-------|--------|
| `writeBlogPost` | topic, options (tone, length, keywords) | Blog post with title, meta, H1-H2-H3 structure, body |
| `writeScript` | topic, duration, format (educational/entertaining/promotional) | Script with timestamps, B-roll suggestions |
| `writeSocialPost` | content, platform, tone | Platform-optimized post (caption, hashtags, CTA) |
| `optimizeForSEO` | content, platform, keywords | Optimized version with SEO suggestions |
| `generateHashtags` | topic, platform, count | Hashtag set: trending + niche + branded |
| `generateThumbnailIdeas` | topic, platform | Thumbnail concepts with composition description |
| `expandOutline` | outline, depth | Expanded outline with sub-sections, key points |
| `suggestHeadlines` | keyword list, count | Headline options with click-through potential score |

**Edge cases:**
- topic empty → throw "Topic is required"
- duration < 30s for script → flag as "short" format, limit to hook + 1 key point
- Unsolicited platform → throw with supported platforms
- content exceeds platform max length → truncate with ellipsis, log warning
- LLM returns incomplete JSON → retry once, fall back to partial results with error log
- SEO optimization on content < 50 chars → warn via Logger, return unchanged

---

### 3.4 `lib/distributor.js` — Repurposing & Distribution

```javascript
class ContentDistributor {
    constructor(config)
    async repurposeContent(source, targetPlatforms)
    async batchSchedule(contents, schedule)
    async crossPost(platforms, content)
    async generateRepurposePlan(source, targetFormats)
}
```

| Method | Input | Output |
|--------|-------|--------|
| `repurposeContent` | source (blog/script/post), target platforms | Platform-specific adaptations |
| `batchSchedule` | content items, schedule (datetime per item) | Scheduled items with status |
| `crossPost` | platforms, content | Cross-posted content per platform |
| `generateRepurposePlan` | source, target formats (blog→thread, script→blog, etc.) | Repurposing plan with transformation steps |

**Edge cases:**
- source type unknown → throw "Unsupported source type"
- targetPlatforms empty → throw "At least one target platform required"
- Schedule conflicts (same content to same platform same day) → deduplicate, keep latest
- cross-platform content length mismatch (e.g., 5000-char blog → Twitter) → smart truncate with link
- LLM transform fails → retry once with simpler output schema

---

### 3.5 `lib/analytics.js` — Analysis & Iteration

```javascript
class ContentAnalytics {
    constructor(config)
    async generatePerformanceReport(contentIds, period)
    async identifyTrends(historicalData)
    async generateInsights(report)
    async recommendOptimizations(insights)
}
```

| Method | Input | Output |
|--------|-------|--------|
| `generatePerformanceReport` | content IDs, period | Performance metrics per content item |
| `identifyTrends` | historical data (array of performance snapshots) | Trend patterns (rising, declining, seasonal) |
| `generateInsights` | report data | Actionable insights with priority |
| `recommendOptimizations` | insights | Specific optimization suggestions for future content |

**Edge cases:**
- contentIds empty → throw "At least one content ID required"
- period < 7 days → warn "Sample too small for reliable trends"
- No historical data → return "insufficient data" with suggestions to collect
- All metrics flat → return "no significant changes detected"

---

## 4. Skill Files (7 files)

### 4.1 `content-operations-trend-discovery.md` (skill for researcher)
Agent skill: discover trending topics in a niche using automated browser research + LLM analysis.

### 4.2 `content-operations-editorial-calendar.md` (skill for planner)
Agent skill: build and maintain an editorial calendar with content pillars, frequency, and platform mix.

### 4.3 `content-operations-blog-writing.md` (skill for creator)
Agent skill: write SEO-optimized blog posts with proper structure, tone, and keyword placement.

### 4.4 `content-operations-script-writing.md` (skill for creator)
Agent skill: write video/podcast scripts with hooks, timestamps, and visual suggestions.

### 4.5 `content-operations-content-repurposing.md` (skill for distributor)
Agent skill: repurpose a single content piece across multiple platforms (blog→social, video→blog, etc.).

### 4.6 `content-operations-seo-optimization.md` (skill for creator)
Agent skill: optimize existing content for search engines on YouTube, Google, and social platforms.

### 4.7 `content-operations-performance-analysis.md` (skill for analytics)
Agent skill: analyze content performance data, extract insights, and recommend improvements.

---

## 5. MCP Tools

The package registers MCP tools via the existing `@andy-toolforge/mcp` server infrastructure.

### `content-operations_analyze_niche`
- **Input:** niche, platform (optional), language
- **Output:** Trend analysis, keyword suggestions, content gap report
- **Delegates to:** `ContentResearcher.discoverTrends()` + `ContentResearcher.analyzeKeywords()`

### `content-operations_generate_calendar`
- **Input:** niche, frequency, start date, duration
- **Output:** Editorial calendar as structured data
- **Delegates to:** `ContentPlanner.buildCalendar()`

### `content-operations_write_content`
- **Input:** topic, format (blog|script|social), tone, keywords, length
- **Output:** Generated content with metadata
- **Delegates to:** `ContentCreator.writeBlogPost()` / `ContentCreator.writeScript()` / `ContentCreator.writeSocialPost()`

### `content-operations_optimize_seo`
- **Input:** content, platform, keywords
- **Output:** SEO-optimized content with suggestions
- **Delegates to:** `ContentCreator.optimizeForSEO()`

### `content-operations_repurpose`
- **Input:** source content, source type, target platforms
- **Output:** Adapted content per target platform
- **Delegates to:** `ContentDistributor.repurposeContent()`

---

## 6. Error Handling

### 6.1 Custom Error Classes

```javascript
class ContentOperationsError extends Error {          // Base
    constructor(message, code, details)
}
class ContentResearcherError extends ContentOperationsError { code: 'RESEARCHER_ERROR' }
class ContentPlannerError extends ContentOperationsError { code: 'PLANNER_ERROR' }
class ContentCreatorError extends ContentOperationsError { code: 'CREATOR_ERROR' }
class ContentDistributorError extends ContentOperationsError { code: 'DISTRIBUTOR_ERROR' }
class ContentAnalyticsError extends ContentOperationsError { code: 'ANALYTICS_ERROR' }
```

### 6.2 Error Response Format

```javascript
{
    error: true,
    code: 'RESEARCHER_ERROR',
    message: 'Unsupported platform: snapchat. Supported: youtube, tiktok, google.',
    details: { ... }
}
```

---

## 7. File Tree

```
packages/content-operations/
├── lib/
│   ├── index.js              — Export all classes
│   ├── researcher.js         — ContentResearcher class
│   ├── researcher.test.js    — Tests
│   ├── planner.js            — ContentPlanner class
│   ├── planner.test.js       — Tests
│   ├── creator.js            — ContentCreator class
│   ├── creator.test.js       — Tests
│   ├── distributor.js        — ContentDistributor class
│   ├── distributor.test.js   — Tests
│   ├── analytics.js          — ContentAnalytics class
│   ├── analytics.test.js     — Tests
│   └── errors.js             — Error classes
├── skills/
│   ├── postinstall.js        — Symlink skill files
│   ├── content-operations-trend-discovery.md
│   ├── content-operations-editorial-calendar.md
│   ├── content-operations-blog-writing.md
│   ├── content-operations-script-writing.md
│   ├── content-operations-content-repurposing.md
│   ├── content-operations-seo-optimization.md
│   └── content-operations-performance-analysis.md
├── templates/                — (future)
└── package.json
```

---

## 8. Edge Cases & Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | All LLM calls go through core::LLMClient, never direct fetch | Consistency, rate limiting, provider switching |
| 2 | `ContentPlanner` uses Logger only (no LLM) | Calendar logic is structural, not creative |
| 3 | `ContentAnalytics` uses Logger only | Analytics is math/reporting, LLM adds hallucination risk |
| 4 | Skill files prefixed `content-operations-*` | Consistent with existing convention (footage-generation-*, seo-*) |
| 5 | All methods throw typed errors | Enables upstream handling vs. catch-all |
| 6 | Browser-based research is optional | Some users may only want LLM-powered research |
| 7 | Constructor config is { logger, llmClient, browserManager } | Consistent with other domain packages |
| 8 | Test file per module | Same convention as core (llm.test.js) |

---

## 9. Implementation Order (Recommended)

1. **errors.js** — Base error classes
2. **researcher.js** — Most independent, LLM + Browser only
3. **planner.js** — No external dependencies besides Logger
4. **creator.js** — Core writing module (heaviest)
5. **distributor.js** — Depends on creator patterns
6. **analytics.js** — Most independent but requires usage data
7. **Skills** — After each lib module for testability
8. **MCP tools** — After all lib modules stabilize
9. **postinstall.js** + **package.json** + root workspace update
