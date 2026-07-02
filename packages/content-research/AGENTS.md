# @andy-toolforge/content-research — Content Research

> Domain package for content research: summarization, idea generation, article management, and competitor analysis.

## Structure

```
packages/content-research/
  lib/
    index.js      — Entry: exports { ContentSummarizer, ContentIdeator, ArticleManager, CompetitorAnalyzer }
    summarizer.js — ContentSummarizer  Summarize content via LLM with skill-file prompts
    ideator.js    — ContentIdeator  Generate content ideas via LLM with skill-file prompts
    manager.js    — ArticleManager  Manage article lifecycle (classify, tag, summarize, improve)
    analyzer.js   — CompetitorAnalyzer  Crawl competitor URL + analyze via LLM (with Puppeteer)
    llm.js        — LLMClient  Extends core LLMClient; adds domain methods + skill file loading
    *.test.js     — Unit tests via node --test
  skills/
    postinstall.js              — Symlinks skill .md files → .opencode/skills/ with prefix
    summarizer.md               — Vietnamese prompt for content summarization
    ideator.md                  — Vietnamese prompt for idea generation
    manager.md                  — Vietnamese prompt for article management
    analyzer.md                 — Vietnamese prompt for competitor analysis (SWOT)
  package.json    — deps: @andy-toolforge/core, puppeteer
```

## Key Classes

| Class | File | Purpose |
|-------|------|---------|
| `ContentSummarizer` | `lib/summarizer.js` | Summarize articles/reports. `summarize(content, title, lang)`. |
| `ContentIdeator` | `lib/ideator.js` | Generate content ideas. `generate(topic, audience, format, numIdeas, lang)`. |
| `ArticleManager` | `lib/manager.js` | Manage article lifecycle. `processArticle(content, title, action, lang)`. |
| `CompetitorAnalyzer` | `lib/analyzer.js` | Crawl & analyze competitor sites. `analyze(url, scope, lang)`. |
| `LLMClient` | `lib/llm.js` | **Extends core `LLMClient`** with 4 domain methods + skill-file loading. |

## Testing

```bash
npm test -w @andy-toolforge/content-research
```
