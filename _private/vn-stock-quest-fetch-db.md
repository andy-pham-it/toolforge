# Quest: Bổ sung dữ liệu MongoDB cho @andy-toolforge/vn-stock

> Các script fetch dữ liệu từ các nguồn API (VPS, Entrade, SSI, v.v.) và ghi vào MongoDB.
> Package `@andy-toolforge/vn-stock` sẽ đọc từ các collections này, không gọi API trực tiếp.

## DB hiện tại

**Database:** `stock_db` (MongoDB Atlas, ~112MB)
**Kết nối:** `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/stock_db`

### Collections đã có

| Collection | Docs | Dung lượng | Trạng thái |
|---|---|---|---|
| `stock_1d` | 54 | ~33MB | ✅ Đầy đủ indicators |
| `stock_1h` | 33,810 | ~18MB | ⚠️ Chỉ OHLCV raw |
| `stock_15m` | 33,871 | ~49MB | ⚠️ Chỉ OHLCV raw |
| `stock_5m` | 33,871 | ~150MB | Không cần dùng |
| `intraday_indicators` | 121 | ~12MB | ⚠️ Thiếu vài indicator |
| `stock_fundamentals` | 54 | ~3KB | ⚠️ Thiếu chi tiết tài chính |
| `stock_price_board` | 52 | — | OK |
| `market_state` | 52 | — | OK |
| `price_board_snapshots` | 401 | — | OK |

---

## Script 1: Compute indicators cho 15m và 1h

**Target collections:** `stock_15m`, `stock_1h`
**Mục đích:** Thêm indicators vào mỗi candle (giống `stock_1d`)

### Input format hiện tại
```javascript
// stock_15m / stock_1h
{
  symbol: "FPT",
  date: ISODate("2026-07-13"),
  candles: [
    { index: 0, o: 120.5, h: 121.3, l: 120.1, c: 120.8, v: 1500000, t: ISODate("2026-07-13T09:00:00Z") },
    ...
  ]
}
```

### Output format mong muốn
Mỗi candle trong `candles[]` cần thêm:

```javascript
{
  // OHLCV gốc
  index, o, h, l, c, v, t,

  // Moving Averages
  ema20: NumberDecimal,      // EMA 20 period
  ema50: NumberDecimal,
  ema100: NumberDecimal,
  ema200: NumberDecimal,

  // Momentum
  rsi: NumberDecimal,        // RSI 14 period
  macd: NumberDecimal,
  signal: NumberDecimal,
  histogram: NumberDecimal,

  // Volatility
  atr: NumberDecimal,
  atr_pct: NumberDecimal,    // ATR % of close
  bb_upper: NumberDecimal,   // Bollinger Upper (20,2)
  bb_lower: NumberDecimal,
  bb_width: NumberDecimal,

  // Volume
  vol_ma20: NumberDecimal,   // Volume MA 20

  // Stochastic
  stoch_k: NumberDecimal,
  stoch_d: NumberDecimal,

  // Price-based
  obv: NumberDecimal,        // On-Balance Volume
  vwap: NumberDecimal,
  mfi: NumberDecimal,        // Money Flow Index

  // MCDX Flow (nếu có data cho timeframe này)
  mcdx_banker: NumberDecimal,
  mcdx_speculator: NumberDecimal,
  mcdx_retail: NumberDecimal,
  mcdx_ma: NumberDecimal,

  // Change
  price_change_pct: NumberDecimal  // % change từ candle trước
}
```

### Công thức tính

| Indicator | Công thức | Period |
|---|---|---|
| EMA | Exponential Moving Average | 20, 50, 100, 200 |
| RSI | Relative Strength Index (Wilder) | 14 |
| MACD | EMA(12) - EMA(26) | 12/26/9 |
| ATR | Average True Range | 14 |
| Bollinger | SMA(20) ± 2×σ | 20, 2 |
| Volume MA | Simple moving avg của volume | 20 |
| Stochastic | %K = (C - L14)/(H14 - L14)×100, %D = SMA(%K,3) | 14, 3 |
| OBV | Cumulative: +volume nếu C > C_prev, -volume nếu C < C_prev | — |
| VWAP | Σ(P×V) / Σ(V) trong ngày | theo ngày |
| MFI | Money Flow Index | 14 |

### Threshold
- **54 symbols**
- **stock_15m:** ~253 ngày × 26 candles/ngày = ~6,578 candles/symbol → ~355K candles
- **stock_1h:** ~253 ngày × 14 candles/ngày = ~3,542 candles/symbol → ~191K candles

### Ghi chú
- Không cần tính MCDX nếu không có dữ liệu gốc (chỉ copy từ nguồn nếu có)
- Nếu compute quá nặng, có thể tính batch theo ngày, chạy incremental
- Output có thể update inline vào document hiện có thay vì tạo mới

---

## Script 2: Bổ sung `intraday_indicators`

**Target collection:** `intraday_indicators`
**Mục đích:** Thêm các indicator đang thiếu để screener hoạt động đầy đủ

### Format hiện tại
```javascript
{
  symbol: "FPT",
  interval: "15m",    // hoặc "1h"
  indicators: {
    ema20: 120.5,
    ema50: 119.8,
    ema100: 118.2,
    ema200: 115.0,
    rsi: 62.5,
    vol_ma20: 2000000,
    macd: 1.2,
    signal: 0.8,
    histogram: 0.4,
    atr: 1.5,
    mcdx_banker: 0.3,
    mcdx_speculator: -0.1,
    mcdx_retail: -0.2,
    mcdx_ma: 0.15
  }
}
```

### Thiếu (cần thêm vào `indicators`)

```javascript
indicators: {
  // ... existing ...

  atr_pct: NumberDecimal,
  bb_upper: NumberDecimal,
  bb_lower: NumberDecimal,
  bb_width: NumberDecimal,
  stoch_k: NumberDecimal,
  stoch_d: NumberDecimal,
  obv: NumberDecimal,
  vwap: NumberDecimal,
  mfi: NumberDecimal,
  price_change_pct: NumberDecimal
}
```

### Threshold
- 54 symbols × 2 intervals (15m, 1h) = 108 documents

---

## Script 3: Báo cáo tài chính

**Target collection:** Mới: `stock_financials` (hoặc mở rộng `stock_fundamentals`)
**Mục đích:** Phân tích cơ bản chi tiết (bổ sung cho stock_fundamentals hiện tại)

### stock_fundamentals hiện tại
```javascript
{
  symbol: "FPT",
  pe: 18.5,
  pb: 3.2,
  roe: 0.25,        // 25%
  roa: 0.12,
  eps: 8000,
  market_cap: 150000000000000,
  net_income_growth: 0.18,
  price: 120000,
  pct_change: 1.5,
  volume: 5000000,
  volume_10d: 4500000,
  ta_signal: "BULLISH",  // hoặc "BEARISH"
  industry: "Công nghệ",
  valuation_point: 7,
  growth_point: 8,
  health_point: 6,
  dividend_point: 5,
  ev_ebitda: 12.5
}
```

### Cần bổ sung
```javascript
{
  // ... existing ...

  // Doanh thu & Lợi nhuận
  revenue_q: NumberDecimal,        // Doanh thu quý gần nhất
  revenue_growth_yoy: NumberDecimal, // % tăng trưởng YoY
  net_profit_q: NumberDecimal,     // LN ròng quý
  net_profit_growth_yoy: NumberDecimal,
  gross_margin: NumberDecimal,     // Biên lợi nhuận gộp
  net_margin: NumberDecimal,       // Biên lợi nhuận ròng
  operating_margin: NumberDecimal, // Biên LN từ HĐKD

  // Cấu trúc tài chính
  debt_to_equity: NumberDecimal,
  current_ratio: NumberDecimal,    // Thanh khoản hiện hành
  free_cash_flow: NumberDecimal,
  dividend_yield: NumberDecimal,

  // Tăng trưởng
  revenue_5y_cagr: NumberDecimal,
  net_profit_5y_cagr: NumberDecimal,

  // Ngành so sánh (optional)
  industry_avg_pe: NumberDecimal,
  industry_avg_pb: NumberDecimal
}
```

### Nguồn dữ liệu
- VPS API (KBS) — fundamental data
- CafeF — financial statements
- SSI / VNDirect — iBoard fundamental

---

## Script 4: Tăng tần suất đồng bộ Price Board

**Target collection:** `stock_price_board`
**Mục đích:** Có dữ liệu real-time hoặc gần real-time cho phân tích trong ngày

- Hiện có 52 docs, với `price_board_snapshots` (401 snapshots) làm backup
- Lý tưởng: snapshot mỗi 1-5 phút trong giờ giao dịch (9:00-15:00, T2-T6)
- Lưu latest snapshot vào `stock_price_board`
- Lưu lịch sử vào `price_board_snapshots`

### Format mong muốn
```javascript
// stock_price_board (latest snapshot per symbol)
{
  symbol: "FPT",
  price: 120800,
  change: 1500,
  pct_change: 1.26,
  volume: 2500000,
  value: 302000000000,    // Giá trị GD
  bid_price_1: 120700,
  bid_volume_1: 5000,
  ask_price_1: 120900,
  ask_volume_1: 3000,
  open: 119500,
  high: 121200,
  low: 119300,
  close: 120800,
  total_volume: 15000000,
  foreign_buy: 500000,
  foreign_sell: 200000,
  updated_at: ISODate("2026-07-13T10:30:00Z")
}
```

---

## Ưu tiên thực hiện

| Priority | Script | Lý do |
|---|---|---|
| P0 | Script 1 (15m + 1h indicators) | Không có thì screener/signals cho intraday không chạy |
| P0 | Script 2 (intraday_indicators bổ sung) | Cần cho screener real-time |
| P1 | Script 3 (financials) | Phân tích cơ bản, scorer tổng hợp |
| P2 | Script 4 (price board sync) | Nice-to-have, có thể làm sau |

---

## Lưu ý kỹ thuật

- Tất cả số thập phân dùng `NumberDecimal` (không float) để tránh rounding error
- Dùng bulk write (`insertMany` / `bulkWrite`) cho performance, không insert từng doc
- Cân nhắc TTL index cho candles cũ (>180 ngày) nếu muốn tiết kiệm dung lượng
- Nếu compute indicators quá nặng, có thể chạy batch theo symbol, parallel tối đa 5 luồng
