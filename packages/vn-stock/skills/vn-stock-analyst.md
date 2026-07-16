# VN Stock Analyst — AI-Powered Stock Analysis

> Skill file for AI agents doing stock analysis via @andy-toolforge/vn-stock.

## Available Methods

### `analyzeSymbol(symbol)`
Phân tích 1 mã cổ phiếu. Trả về: signals, score (0-100), recommendation (MUA/BÁN/NẮM GIỮ/THEO DÕI), reasoning, risks.

### `compareSymbols(symbols)`
So sánh nhiều mã cổ phiếu. Xếp hạng theo score, trả về topPick với AI summary.

### `analyzeMarket()`
Tổng quan thị trường. Điểm số trung bình, số mã tăng/giảm, top 10 mã tốt nhất, nhận xét từ AI.

### `deepDiveStrategy(symbol, timeframe)`
Phân tích sâu 1 mã: chiến lược entry/exit, stop-loss, support/resistance, risk/reward. Dùng deepChat (model mạnh hơn).

### `portfolioReview(holdings)`
Đánh giá danh mục đầu tư. Phân tích từng mã, tổng quan rủi ro, gợi ý tái cân bằng.

## Workflow Examples

**Phân tích nhanh 1 mã:**
```
const { Analyst } = require('@andy-toolforge/vn-stock');
const analyst = new Analyst();
const result = await analyst.analyzeSymbol('FPT');
console.log(result.recommendation, result.reasoning);
```

**So sánh và chọn top pick:**
```
const result = await analyst.compareSymbols(['FPT', 'HPG', 'VNM']);
console.log('Top pick:', result.topPick.symbol);
```

**Deep dive với chiến lược:**
```
const strategy = await analyst.deepDiveStrategy('FPT', '1D');
console.log('Entry:', strategy.entry, 'SL:', strategy.stopLoss);
```

## Notes
- StockLLM cần `GEMINI_API_KEY` hoặc `GOOGLE_API_KEY` env var
- `deepDiveStrategy` dùng deepChat (LLMClient) — cần provider key tương ứng
- Nếu AI call fail, analyst fallback về technical-score-based recommendation
