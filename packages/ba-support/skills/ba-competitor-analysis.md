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
