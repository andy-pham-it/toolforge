# Toolforge — AI Agent Guide

> Đây là tài liệu chiến lược cho AI agent khi làm việc trong dự án Toolforge.
> **Đọc kỹ trước khi thực hiện bất kỳ thay đổi nào.** Nếu không hiểu rõ mục đích của dự án, AI sẽ đưa ra quyết định sai lệch với thiết kế ban đầu.

---

## 1. Dự án này là gì?

**Toolforge** là monorepo cá nhân chứa các package npm dùng chung cho **mọi dự án automation** của tôi. Nó KHÔNG phải là một sản phẩm độc lập — nó là **kho linh kiện** để lắp ráp các dự án automation khác.

Ví dụ: dự án `generate-images-for-podcast` dùng `@andy-toolforge/core` + `@andy-toolforge/footage-generation` thay vì copy code vào `lib/` riêng của nó.

## 2. Tại sao tồn tại?

- **Tránh copy-paste code** giữa các dự án automation
- **Chuẩn hóa** LLM client, browser automation, logger, job queue dùng chung
- **Chia sẻ skill files** (`.md` cho AI agent) giữa các dự án
- **Chia sẻ templates** (prompt mẫu, config mẫu)
- **Dễ maintain**: sửa core một lần, có hiệu lực ở tất cả dự án

## 3. Architecture bất di bất dịch

### 3.1. Monorepo với npm workspaces

Root `package.json` khai báo `workspaces: ["packages/*"]`. Mỗi thư mục con trong `packages/` là một package riêng. `npm install` ở root sẽ link tất cả.

### 3.2. Hai loại package

| Loại | Ví dụ | Mô tả |
|------|-------|-------|
| **Infra** | `@andy-toolforge/core` | Nền tảng dùng chung (LLM, browser, logger, queue) |
| **Domain** | `@andy-toolforge/footage-generation` | Nghiệp vụ cụ thể (sinh ảnh, SEO, viết sách...) |

**Rules:**
- Domain packages **CHỈ** phụ thuộc vào `@andy-toolforge/core` — không phụ thuộc lẫn nhau
- Core package không chứa logic domain-specific (không có `analyzeScript` trong core)
- Domain package KHÔNG require nhau — nếu cần code chung, nó phải ở core

### 3.3. LLMClient class hierarchy

```
@andy-toolforge/core/lib/llm.js
  → LLMClient (generic chat() method, provider routing)

@andy-toolforge/<domain>/lib/llm.js
  → LLMClient extends CoreLLMClient
    - Thêm method domain-specific (analyzeScript, generateXxx...)
    - Đọc skill file từ .opencode/skills/<domain>-<name>.md
```

**KHÔNG BAO GIỜ** thêm domain-specific method vào core's LLMClient.

### 3.4. Skill file mechanism

- Skill `.md` files đặt trong `packages/<domain>/skills/`
- `postinstall.js` symlink/copy vào `.opencode/skills/` của client project với **prefix tên domain**
- Prefix tránh xung đột tên: `footage-generation-workflow-podcast-processor.md`
- LLMClient trong domain package đọc từ path có prefix

### 3.5. CommonJS là chuẩn

Tất cả package dùng `require()` / `module.exports`. **Không ESM.** Lý do:
- Tương thích với mọi client project (cả CJS và ESM)
- Không cần build step
- Đơn giản nhất có thể

## 4. Những điều KHÔNG được làm

❌ **Không merge các domain package vào core.** Mỗi domain là một package riêng.

❌ **Không thêm domain code vào core.** Core chỉ chứa foundational services.

❌ **Không tạo dependency vòng.** Domain → Core là một chiều.

❌ **Không chuyển sang ESM.** Cả monorepo dùng CommonJS.

❌ **Không push toolforge code vào git của client project.** Toolforge là dependency riêng.

❌ **Không đổi tên package scope** (`@andy-toolforge`) — nó được dùng ở nhiều nơi.

❌ **Không thêm dependency "for convenience"** vào core. Mỗi dependency phải có lý do rõ ràng.

❌ **Không viết lại kiến trúc** mà không đọc `docs/architecture.md` và `docs/2026-06-30-podcast-platform-ecosystem-design.md` trước.

## 5. Client project integration pattern

Đây là pattern chuẩn khi một dự án bên ngoài dùng toolforge:

1. **package.json**: thêm `@andy-toolforge/core`, `@andy-toolforge/<domain>` — xoá các deps mà toolforge quản lý
2. **npm link** (dev) hoặc **npm install từ GitHub Packages** (production)
3. **Imports**: `require('@andy-toolforge/core')` thay `require('./lib/xxx')`
4. **postinstall**: chạy để cài skill files vào `.opencode/skills/`
5. **Giữ lại**: các file gắn chặt với project (ví dụ `lib/job.js` trong Express server)
6. **Xoá**: các file đã được thay thế bởi toolforge packages

**Không merge ngược** — không copy code từ toolforge vào client project rồi sửa riêng.
Nếu cần sửa, sửa ở toolforge rồi bump version.

## 6. Khi nào tạo domain package mới?

Tạo package mới khi:
- Có ≥2 dự án cần cùng một logic nghiệp vụ
- Logic đó không thuộc core (không phải LLM/browser/logger generic)
- Có skill files kèm theo

Không tạo package mới nếu chỉ có một dự án dùng — cứ để code trong dự án đó trước.

## 7. Version strategy

- Core package: **major.minor.patch** — breaking change = major bump
- Domain packages: version độc lập với core
- Tất cả package theo semver
- Pre-release: `-alpha.1`, `-beta.1`

## 8. Files chiến lược — đọc trước khi quyết định

| File | Nội dung |
|------|----------|
| `AGENTS.md` | File này — nguyên tắc chiến lược |
| `docs/architecture.md` | Kiến trúc chi tiết |
| `docs/2026-06-30-podcast-platform-ecosystem-design.md` | Spec thiết kế gốc |
| `CONTRIBUTING.md` | Hướng dẫn dev |
| `packages/*/lib/index.js` | Export của từng package |

## 9. Code Map

Exports by package (key symbols from Serena analysis):

| Package | Export | File | Purpose |
|---------|--------|------|---------|
| `core` | `LLMClient` | `lib/llm.js` | Generic LLM `chat()` with provider routing |
| `core` | `BrowserManager` | `lib/browser.js` | Puppeteer browser lifecycle management |
| `core` | `Logger` | `lib/logger.js` | Structured logging with levels |
| `core` | `JobQueue` | `lib/queue.js` | Async FIFO job queue |
| `footage-generation` | `ImageGenerator` | `lib/generator.js` | Spawn image/video generation |
| `footage-generation` | `TextOverlayer` | `lib/overlay.js` | Overlay text on images (via sharp) |
| `footage-generation` | `PromptWriter` | `lib/writer.js` | Prompt template management |
| `footage-generation` | `LLMClient` | `lib/llm.js` | Extends core LLMClient; loads domain skill files |
| `seo-generation` | `SEOAnalyzer` | `lib/seo.js` | YouTube/TikTok/Facebook SEO analysis |
| `seo-generation` | `ContentArbitrageEngine` | `lib/content-arbitrage.js` | Repurpose content across platforms |
| `seo-generation` | `MultiPlatformPublisher` | `lib/publisher.js` | Publish to YouTube/TikTok/Facebook via REST |
| `pm-support` | `TaskTracker` | `lib/tracker.js` | Project management: tasks, time, reports, invoices |
| `coding-support` | `CodebaseAnalyzer` | `lib/codebase-analyzer.js` | Line counts, dead code, dep graph, complexity |
| `book-writing` | `BookWriter` | `lib/writer.js` | Outline, write chapters, review, export (md/plain/html) |
| `ba-support` | `MarketResearcher` | `lib/researcher.js` | Competitor crawl, pricing, SWOT, trends, reports |

## 10. AI decision checklist

Trước khi thực hiện bất kỳ thay đổi nào, AI **PHẢI** tự kiểm tra:

- [ ] Tôi có hiểu project này là monorepo chứa các package dùng chung không?
- [ ] Thay đổi này thuộc core hay domain?
- [ ] Nếu thuộc domain, tôi có vô tình sửa core không?
- [ ] Nếu thêm code mới, nó có vi phạm dependency direction không?
- [ ] Nếu thêm package mới, có ≥2 dự án cần nó không?
- [ ] Tôi có dùng CommonJS không (require, module.exports)?
- [ ] Tôi có đọc các file chiến lược trước khi quyết định không?

> **Nguyên tắc vàng:** Toolforge là công cụ, không phải sản phẩm. Mọi quyết định thiết kế phải ưu tiên sự đơn giản, dễ maintain, và khả năng tái sử dụng giữa các dự án.
