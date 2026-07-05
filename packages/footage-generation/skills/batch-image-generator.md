---
name: batch-image-generator
description: Batch image generation via Google Gemini Images browser automation. Sinh ảnh hàng loạt miễn phí bằng Puppeteer điều khiển Chrome. Dùng khi có file prompts.md hoặc segments từ generate_prompts, cần gen ảnh thật PNG để import vào video editor. Free-model: LLM API (trả phí) viết prompt, Gemini Images Web UI (free) gen ảnh.
---

# Batch Image Generator — Gemini Browser Automation

## Tổng quan

Dùng Puppeteer điều khiển Chrome vào [gemini.google.com/images](https://gemini.google.com/images) để sinh ảnh **miễn phí** (không tốn API credits).

**Pipeline:**
```
Script → [analyzeScript] → segments
  → [generatePrompts] → 5 prompts/segment  
  → [PromptWriter] → prompts.md
  → [BrowserImageGenerator] → ảnh PNG
```

**Free-model strategy:**
- `@andy-toolforge/core` LLM API (paid, ~$0.50/tập) → sinh prompt text
- Gemini Images Web UI (free) → gen ảnh
- Trade-off: chậm (2-3 phút/ảnh) nhưng free

## Yêu cầu

1. **Chrome đã đăng nhập Gemini** — chạy `--login` lần đầu
2. **Node.js 18+**
3. `puppeteer` (dependency của footage-generation)

## Cách dùng

### CLI

```bash
# Login lần đầu
node packages/footage-generation/_private/cli.js --login

# Batch gen
node packages/footage-generation/_private/cli.js <prompts.md> [output-dir]
```

### Programmatic (trong code)

```javascript
const BrowserImageGenerator = require('@andy-toolforge/footage-generation/lib/browser-generator');
const PromptParser = require('@andy-toolforge/footage-generation/lib/prompt-parser');

const gen = new BrowserImageGenerator({
    logger: console,
});

const prompts = PromptParser.parseFile('prompts.md');
const result = await gen.generateBatch(prompts, './output', {
    onProgress: (p) => console.log(`${p.current}/${p.total}: ${p.name}`),
});

console.log(`✅ ${result.successCount}/${result.totalCount} images`);
```

### MCP tool

Dùng tool `generate_batch_image` sau khi chạy `generate_prompts`:

```
generate_batch_image(segments: [...], outputDir: "./images")
→ PID + output path (chạy background, không block)
```

### Từ workflow podcast-processor

Skill `podcast-processor` tự động gọi skill này sau khi tạo prompts file.
Xem `workflow-podcast-processor.md` step 6.

## Anti-rate-limit measures

Script tự động:
- Random delay 90-180s giữa các ảnh
- Giả lập human chat sau mỗi 2-3 ảnh (gõ tiếng Việt, scroll, hover)
- Nghỉ 5-8 phút sau mỗi 3 ảnh mới
- Typo + backspace ngẫu nhiên khi gõ prompt (chống bot detection)
- Multi-turn conversation (gửi tin nhắn, nhận phản hồi, reply tiếp)
- Tự retry khi rate-limit (tăng dần thời gian chờ)
- Resume bằng cách skip ảnh đã tồn tại

## Timeout resilience

Nếu ảnh gen quá lâu:

1. **Chat**: chờ tới timeout (5-10 phút)
2. **Library**: navigate qua library page, tìm ảnh
3. **Retry**: quay lại chat, re-submit, chờ tiếp
4. **Element screenshot**: fallback cuối (chụp thẻ img)
5. **Progressive backoff**: mỗi lần retry +1 phút timeout

## .npmignore

File `_private/cli.js` và `_private/` nên được include trong npm package (cần cho `ImageGenerator.generateBatch()`).
Kiểm tra `files` trong `packages/footage-generation/package.json`.
