# Changelog

All notable changes to Toolforge monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-01

Initial release of all Toolforge packages.

### Added

#### @andy-toolforge/core v1.0.0

- **Logger** — Structured logging with levels (DEBUG / INFO / WARN / ERROR), timestamped output
- **LLMClient** — Generic LLM chat() with provider routing (puppeteer-based)
- **BrowserManager** — Puppeteer browser lifecycle management (launch / close), singleton-safe
- **JobQueue** — In-memory async FIFO queue with enqueue / process / onDone

#### @andy-toolforge/footage-generation v1.0.0

- **ImageGenerator** — Spawn image/video generation via external tools
- **TextOverlayer** — Overlay text on images (via sharp)
- **PromptWriter** — Prompt template management with variables

#### @andy-toolforge/seo-generation v1.0.0

- **SEOAnalyzer** — YouTube / TikTok / Facebook SEO analysis with keyword extraction, tag generation, and description optimization
- **ContentArbitrageEngine** — Repurpose content across platforms with schedule management
- **MultiPlatformPublisher** — Publish to YouTube (resumable upload REST API), TikTok, and Facebook via REST (Puppeteer fallback)
- Skills: `seo-generation-seo-optimizer`, `seo-generation-content-arbitrage`, `seo-generation-publish-workflow`
- 48 unit tests, 4 prompt templates

#### @andy-toolforge/pm-support v1.0.0

- **TaskTracker** — Project management: create projects, add/update tasks, track time, generate reports, calculate invoices
- Skills: `pm-support-project-planner`, `pm-support-meeting-assistant`
- 32 unit tests

#### @andy-toolforge/coding-support v1.0.0

- **CodebaseAnalyzer** — Code analysis: count lines, find dead code (unused `require()`), generate dependency graphs (Mermaid), complexity reports (cyclomatic style)
- Skills: `coding-support-code-reviewer`, `coding-support-refactoring-advisor`
- 11 unit tests

#### @andy-toolforge/book-writing v1.0.0

- **BookWriter** — Book writing engine: generate outline, write chapters with LLM, review consistency, export to markdown / plain text / HTML
- Skills: `book-writing-assistant`, `book-summarizer`
- 22 unit tests

#### @andy-toolforge/ba-support v1.0.0

- **MarketResearcher** — Business analysis: crawl competitor data, analyze pricing, generate SWOT analysis, produce formatted reports (markdown/plain), track market trends
- Skills: `ba-support-competitor-analysis`, `ba-support-requirement-gatherer`
- 19 unit tests

### Infrastructure

- npm workspaces monorepo with 7 packages
- All packages CommonJS (require / module.exports), no build step
- Postinstall skill-linking for each domain package
- GitHub Packages registry configured for all packages
- 140 total unit tests across all packages
