# Toolforge — Domain Development Plan

> Dựa trên phân tích `browser-automation-opportunities.md` (927 dòng) và cấu trúc monorepo hiện tại.
> **Mục tiêu:** Biến các shell packages WIP thành domain packages đầy đủ (skills + lib + templates).

---

## Priority Matrix

| Domain | Ease | Impact | Urgency | Score | Bắt đầu |
|--------|------|--------|---------|-------|---------|
| **seo-generation** | 5 | 5 | Cao | **4.3** | Ngay |
| **book-writing** | 3 | 3 | Thấp | **2.6** | Sau SEO |
| **pm-support** | 4 | 2 | Trung bình | **2.8** | Sau SEO |
| **ba-support** | 2 | 2 | Thấp | **2.0** | Cuối cùng |
| **coding-support** | 4 | 2 | Trung bình | **2.8** | Sau SEO |

*Score = (Ease + Impact × 2) / (4 - Urgency)* với Urgency: Cao=1, TB=2, Thấp=3

---

## ✅ Phase 1: `@andy-toolforge/seo-generation` — Hoàn thành

> Dựa trên sections: 2.3 Marketing, 2.7 Content Arbitrage, 3.6 Niche Websites

### Skill files (3 files)

#### 1. `seo-video-podcast.md`
**Nguồn:** Từ project cũ, skill `video-podcast-seo` đã có.
**Chức năng:** Optimize SEO cho video podcast khi đăng YouTube, TikTok, Facebook.

```
Input: Tiêu đề tập + nội dung kịch bản
Output: Tiêu đề, mô tả, tags, timestamps, hashtag theo từng nền tảng
```

**Cấu trúc:**
- `# SEO Podcast Video Optimizer`
- Section cho từng nền tảng (YouTube, TikTok, Facebook)
- Rules về keyword, hashtag, description length
- Template output cho mỗi platform

#### 2. `seo-content-arbitrage.md`
**Nguồn:** Section 2.7 Content Arbitrage.
**Chức năng:** Biến 1 nội dung gốc thành nhiều format cho nhiều nền tảng.

```
Input: 1 bài viết / script gốc
Output: Blog post (2000 từ) + Twitter thread + TikTok script + FB post
```

**Cấu trúc:**
- `# Content Arbitrage Pipeline`
- Rules: tone of voice theo từng platform
- Format spec: blog (dài), thread (xâu chuỗi), short (kịch tính), post (ngắn gọn)
- Template: mỗi format có prompt structure riêng

#### 3. `seo-niche-blog-generator.md`
**Nguồn:** Section 3.6 Niche Websites + Affiliate.
**Chức năng:** Tạo blog content tự động cho niche site, tối ưu Google SEO + affiliate.

```
Input: Keyword / chủ đề
Output: Bài blog hoàn chỉnh (title, meta, content, image prompt, internal links)
```

**Cấu trúc:**
- `# Niche Blog Generator`
- Keyword research rules
- Content structure (H1 → H2 → H3)
- Internal linking strategy
- Affiliate link placement rules
- Image prompt sinh kèm

### Library modules

#### `lib/seo.js` — SEO Analyzer
```javascript
class SEOAnalyzer {
    analyzeYouTube(title, description, tags) { ... }
    analyzeFacebook(post, hashtags) { ... }
    analyzeTikTok(video, caption) { ... }
    generateKeywordCloud(text) { ... }
}
```

**Dependency:** `@andy-toolforge/core` → Logger

#### `lib/content-arbitrage.js` — Content Arbitrage Engine
```javascript
class ContentArbitrageEngine {
    expandToBlog(source) { ... }       // Script → Blog 2000 từ
    expandToThread(source) { ... }     // Script → Twitter threads
    expandToShort(source) { ... }      // Script → TikTok 60s
    expandToPost(source) { ... }       // Script → FB/LinkedIn post
    translateTo(targetLang, content) { ... }  // Dịch sang EN/JP/KR
}
```

**Dependency:** `@andy-toolforge/core` → LLMClient

#### `lib/publisher.js` — Multi-platform Publisher
```javascript
class MultiPlatformPublisher {
    publishToYouTube(video, metadata) { ... }   // Puppeteer upload
    publishToWordPress(post, images) { ... }    // Puppeteer hoặc REST
    publishToFacebook(content, images) { ... }  // Puppeteer
    scheduleContent(calendar) { ... }            // Lên lịch hàng loạt
}
```

**Dependency:** `@andy-toolforge/core` → BrowserManager, JobQueue

> ⚠️ **Risk:** `MultiPlatformPublisher` dùng Puppeteer để upload lên web UI (YouTube, WordPress, Facebook).
> Web UI có thể thay đổi bất kỳ lúc nào — script dễ hỏng. **Ưu tiên REST API** nếu platform hỗ trợ
> (WordPress REST API, YouTube Data API). Puppeteer chỉ dùng làm fallback.

### Templates

- `templates/youtube-seo-template.md`: Cấu trúc YouTube description + tags
- `templates/blog-post-template.md`: Cấu trúc blog post chuẩn SEO
- `templates/social-calendar.csv`: Mẫu lịch đăng bài

### Files to create (17 files)
```
packages/seo-generation/
├── lib/
│   ├── index.js              (create — add exports)
│   ├── seo.js                (new)
│   ├── seo.test.js           (new)
│   ├── content-arbitrage.js  (new)
│   ├── content-arbitrage.test.js (new)
│   ├── publisher.js          (new)
│   └── publisher.test.js     (new)
├── skills/
│   ├── postinstall.js        (update — thêm logging, hiện đã tồn tại)
│   ├── seo-video-podcast.md  (new)
│   ├── seo-content-arbitrage.md (new)
│   └── seo-niche-blog-generator.md (new)
└── templates/
    ├── youtube-seo-template.md (new)
    ├── blog-post-template.md   (new)
    ├── social-calendar.csv     (new)
    └── env.example             (new — platform API keys: YouTube, WordPress, Facebook)
```

**Cập nhật `package.json`:** giữ `postinstall` script, thêm `"test": "node --test lib/*.test.js"`.

**Version bump:** `0.1.0` → `1.0.0` (phát hành lần đầu).

### Estimated effort: 8-12 hours

> 💡 **Gợi ý tách phase:** Phase 1 có thể chia làm 2 sub-phase song song:
> - **Phase 1a** (4-6h): Skill files + `lib/seo.js` + templates — giá trị cốt lõi, dùng được ngay
> - **Phase 1b** (4-6h): `ContentArbitrageEngine` + `MultiPlatformPublisher` — risk cao hơn (publisher phụ thuộc web UI)

---

## ✅ Phase 2: `@andy-toolforge/pm-support` — Hoàn thành

> Dựa trên sections: 2.5 Cá nhân (Calendar), 2.8 Freelancer (quản lý client)

### Skill files

#### 1. `pm-project-planner.md`
**Chức năng:** Hỗ trợ AI lập kế hoạch dự án, breakdown tasks, ước lượng thời gian.

```
Input: Mô tả dự án
Output: Task list + dependencies + milestone + ước lượng
```

#### 2. `pm-meeting-assistant.md`
**Chức năng:** Hỗ trợ AI chuẩn bị và follow-up meeting.

```
Input: Agenda / ghi chú meeting
Output: Meeting summary + action items + follow-up schedule
```

### Library modules

#### `lib/tracker.js` — Time & Task Tracker
```javascript
class TaskTracker {
    createProject(name, tasks) { ... }
    trackTime(taskId, duration) { ... }
    generateReport(projectId) { ... }
    calculateInvoice(hours, rate) { ... }
}
```

**Dependency:** `@andy-toolforge/core` → Logger

### Files to create (8 files)
```
packages/pm-support/
├── lib/
│   ├── index.js          (create — add exports)
│   ├── tracker.js        (new)
│   └── tracker.test.js   (new)
├── skills/
│   ├── postinstall.js    (update — thêm logging)
│   ├── pm-project-planner.md (new)
│   └── pm-meeting-assistant.md (new)
└── templates/
    └── env.example       (new — LLM provider keys)
```

**Cập nhật `package.json`:** giữ `postinstall` script, thêm `"test": "node --test lib/*.test.js"`.

**Version bump:** `0.1.0` → `1.0.0`.

### Estimated effort: 4-6 hours

---

## ✅ Phase 3: `@andy-toolforge/coding-support` — Hoàn thành

> Dựa trên sections: 2.4 Data & Research, 2.9 Game

### Skill files

#### 1. `coding-code-reviewer.md`
**Chức năng:** Hướng dẫn AI review code theo chuẩn dự án, phát hiện bug, security issues.

```
Input: Code diff / file cần review
Output: Danh sách issues theo severity + đề xuất fix
```

#### 2. `coding-refactoring-advisor.md`
**Chức năng:** Hướng dẫn AI đề xuất refactoring dựa trên code patterns và best practices.

```
Input: File / module cần refactor
Output: Refactoring plan + steps + estimated effort
```

### Library modules

#### `lib/codebase-analyzer.js` — Codebase Stats Collector
```javascript
class CodebaseAnalyzer {
    countLines(filePattern) { ... }
    findDeadCode(entryPoints) { ... }
    generateDependencyGraph() { ... }
    complexityReport(files) { ... }
}
```

**Dependency:** `@andy-toolforge/core` → Logger

### Files to create (8 files)
```
packages/coding-support/
├── lib/
│   ├── index.js                (create — add exports)
│   ├── codebase-analyzer.js    (new)
│   └── codebase-analyzer.test.js (new)
├── skills/
│   ├── postinstall.js          (update — thêm logging)
│   ├── coding-code-reviewer.md (new)
│   └── coding-refactoring-advisor.md (new)
└── templates/
    └── env.example             (new — LLM provider keys)
```

**Cập nhật `package.json`:** giữ `postinstall` script, thêm `"test": "node --test lib/*.test.js"`.

**Version bump:** `0.1.0` → `1.0.0`.

### Estimated effort: 4-6 hours

---

## ✅ Phase 4: `@andy-toolforge/book-writing` — Hoàn thành

> Dựa trên sections: 2.9 Xuất bản / Sách, 2.7 Translation Arbitrage

### Skill files

#### 1. `book-writing-assistant.md`
**Chức năng:** Hỗ trợ AI viết sách từ outline → chapter → final draft.

```
Input: Chủ đề / outline sách
Output: Manuscript hoàn chỉnh theo chapter
```

#### 2. `book-summarizer.md`
**Chức năng:** Tạo summary sách (blog + video + slide).

```
Input: Nội dung sách (PDF / text)
Output: Tóm tắt + key takeaways + video script
```

### Library modules

#### `lib/writer.js` — Book Writer Engine
```javascript
class BookWriter {
    generateOutline(topic, chapters) { ... }
    writeChapter(outline, chapterIndex) { ... }
    reviewConsistency(manuscript) { ... }
    exportFormat(manuscript, format) { ... }
}
```

**Dependency:** `@andy-toolforge/core` → LLMClient

### Files to create (8 files)
```
packages/book-writing/
├── lib/
│   ├── index.js                  (create — add exports)
│   ├── writer.js                 (new)
│   └── writer.test.js            (new)
├── skills/
│   ├── postinstall.js            (update — thêm logging)
│   ├── book-writing-assistant.md (new)
│   └── book-summarizer.md       (new)
└── templates/
    └── env.example               (new — LLM provider keys)
```

**Cập nhật `package.json`:** giữ `postinstall` script, thêm `"test": "node --test lib/*.test.js"`.

**Version bump:** `0.1.0` → `1.0.0`.

### Estimated effort: 6-8 hours

---

## ✅ Phase 5: `@andy-toolforge/ba-support` — Business Analysis

> Dựa trên sections: 2.4 Market Research, 2.6 Theo ngành

### Skill files

#### 1. `ba-competitor-analysis.md`
**Chức năng:** Hướng dẫn AI phân tích competitor từ data crawl được.

```
Input: Danh sách competitor URLs / data
Output: Competitive analysis report
```

#### 2. `ba-requirement-gatherer.md`
**Chức năng:** Hỗ trợ AI thu thập và phân tích yêu cầu.

```
Input: Stakeholder interview notes
Output: Requirements document + user stories
```

### Library modules

#### `lib/researcher.js` — Market Research Tools
```javascript
class MarketResearcher {
    crawlCompetitor(url) { ... }
    analyzePricing(data) { ... }
    generateReport(findings) { ... }
    trackTrends(keywords) { ... }
}
```

**Dependency:** `@andy-toolforge/core` → BrowserManager, LLMClient

### Files to create (8 files)
```
packages/ba-support/
├── lib/
│   ├── index.js                      (create — add exports)
│   ├── researcher.js                 (new)
│   └── researcher.test.js            (new)
├── skills/
│   ├── postinstall.js                (update — thêm logging)
│   ├── ba-competitor-analysis.md     (new)
│   └── ba-requirement-gatherer.md    (new)
└── templates/
    └── env.example                   (new — LLM provider keys)
```

**Cập nhật `package.json`:** giữ `postinstall` script, thêm `"test": "node --test lib/*.test.js"`.

**Version bump:** `0.1.0` → `1.0.0`.

### Estimated effort: 4-6 hours

---

## Dependency Graph

```
                    ┌──────────────────┐
                    │  @andy-toolforge/core  │
                    │  (LLM, Browser,   │
                    │   Logger, Queue)  │
                    └────────┬─────────┘
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ footage-generation│   seo-generation  │   book-writing    │
│ (done)           │ │ (Phase 1)        │ │ (Phase 4)        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   pm-support    │ │ coding-support  │ │  ba-support      │
│ (Phase 2)       │ │ (Phase 3)       │ │ (Phase 5)        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Tất cả domain packages** depend on `@andy-toolforge/core` **nhưng không depend lẫn nhau.**

---

## Implementation Notes

### Skill file quality standards
- Mỗi skill file: 50-150 dòng (đủ để AI hiểu task mà không quá dài)
- Có sections rõ ràng: Goal → Input → Output → Rules → Examples
- Prefix tên file với domain name: `seo-video-podcast.md`
- Code samples trong skill bằng javascript (thực tế được)
- Tránh abstract — mỗi skill giải quyết 1 use case cụ thể

### Library module standards
- Mỗi module export 1 class (trừ khi quá nhỏ → function)
- Constructor nhận config object
- **Export convention:** `const X = require('./x'); module.exports = { X };` — consistent với core và footage-generation
- Method names: verb + Noun (generateReport, analyzeContent)
- Error handling: throw Error với message rõ ràng
- Async methods return Promise

### Test standards
- **Mỗi module có `*.test.js` đi kèm**, đặt cùng thư mục với module — đây là convention từ core (`llm.test.js`)
- Dùng `node --test` (Node built-in test runner) — không cần jest/vitae
- Mock external dependencies (puppeteer, sharp, REST APIs) để test logic thuần
- Mỗi method có ít nhất 1 test case: happy path + edge case
- Test description pattern: `it('methodName: does X when Y')`

### Postinstall script
- Copy skill files từ `skills/` → `.opencode/skills/` với prefix domain
- Dùng `fs.symlinkSync` nếu OS hỗ trợ, fallback `fs.copyFileSync`
- **Consistent logging:** mỗi file được link → `console.log(\`🔗 Linked ${destName}\`)` — theo pattern footage-generation
- Tất cả skeleton packages đã có postinstall.js, chỉ cần **update** thêm logging (không tạo mới)

### Template standards
- Template files đặt trong `templates/`
- Dùng `.md` cho text templates, `.csv` cho data templates
- Không hardcode domain-specific content trong template

---

## Execution Order

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Phase 1 │──▶│  Phase 2 │──▶│  Phase 3 │──▶│  Phase 4 │──▶│  Phase 5 │
│  SEO     │   │  PM      │   │  Coding  │   │  Book    │   │  BA      │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
    8-12h         4-6h          4-6h          6-8h          4-6h
                    ↑
                    │
            Có thể chạy song song
            (PM + Coding không conflict)
```

**Tổng effort:** 26-38 giờ.
**Ưu tiên tuyệt đối:** Phase 1 (SEO) — vì đã có skill cũ để migrate, impact cao nhất.

---

## Files not yet created (checklist)

### Phase 1 — SEO (18 files) ✅
- [x] `packages/seo-generation/lib/seo.js`
- [x] `packages/seo-generation/lib/seo.test.js`
- [x] `packages/seo-generation/lib/content-arbitrage.js`
- [x] `packages/seo-generation/lib/content-arbitrage.test.js`
- [x] `packages/seo-generation/lib/publisher.js`
- [x] `packages/seo-generation/lib/publisher.test.js`
- [x] `packages/seo-generation/lib/index.js` (update — thêm exports)
- [x] `packages/seo-generation/skills/postinstall.js` (update — thêm logging)
- [x] `packages/seo-generation/skills/seo-video-podcast.md`
- [x] `packages/seo-generation/skills/seo-content-arbitrage.md`
- [x] `packages/seo-generation/skills/seo-niche-blog-generator.md`
- [x] `packages/seo-generation/templates/youtube-seo-template.md`
- [x] `packages/seo-generation/templates/blog-post-template.md`
- [x] `packages/seo-generation/templates/social-calendar.csv`
- [x] `packages/seo-generation/templates/env.example`
- [x] `packages/seo-generation/package.json` (update — thêm test script + bump version 0.1.0→1.0.0)

### Phase 2 — PM (8 files)
- [ ] `packages/pm-support/lib/tracker.js`
- [ ] `packages/pm-support/lib/tracker.test.js`
- [ ] `packages/pm-support/lib/index.js` (update — thêm exports)
- [ ] `packages/pm-support/skills/postinstall.js` (update — thêm logging)
- [ ] `packages/pm-support/skills/pm-project-planner.md`
- [ ] `packages/pm-support/skills/pm-meeting-assistant.md`
- [ ] `packages/pm-support/templates/env.example`
- [ ] `packages/pm-support/package.json` (update — thêm test script + bump version 0.1.0→1.0.0)

### Phase 3 — Coding (8 files)
- [ ] `packages/coding-support/lib/codebase-analyzer.js`
- [ ] `packages/coding-support/lib/codebase-analyzer.test.js`
- [ ] `packages/coding-support/lib/index.js` (update — thêm exports)
- [ ] `packages/coding-support/skills/postinstall.js` (update — thêm logging)
- [ ] `packages/coding-support/skills/coding-code-reviewer.md`
- [ ] `packages/coding-support/skills/coding-refactoring-advisor.md`
- [ ] `packages/coding-support/templates/env.example`
- [ ] `packages/coding-support/package.json` (update — thêm test script + bump version 0.1.0→1.0.0)

### Phase 4 — Book (8 files)
- [ ] `packages/book-writing/lib/writer.js`
- [ ] `packages/book-writing/lib/writer.test.js`
- [ ] `packages/book-writing/lib/index.js` (update — thêm exports)
- [ ] `packages/book-writing/skills/postinstall.js` (update — thêm logging)
- [ ] `packages/book-writing/skills/book-writing-assistant.md`
- [ ] `packages/book-writing/skills/book-summarizer.md`
- [ ] `packages/book-writing/templates/env.example`
- [ ] `packages/book-writing/package.json` (update — thêm test script + bump version 0.1.0→1.0.0)

### Phase 5 — BA (8 files) ✅
- [x] `packages/ba-support/lib/researcher.js`
- [x] `packages/ba-support/lib/researcher.test.js`
- [x] `packages/ba-support/lib/index.js` (update — thêm exports)
- [x] `packages/ba-support/skills/postinstall.js` (update — thêm logging)
- [x] `packages/ba-support/skills/ba-competitor-analysis.md`
- [x] `packages/ba-support/skills/ba-requirement-gatherer.md`
- [x] `packages/ba-support/templates/env.example`
- [x] `packages/ba-support/package.json` (update — thêm test script + bump version 0.1.0→1.0.0)

## Summary

| Domain | Skills | Lib modules | Tests | Templates | Env | Version | Effort | Priority |
|--------|--------|-------------|-------|-----------|-----|---------|--------|----------|
| seo-generation | 3 | 3 | 3 | 3 | 1 | 0.1.0→1.0.0 | 8-12h | 🥇 |
| pm-support | 2 | 1 | 1 | 0 | 1 | 0.1.0→1.0.0 | 4-6h | 🥈 |
| coding-support | 2 | 1 | 1 | 0 | 1 | 0.1.0→1.0.0 | 4-6h | 🥈 |
| book-writing | 2 | 1 | 1 | 0 | 1 | 0.1.0→1.0.0 | 6-8h | 🥉 |
| ba-support | 2 | 1 | 1 | 0 | 1 | 0.1.0→1.0.0 | 4-6h | 🥉 |
| **Total** | **11** | **7** | **7** | **3** | **5** | | **26-38h** | |

---

*Plan generated: 01/07/2026. Dựa trên `browser-automation-opportunities.md` và cấu trúc monorepo hiện tại.*
