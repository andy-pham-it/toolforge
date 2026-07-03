# @andy-toolforge/ba-support — Business Analysis Support

> Domain package for business analysis: competitor crawling & analysis, SWOT, pricing analysis, market trends, and structured report generation.

## Structure

```
packages/ba-support/
  lib/
    index.js    — Entry: exports { MarketResearcher }
    researcher.js — MarketResearcher  Competitor crawl, pricing, SWOT, trends, reports
  skills/
    postinstall.js
    market-researcher.md
    swot-analyzer.md
  package.json   — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `MarketResearcher` | `lib/researcher.js` | Competitor analysis, pricing comparison, SWOT, market trend research, report generation. |

## Conventions

- Uses Puppeteer (via core BrowserManager) for competitor site crawling.
- Skill files prefixed with `ba-support-`.

## Testing

```bash
npm test -w @andy-toolforge/ba-support
```
