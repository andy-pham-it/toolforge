# @andy-toolforge/content-operations — Content Operations

> Domain package covering the full content lifecycle: research, plan, create, distribute, analyze, and linter checks.

## Structure

```
packages/content-operations/
  lib/
    index.js      — Entry: exports 6 classes
    researcher.js — ContentResearcher  Research trending topics, collect source material
    planner.js    — ContentPlanner  Build content calendars, schedule posts
    creator.js    — ContentCreator  Generate content from plans via LLM
    distributor.js— ContentDistributor  Push content to platforms
    analytics.js  — ContentAnalytics  Track performance, generate reports
    linter.js     — ContentPatternLinter  Check content quality & pattern compliance
  skills/
    postinstall.js
    researcher.md
    planner.md
    creator.md
    distributor.md
    analytics.md
  package.json    — deps: @andy-toolforge/core
```

## Exports

| Class | File | Purpose |
|-------|------|---------|
| `ContentResearcher` | `lib/researcher.js` | Research trending topics, collect and organize source material. |
| `ContentPlanner` | `lib/planner.js` | Plan content calendar from research output. |
| `ContentCreator` | `lib/creator.js` | Generate content using LLM-driven templates. |
| `ContentDistributor` | `lib/distributor.js` | Multi-platform content distribution. |
| `ContentAnalytics` | `lib/analytics.js` | Performance tracking and reporting. |
| `ContentPatternLinter` | `lib/linter.js` | Quality checks and pattern compliance. |

## Conventions

- Skill files prefixed with `content-operations-`.
- All classes use core LLMClient for LLM calls.

## Testing

```bash
npm test -w @andy-toolforge/content-operations
```
