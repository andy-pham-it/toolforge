# @andy-toolforge/ba-support

[![npm](https://img.shields.io/npm/v/@andy-toolforge/ba-support)](https://npmjs.com/package/@andy-toolforge/ba-support)
[![License](https://img.shields.io/npm/l/@andy-toolforge/ba-support)](https://github.com/andy-pham-it/toolforge)

**Business Analysis: competitor research, pricing, SWOT, trends, reports.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Crawl và phân tích competitor profiles từ URL
- So sánh pricing strategies
- Phân tích SWOT từ dữ liệu đối thủ
- Track market trends theo keywords
- Sinh business report (markdown/plain)

## Installation

```bash
npm install @andy-toolforge/ba-support
```

Yêu cầu `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const { MarketResearcher } = require('@andy-toolforge/ba-support');
```

---

### MarketResearcher

Một class duy nhất cho mọi nhu cầu business analysis. Cần LLMClient từ core.

**Constructor:** `new MarketResearcher({ llmClient, logger? })`

---

#### crawlCompetitor(url)

Crawl và phân tích competitor từ URL.

| Param | Type | Mô tả |
|-------|------|-------|
| `url` | string | Competitor website URL |

**Return:**
```javascript
{
  name: 'Company name',
  website: 'https://competitor.com',
  description: 'What they do',
  products: ['Product 1', 'Product 2'],
  targetMarket: 'Their audience',
  pricingModel: 'Subscription',
  estimatedScale: 'Startup',
  keyStrengths: ['Strength 1'],
  keyWeaknesses: ['Weakness 1']
}
```

```javascript
const { MarketResearcher } = require('@andy-toolforge/ba-support');
const { LLMClient } = require('@andy-toolforge/core');

const llm = new LLMClient({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });
const researcher = new MarketResearcher({ llmClient: llm });

const profile = await researcher.crawlCompetitor('https://competitor.com');
console.log(profile.name, profile.keyStrengths);
```

---

#### analyzePricing(data)

Phân tích pricing data của competitors.

| Param | Type | Mô tả |
|-------|------|-------|
| `data` | Array | Array of `{ name, price, model, features[] }` |

**Return:** `{ summary, priceRange, commonModels, competitors[], recommendations[], marketPosition }`

```javascript
const analysis = await researcher.analyzePricing([
    { name: 'Competitor A', price: 99, model: 'subscription', features: ['a', 'b'] },
    { name: 'Competitor B', price: 199, model: 'enterprise', features: ['a', 'b', 'c'] },
]);
console.log(analysis.recommendations);
```

---

#### swotAnalysis(competitorData)

Sinh SWOT analysis từ array competitor profiles.

| Param | Type | Mô tả |
|-------|------|-------|
| `competitorData` | Array | Array of `{ name, description, keyStrengths[], keyWeaknesses[] }` |

**Return:** `{ summary, strengths[], weaknesses[], opportunities[], threats[], recommendations[] }`

```javascript
const swot = await researcher.swotAnalysis([profile1, profile2]);
console.log(swot.summary);
swot.recommendations.forEach(r => console.log(`→ ${r}`));
```

---

#### trackTrends(keywords)

Phân tích market trends cho keywords.

| Param | Type | Mô tả |
|-------|------|-------|
| `keywords` | string[] | Keywords to analyze |

**Return:** `{ summary, keywords[], emergingPatterns[], industryInsights[], recommendedActions[] }`

```javascript
const trends = await researcher.trackTrends(['AI', 'machine learning', 'automation']);
console.log(trends.emergingPatterns);
```

---

#### generateReport(findings, format)

Sinh business report từ toàn bộ findings.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `findings` | object | required | Object chứa tất cả dữ liệu |
| `format` | string | `'markdown'` | `'markdown'` \| `'plain'` |

**Return:** `string` — formatted report

```javascript
const report = await researcher.generateReport({
    competitor: profile,
    swot: swot,
    trends: trends,
}, 'markdown');
console.log(report);
// → Professional business report với headings, bullet points
```

---

## Tutorial: Full Market Research

```javascript
async function fullMarketResearch(competitorUrl, keywords) {
    const llm = new LLMClient({ provider: 'gemini', apiKey });
    const researcher = new MarketResearcher({ llmClient: llm });

    // 1. Crawl competitor
    const profile = await researcher.crawlCompetitor(competitorUrl);

    // 2. SWOT
    const swot = await researcher.swotAnalysis([profile]);

    // 3. Trends
    const trends = await researcher.trackTrends(keywords);

    // 4. Final report
    const report = await researcher.generateReport({
        executiveSummary: `Analysis of ${profile.name}`,
        competitorProfile: profile,
        swotAnalysis: swot,
        marketTrends: trends,
        date: new Date().toISOString(),
    });

    return report;
}
```

## MCP Tools

Khi dùng với [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):

| Tool | Description |
|------|-------------|
| `toolforge_competitor_analysis` | Crawl competitor data + profile |
| `toolforge_pricing_analysis` | Analyze pricing data |
| `toolforge_swot_analysis` | Generate SWOT from competitor data |
| `toolforge_trend_analysis` | Analyze market trends for keywords |
| `toolforge_business_report` | Generate comprehensive business report |

## Integration

- **+ [@andy-toolforge/content-research](https://npmjs.com/package/@andy-toolforge/content-research):** CompetitorAnalyzer (crawl + LLM) + ContentSummarizer
- **+ [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):** Expose 5 tools qua MCP protocol

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — LLMClient
- [@andy-toolforge/content-research](https://npmjs.com/package/@andy-toolforge/content-research)
