# Toolforge Roadmap 2026

> Roadmap tổng hợp từ codebase review (2026-08-13) và kết quả thực thi plan
> `ci-messaging-hygiene-roadmap`. Đây là tài liệu tham chiếu duy nhất cho các quyết
> định phát triển toolforge trong nửa cuối 2026.

## Trạng thái tổng quan

- **23 npm workspaces** (CommonJS, không build step) + **1 Python package** (`vn-stock-indicators`, uv workspace)
- **885 tests green** trên toàn bộ workspaces; **CI mới** (`.github/workflows/ci.yml`) test mọi PR/push
- **24 package** trong root README (bao gồm `@andy-toolforge/messaging`, `db-mongo`, `cli`, `reporting` mới)
- **MCP**: 50+ tools auto-discover từ 15+ domain packages; `ecosystem-catalog` 23 entries
- Không có dependency vòng giữa domain packages; domain → core một chiều

## 5 ưu tiên hàng đầu (từ review)

| # | Ưu tiên | Trạng thái |
|---|---------|------------|
| 1 | **CI gap**: test toàn bộ workspaces trên PR/push | ✅ DONE — `ci.yml` (npm ci + `npm test --workspaces`) |
| 2 | **Package db-mongo** (MongoDB wrapper generic: connection, collections, migrations) | ✅ DONE — v0.1.0 |
| 3 | **Package messaging**: notification layer dùng chung | ✅ DONE — `@andy-toolforge/messaging` v0.1.0 |
| 4 | **Test hardening**: loại test phụ thuộc API/DB thật, mock LLM dùng chung | ✅ DONE — MockLLMClient |
| 5 | **Hygiene**: dọn dẹp monorepo | ✅ DONE — xem mục dưới |

## Đã hoàn thành trong plan 2026-08-13

### 1. CI (ưu tiên #1)

- `.github/workflows/ci.yml` — `npm ci` + `npm test --workspaces` chạy trên PR/push vào `main`
  (paths filter: `packages/**` hoặc `.github/**`)
- Sửa **6 test failures pre-existing** để CI xanh:
  - `seo-generation/lib/publisher.test.js` — thiếu import `before/after` của node:test
  - `tts-generator/lib/planner.test.js` — env `GEMINI_API_KEY` ambient kích hoạt LLM call thật khi `llm:null`
  - `tts-generator/lib/plugin.test.js` — `GEMINI_API_KEY` shadow `GOOGLE_API_KEY` trong TTSPlugin
  - `vn-stock/lib/integration.test.js` (x2) — test data-dependent (limit 10k + Mongo skip guards)

### 2. Package messaging (ưu tiên #3)

- `@andy-toolforge/messaging` v0.1.0: **Messenger facade** + adapters `Telegram`/`Discord`/`Console`
- **Zero dependencies** (dùng global `fetch`), CommonJS, tests green, README + AGENTS.md + skill + postinstall
- Đã đăng ký vào root workspaces + root README + ecosystem-catalog

### 3. Hygiene (ưu tiên #5)

- Xóa stray `.tgz` (`andy-toolforge-authoring-0.1.1.tgz`) khỏi repo root
- Root README: header `11+` → **21 package**; thêm 10 dòng package mới vào bảng;
  MCP line `24+ tools / 7 domains` → **50+ tools / 15+ domains**; thêm CI/CD bullet cho `ci.yml`
- `packages/mcp/lib/ecosystem-catalog.js`: **14 → 20 entries** (thêm authoring, hermes-opencode-mcp-bridge,
  hermes-task-server, llm-gateway, llm-gateway-core, sdlc-workflows)
- `packages/mcp/package.json` deps map: **không đổi** — authoring đã có; genai-tools đến transitively qua
  vn-stock; các domain server/TS-primitives mới không nên thành deps của mcp (tránh bloat)
- **Competitor consolidation**: phân biệt rõ `content-research CompetitorAnalyzer` (crawl thật qua Puppeteer)
  vs `ba-support MarketResearcher.crawlCompetitor` (profile dựa trên LLM knowledge, không crawl) —
  ghi chú cross-ref trong README cả 2 package, **không xóa code** (đây là 2 tool bổ trợ, không trùng lặp)

## Điểm mạnh hiện tại (strengths)

- **Monorepo npm workspaces + CommonJS, không build step** — sửa file là có hiệu lực, tối giản nhất có thể
- **LLMClient hierarchy**: core generic (`chat()`) → domain extends (`analyzeScript`, ...), đọc skill files
  có prefix domain — không nhét domain logic vào core
- **MCP plugin discovery**: package có `mcp-tools.js` là auto-expose tool qua `@andy-toolforge/mcp`
- **Phủ domain rộng**: 21 package (LLM/browser/queue, footage, SEO, content-research/ops, ba-support,
  book-writing, pm-support, coding-support, vn-stock, tts, voice-assistant, authoring, genai-tools,
  llm-gateway(+core), sdlc-workflows, hermes bridge/task-server, messaging)
- **VN stock ecosystem** đầy đủ: screener/scorer/signals (JS) + 29 indicators thuần numpy (Python sidecar,
  gọi qua subprocess) — tách biệt rõ ràng, không phụ thuộc npm
- **CI green** — không còn test failures giấu trong repo

## Cải thiện theo package (gợi ý tiếp theo)

| Package | Cải thiện |
|---------|-----------|
| `core` | Giữ nguyên — không thêm domain logic. Theo dõi version strategy (breaking = major bump) |
| `mcp` | Kiểm tra định kỳ `ecosystem-catalog` khớp version thật của từng package (tránh drift như đã gặp) |
| `vn-stock` | Giữ data ingestion trong package — chưa đủ 2 dự án để tách thành package riêng (quy tắc AGENTS.md) |
| `sdlc-workflows` | ✅ DONE — manifest verified no-drift (2026-08-13) |
| `hermes-opencode-mcp-bridge` | ✅ DONE — plan doc có `## Implementation Status (2026-08-13)` |
| `seo-generation`/`tts-generator`/`vn-stock` | Test mới vừa hardened (env scrub, skip guards) — giữ pattern này cho test data-dependent |
| Test infra (tất cả domain) | Dùng mock LLM client dùng chung thay vì env var thật (pattern đã áp dụng cho tts-generator/vn-stock) |
| `mcp` deps map | ✅ DONE — `genai-tools` thêm trực tiếp ^0.1.0 (không còn transitive) |
| CI (`ci.yml`) | ✅ DONE — syntax check `node -c` đã thêm (npm ci → node -c → npm test) |

## Đề xuất package mới

| Package | Mô tả | Trạng thái |
|---------|-------|------------|
| `db-mongo` | MongoDB wrapper dùng chung (connection, collections, migrations) — cho vn-stock + content ops | ✅ DONE v0.1.0 |
| `messaging` | Messenger facade: Telegram/Discord/Console, zero deps | ✅ DONE v0.1.0 |
| `cli` | CLI toolkit dùng chung (arg parse, spinner, config loading) | ✅ DONE v0.1.0 |
| `knowledge-base` | Quản lý knowledge base / memory cho AI agent | ⏸️ Hoãn — content-research đang đủ |
| `reporting` | Reporting chung (markdown/HTML/PDF export) cho nhiều package | ✅ DONE v0.1.0 |

> Quy tắc tạo package mới (AGENTS.md): chỉ tạo khi ≥2 dự án cần cùng logic, logic đó không thuộc core,
> và có skill files kèm theo. Trước khi build package mới, cập nhật roadmap này.

## Điều chỉnh từ phản biện Hermes (2026-08-13)

Phản biện độc lập (Hermes agent) đã xem xét roadmap; các điểm đúng đã áp dụng:

- **Cắt `vn-stock-data`** — chỉ 1 dự án dùng, vi phạm quy tắc ≥2 dự án. Ingestion ở lại trong `vn-stock`.
- **#4 đổi hướng**: test hardening (loại test gọi API/DB thật, mock LLM dùng chung) thay vì tăng coverage lan man.
- **Version strategy**: `publish.yml` đã check version vs npm registry — chỉ publish version mới (không cần changesets cho solo dev).
- **`genai-tools` transitive risk** trong mcp deps map — ghi chú ở bảng cải thiện.
- **`node -c` syntax check** bổ sung vào ci.yml (CJS không build step).
- **2 dirty items** (sdlc-workflows manifest, hermes-bridge plan doc) = nợ kỹ thuật — ưu tiên dọn trong plan kế tiếp.
- **Logging**: core `Logger` đã structured — không cần package mới.

## Đã hoàn thành trong plan 2026-08-13-roadmap-execution

- **db-mongo v0.1.0** — `MongoDatabase` (connect/close/db/collection/ping/listCollections) + `MigrationRunner`; dep mongodb ^6; 10 tests green. vn-stock `StockDB` refactor wrap MongoDatabase, +dep db-mongo ^0.1.0.
- **cli v0.1.0** — zero-dep: `parseArgs` / `Spinner` / `loadConfig`; 8 tests green.
- **reporting v0.1.0** — `toMarkdown` / `toHTML` / `toPDF` (pdfkit ^0.15); 6 tests green.
- **Test hardening** — `MockLLMClient` (core/lib/mock-llm.js): canned responses, records calls, JSON mode, throws khi unconfigured; export + test + README note. Core: 34 tests green.
- **CI** — step syntax check `node -c` cho `packages/**/*.js` trong `.github/workflows/ci.yml`.
- **mcp** — deps +`@andy-toolforge/genai-tools ^0.1.0` (hết transitive qua vn-stock); version 1.3.6 → 1.3.7.
- **sdlc-workflows** — manifest verified no-drift (2026-08-13).
- **hermes-opencode-mcp-bridge** — plan doc có section `## Implementation Status (2026-08-13)`.
- **Skills** — `vn-stock-hub` + `vn-stock-trading-workflow` (+ postinstall), `llm-gateway-pipeline-guide` (+ hub update), `hermes-dispatch` (+ postinstall).
- Kết quả: **12/12 acceptance criteria ticked**, **885 tests green** (fail 0), root README 24 packages, ecosystem-catalog 23 entries.

## Skills cần bổ sung (đề xuất)

- `messaging-send-notification` — gửi thông báo qua Messenger facade (đã có trong package messaging)
- `vn-stock-*` — workflow phân tích cổ phiếu ✅ (vn-stock-hub.md + vn-stock-trading-workflow.md)
- `llm-gateway-*` — hướng dẫn xây stage/pipeline ✅ (llm-gateway-pipeline-guide.md)
- `hermes-*` — dispatch tác vụ agent qua Hermes CLI ✅ (hermes-dispatch.md)
- Review định kỳ: đối chiếu `packages/*/skills/` với list skills đang được LLMClient thực sự đọc

## Ngoài phạm vi / ghi chú

- **Không commit/push tự động** — user push thủ công (publish.yml auto-publish khi push `main`)
- **2 items dirty pre-existing** (nợ kỹ thuật, ưu tiên dọn trong plan kế tiếp): `.opencode/manifests/sdlc-workflows.json`,
  `docs/superpowers/plans/2026-08-08-hermes-opencode-mcp-bridge.md`
- Ưu tiên #2 (db-mongo) và #4 (test hardening) — ✅ Đã thực thi trong plan 2026-08-13-roadmap-execution
- Kiến trúc bất di bất dịch: CJS, không ESM; domain → core một chiều; không merge domain vào core;
  không đổi scope `@andy-toolforge`; không thêm convenience deps

---

*Cập nhật: 2026-08-13 (lần 3 — thực thi plan 2026-08-13-roadmap-execution). Nguồn: codebase review + plan `ci-messaging-hygiene-roadmap` + plan `2026-08-13-roadmap-execution` + phản biện Hermes.*