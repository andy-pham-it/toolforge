# @andy-toolforge/ba-support — Business Analysis Support

> Domain package for business analysis: competitor crawling & analysis, SWOT,
> pricing analysis, market trends, and structured report generation.
> Uses Puppeteer (via core BrowserManager) for competitor site crawling.

## Structure

```
packages/ba-support/
  lib/
    index.js       — Entry: exports { MarketResearcher }
    researcher.js  — MarketResearcher — 5 analysis methods
  mcp-tools.js     — MCP tool handlers
  skills/
    postinstall.js
    market-researcher.md
    swot-analyzer.md
  package.json     — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `MarketResearcher` | `lib/researcher.js` | Competitor analysis, pricing comparison, SWOT, market trend research, report generation. |

### MarketResearcher methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `crawlCompetitor(url)` | `(string) → Promise<object>` | Crawl a competitor URL via Puppeteer. Returns structured profile with name, description, products, targetMarket, pricingModel, keyStrengths, keyWeaknesses. |
| `analyzePricing(data)` | `(Array<{name,price,model,features}>) → Promise<object>` | Analyze competitor pricing data. Returns summary, priceRange, commonModels, competitors, recommendations, marketPosition. |
| `swotAnalysis(competitorData)` | `(Array<object>) → Promise<object>` | Generate SWOT from competitor profiles. Returns summary, strengths/weaknesses/opportunities/threats (each with impact/severity), recommendations. |
| `trackTrends(keywords)` | `(string[]) → Promise<object>` | Analyze market trends for given keywords. Returns momentum, emerging patterns, industry insights. |
| `generateReport(findings, format?)` | `(object, 'markdown'|'plain') → Promise<string>` | Generate comprehensive business analysis report from findings. |

## Conventions

- Uses Puppeteer (via core BrowserManager) for competitor site crawling.
- All methods use core LLMClient for analysis/report generation.
- Skill files prefixed with `ba-support-`.
- MCP tools registered via `mcp-tools.js`.
- Constructor requires `{ llmClient: LLMClient }`.

## Testing

```bash
npm test -w @andy-toolforge/ba-support
```
