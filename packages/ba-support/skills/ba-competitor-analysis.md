---
name: ba-competitor-analysis
description: Phân tích đối thủ cạnh tranh — crawl dữ liệu, SWOT, pricing analysis, báo cáo chiến lược. Dùng khi user cần research thị trường hoặc đánh giá đối thủ.
---

# Competitor Analysis

Skill này hướng dẫn AI phân tích đối thủ cạnh tranh toàn diện.

## 📥 Input

- **Competitor URL** — website đối thủ cần phân tích
- **Pricing data** — (optional) bảng giá đối thủ
- **Competitor list** — (optional) danh sách đối thủ để so sánh
- **Keywords** — (optional) từ khóa để track trends

## 📤 Output

### 1. Competitor Profile

```json
{
  "name": "Tên công ty",
  "description": "Mô tả",
  "products": ["Sản phẩm A"],
  "targetMarket": "Đối tượng khách hàng",
  "pricingModel": "Freemium / Subscription",
  "estimatedScale": "Startup / Enterprise",
  "keyStrengths": ["Điểm mạnh"],
  "keyWeaknesses": ["Điểm yếu"]
}
```

### 2. Pricing Analysis

- Price range summary
- Common pricing models
- Competitor positioning
- Strategic recommendations

### 3. SWOT Analysis

| Factor | Impact | Source |
|--------|--------|--------|
| Strengths | high/medium/low | Đối thủ nào |
| Weaknesses | high/medium/low | Đối thủ nào |
| Opportunities | Potential | Actionable? |
| Threats | Severity | Urgency |

### 4. Trends Analysis

- Rising / stable / declining keywords
- Emerging patterns
- Industry insights
- Recommended actions

## 🎯 Rules

1. **Crawl trước, phân tích sau** — gọi `crawlCompetitor` trước `swotAnalysis`
2. **Pricing analysis** cần data tối thiểu 2 đối thủ để so sánh
3. **SWOT** luôn có cả 4 góc nhìn — không thiếu opportunities/threats
4. **Recommendations** phải actionable — không chung chung
5. **Báo cáo cuối** dùng `generateReport` để tổng hợp

## 📋 Workflow

1. `MarketResearcher.crawlCompetitor(url)` — crawl từng đối thủ
2. `MarketResearcher.analyzePricing(data)` — phân tích pricing
3. `MarketResearcher.swotAnalysis(competitorData)` — SWOT tổng hợp
4. `MarketResearcher.trackTrends(keywords)` — market trends
5. `MarketResearcher.generateReport(findings, 'markdown')` — báo cáo cuối

## 📋 Template

```
## Competitor Analysis: [Market/Industry]

### Competitors
1. [Company A] — [brief description]
2. [Company B] — [brief description]

### Key Findings
- ...

### SWOT Summary
- Strengths: ...
- Weaknesses: ...
- Opportunities: ...
- Threats: ...

### Recommendations
1. ...
2. ...
```

## 📋 Prerequisites

- Valid competitor URL(s) to crawl (accessible from the network)
- For pricing analysis: data from at least 2 competitors for meaningful comparison
- For trends: relevant keywords for the market
- `LLMClient` instance (optional for basic crawl, required for analysis)

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Competitor URL unreachable | Site blocks crawlers or URL is invalid | Try alternative competitor URL or use manual data entry |
| Pricing data incomplete | Fewer than 2 competitors | Collect more data or note the limitation |
| SWOT missing quadrants | Insufficient data | Add competitor data or mark as "insufficient data" for missing quadrants |
| Trends return nothing | Keywords too niche | Broaden keywords or check spelling |

## 🔗 Integration

- **MCP tools:** `toolforge_competitor_analysis` (crawl), `toolforge_pricing_analysis` (pricing), `toolforge_swot_analysis` (SWOT), `toolforge_trend_analysis` (trends), `toolforge_business_report` (report)
- **Domain packages:** Results can be stored/exported via report generation
- **Cross-domain:** Use with `content-research`'s competitor analyzer for content strategy context

## 📚 Related Skills

- `ba-requirement-gatherer` — gather requirements before competitor analysis
- `ba-support-hub` — overview of all BA tools
- `toolforge_content_research` (via MCP) — content competitor analysis
- `andy-toolforge` (MCP Bridge) — invoke BA tools via `skill_mcp`
