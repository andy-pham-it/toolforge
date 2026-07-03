# @andy-toolforge/seo-generation — SEO Content Generation

> Domain package for SEO metadata generation (YouTube/TikTok/Facebook), content arbitrage across platforms, and multi-platform publishing via REST APIs.

## Structure

```
packages/seo-generation/
  lib/
    index.js              — Entry: exports { SEOAnalyzer, ContentArbitrageEngine, MultiPlatformPublisher }
    seo.js                — SEOAnalyzer  YouTube/TikTok/Facebook SEO analysis & metadata generation
    content-arbitrage.js  — ContentArbitrageEngine  Repurpose content across platforms
    publisher.js          — MultiPlatformPublisher  Publish to YouTube/TikTok/Facebook via REST
  skills/
    postinstall.js        — Symlinks skill .md files → .opencode/skills/ with prefix
    seo-generate.md       — Prompt for SEO metadata generation
    content-arbitrage.md  — Prompt for content arbitrage
  templates/
    prompts-template.md   — Prompt template example
  package.json            — deps: @andy-toolforge/core
```

## Exports

| Class | File | Purpose |
|-------|------|---------|
| `SEOAnalyzer` | `lib/seo.js` | Generate platform-specific titles, descriptions, tags, keywords. |
| `ContentArbitrageEngine` | `lib/content-arbitrage.js` | Cross-platform content repurposing engine. |
| `MultiPlatformPublisher` | `lib/publisher.js` | REST client for YouTube/TikTok/Facebook uploads. |

## Conventions

- All classes import core LLMClient — no direct provider logic.
- Skill files in `skills/` prefixed with `seo-generation-`.

## Testing

```bash
npm test -w @andy-toolforge/seo-generation
```
