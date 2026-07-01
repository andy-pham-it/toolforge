# Toolforge v1.0.0 — Initial Release

**Date:** 2026-07-01

## Overview

Toolforge is a monorepo of shared automation packages for personal projects. Each
package is an independent npm module, published to GitHub Packages under the
`@andy-toolforge` scope.

## What's Included

| Package | Version | Purpose |
|---------|---------|---------|
| `@andy-toolforge/core` | 1.0.0 | Foundation: Logger, LLMClient, BrowserManager, JobQueue |
| `@andy-toolforge/footage-generation` | 1.0.0 | Image/video generation for podcast content |
| `@andy-toolforge/seo-generation` | 1.0.0 | YouTube/TikTok/Facebook SEO, content arbitrage, publishing |
| `@andy-toolforge/pm-support` | 1.0.0 | Task tracking, time management, invoicing |
| `@andy-toolforge/coding-support` | 1.0.0 | Code analysis, dependency graphs, complexity reports |
| `@andy-toolforge/book-writing` | 1.0.0 | Book outline, chapter writing, consistency review, export |
| `@andy-toolforge/ba-support` | 1.0.0 | Competitor analysis, SWOT, pricing, market trends |

## Architecture

- **npm workspaces** monorepo at root
- **CommonJS** (`require` / `module.exports`), no build step
- **Class-based** exports with constructor config objects
- **Skill files** (`.md`) auto-linked into `.opencode/skills/` via postinstall
- **140 unit tests** using Node built-in `node --test` runner
- **Dependency direction:** Domain packages depend on core only — no cross-domain dependencies

## Client Project Integration

```bash
# .npmrc
@andy-toolforge:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_TOKEN}

npm install @andy-toolforge/core @andy-toolforge/seo-generation
```

See `docs/migration-guide.md` for migrating existing projects.

## Links

- Repository: https://github.com/glrs/toolforge
- Publishing guide: `docs/publishing.md`
