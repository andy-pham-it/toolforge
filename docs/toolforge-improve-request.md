# Yêu cầu cải tiến: `generate_batch_image` - Batch Image Generator

## Vấn đề

Toolforge hiện tại dùng `BrowserImageGenerator` với cơ chế reuse page (dùng chung 1 tab Gemini cho tất cả ảnh). Cách này dễ bị rate-limit, tích lũy trạng thái "Request Denied" sau vài ảnh, và không có cơ chế fresh slate khi page bị lỗi.

## Giải pháp đề xuất

Áp dụng các cải tiến đã được kiểm chứng thành công với project generate-images-for-podcast (38/38 ảnh, 0 rate-limit):

### 1. Fresh page mỗi ảnh (quan trọng nhất)

**Hiện tại:** Dùng chung 1 page → mở Gemini → submit prompt → chờ → capture → lặp lại.

**Đề xuất:**
```js
// Mỗi lần generateImage:
// 1. Tạo page mới: browser.newPage()
// 2. Vào gemini.google.com/images
// 3. Kiểm tra page healthy (không bị deny/rate-limit)
// 4. Click "New chat"
// 5. Submit prompt
// 6. Chờ + capture
// 7. ĐÓNG page khi xong (page.close())
```

**Lợi ích:** Không tích lũy rate-limit detection, không bị stale state, mỗi ảnh bắt đầu sạch sẽ.

### 2. Image detection: mở rộng + lọc icon

**Hiện tại:** `img.complete && img.naturalWidth > 500`

**Đề xuất:**
```js
// Filter ra Gemini-generated images thay vì UI icons
const candidates = all.filter(img => {
  if (!img.complete) return false;
  if (img.naturalWidth < 300 || img.naturalHeight < 300) return false; // bỏ icon/avatar 32-150px
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (ratio > 3.0) return false; // bỏ separator bar dài
  const src = (img.src || '').toLowerCase();
  if (src.includes('favicon') || src.includes('icon')) return false;
  return true;
});
```

### 3. Thêm mic button simulation

Click microphone button trên Gemini sau mỗi ảnh để tạo tín hiệu human activity — giảm rate-limit detection.

```js
async function simulateMicUse(page) {
  const micClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const mic = buttons.find(el => {
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      const text = (el.innerText || '').toLowerCase();
      return label.includes('microphone') || label.includes('mic') ||
             text.includes('microphone');
    });
    if (mic) { mic.click(); return true; }
    return false;
  });
  if (micClicked) {
    await sleep(randomInt(2000, 4000));
    await page.keyboard.press('Escape');
    await sleep(1000);
  }
}
```

### 4. Giảm delay mặc định

**Hiện tại:** minDelay=90s, maxDelay=180s, batchBreakMin=5, batchBreakMax=8

**Đề xuất:** Cập nhật DEFAULTS:
- minDelay: 30000 (30s) — thay vì 90000
- maxDelay: 60000 (60s) — thay vì 180000
- batchBreakMin: 1 (phút)
- batchBreakMax: 2 (phút)

Thêm tham số `speed` mode:
```js
if (options.speed === 'fast') {
  minDelay = 15000;
  maxDelay = 45000;
  batchBreakMin = 1;
  batchBreakMax = 2;
} else if (options.speed === 'cautious') {
  minDelay = 90000;
  maxDelay = 180000;
  batchBreakMin = 5;
  batchBreakMax = 8;
}
```

### 5. Tăng MAX_TIMEOUT

**Hiện tại:** maxTimeout=300000 (5 phút)

**Đề xuất:** maxTimeout=600000 (10 phút) — một số ảnh phức tạp cần thời gian generate lâu hơn. Thêm progressive backoff: +60s mỗi lần retry.

### 6. Thêm debug screenshot khi timeout

Khi generation timeout, chụp screenshot + dump page text để diagnostic:

```js
async function takeDebugScreenshot(page, label, logger) {
  const debugDir = path.join(outputDir, 'debug');
  fs.mkdirSync(debugDir, { recursive: true });
  const ssPath = path.join(debugDir, `${label}_${Date.now()}.png`);
  await page.screenshot({ path: ssPath, fullPage: false });
  const text = await page.evaluate(() =>
    document.body?.innerText?.slice(0, 2000) || 'NO TEXT'
  ).catch(() => 'UNREADABLE');
  logger?.info(`Debug screenshot: ${ssPath}`);
  logger?.info(`Page text: "${text.slice(0, 300)}"`);
}
```

### 7. Thêm `checkPageHealthy()` trước khi generate

Kiểm tra page không bị "Request Denied" hay các lỗi khác trước khi bắt đầu một ảnh:

```js
async function checkPageHealthy(page) {
  const title = await page.title().catch(() => '');
  if (title.toLowerCase().includes('denied') || title.toLowerCase().includes('sorry')) return false;
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
  if (body.includes('Request Denied') || body.includes('rate limit') ||
      body.includes('being asked for a lot') || body.includes("can't create") ||
      body.includes('something went wrong') || body.includes('try again') ||
      body.includes('Sign in') || body.includes('robot') ||
      body.includes('unusual traffic') || body.includes('verify')) {
    return false;
  }
  return true;
}
```

### 8. Thêm fallback nếu download CDN lỗi → dùng page library

Hiện tại toolforge đã có capture từ library, chỉ cần đảm bảo thứ tự thử: CDN download → element screenshot → library → resubmit. V4 script làm đúng.

## Thứ tự ưu tiên

1. **🔥 Fresh page mỗi ảnh** (thay đổi kiến trúc lớn nhất, ảnh hưởng nhiều nhất)
2. **🔧 Mic simulation** (dễ thêm, hiệu quả ngay)
3. **⚡ Giảm delay mặc định + speed mode** (dễ thêm)
4. **🔧 Image detection improvement** (dễ thêm)
5. **🔧 Debug screenshot** (dễ thêm)
6. **🔧 CheckPageHealthy** (dễ thêm)
7. **🔧 Tăng MAX_TIMEOUT** (1 dòng)

## Lợi ích kỳ vọng

| Metric | Hiện tại | Sau cải tiến |
|--------|----------|--------------|
| Thời gian/ảnh | ~2-5 phút | ~30s-2 phút |
| Rate-limit rate | Thường xuyên | Rất hiếm |
| Tỉ lệ thành công | ~70-80% | ~95-100% |
| Debug khi lỗi | console.log | Screenshot + page text dump |

## Project test

Dự án `generate-images-for-podcast` (thư mục `nghich-ly-cua-ban-nga/`) sẵn sàng làm môi trường test sau khi toolforge cập nhật.
