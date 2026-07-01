# @podcast-platform Ecosystem Design

> **Date:** 2026-06-30
> **Status:** Final — approved architecture
> **Next:** Implementation plan

## 1. Problem

Cần một hệ thống cho phép chia sẻ skills (.opencode/skills/*.md), tool code (lib/), templates, dependencies, và database connectors giữa nhiều dự án cá nhân (podcast visual production, SEO content, book writing, v.v.) trên nhiều máy khác nhau.

**Yêu cầu:**
- Local-first, không push skills/code lên git của dự án cụ thể
- Chia sẻ qua GitHub private, đồng bộ đa máy
- Dùng npm package để quản lý version
- Hỗ trợ MongoDB, Postgres (Supabase), Firebase
- Mỗi dự án chỉ install package mình cần
- Mỗi lĩnh vực là một package độc lập (domain package)

## 2. Kiến trúc: Ma trận 2 chiều

Hệ thống kết hợp 2 chiều: **infra packages** (kỹ thuật, dùng chung) và **domain packages** (theo lĩnh vực, đóng gói đầy đủ).

```
                    Infra (dùng chung mọi domain)
                    ┌──────────────────────────────────┐
                    │ @podcast-platform/core           │
                    │ @podcast-platform/db-mongo       │
                    │ @podcast-platform/db-firebase    │
                    │ @podcast-platform/cli            │
                    └──────┬───────────────────────────┘
                           │ phụ thuộc
                           ▼
Domain 1:              Domain 2:              Domain 3:
@podcast-platform/     @podcast-platform/     @podcast-platform/
footage-generation     seo-generation         book-writing
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ skills/         │   │ skills/         │   │ skills/         │
│   podcast.md    │   │   seo-workflow  │   │   book-workflow │
│   cover-gen.md  │   │   keyword-res   │   │   chapter-gen   │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ lib/            │   │ lib/            │   │ lib/            │
│   llm.js        │   │   llm.js        │   │   llm.js        │
│   generator.js  │   │   keyword.js    │   │   chapter.js    │
│   overlay.js    │   │   outline.js    │   │   editor.js     │
│   writer.js     │   │   audit.js      │   │   format.js     │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ templates/      │   │ templates/      │   │ templates/      │
│ prompts.md      │   │ seo-check-list  │   │ book-templates  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

### 2.1 Nguyên tắc

- **Infra packages** chứa code dùng chung: browser manager, database connectors, CLI foundation
- **Domain packages** chứa skills + lib + templates cho 1 lĩnh vực cụ thể, đóng gói hoàn chỉnh
- Nếu code nào có thể dùng chung cho nhiều domain → đưa lên infra
- Nếu code chỉ dùng riêng cho 1 domain → giữ trong domain đó
- Mỗi domain package có thể có bản copy `lib/llm.js` riêng nếu cần customize — nhưng khuyến khích dùng từ `core`

## 3. Monorepo Base

> **Package manager:** npm workspaces.

```
GitHub: user/podcast-platform (private, npm workspaces)
├── packages/
│   │
│   │ ─── Infra ───
│   ├── core/                     → @podcast-platform/core
│   ├── db-mongo/                 → @podcast-platform/db-mongo
│   ├── db-firebase/              → @podcast-platform/db-firebase
│   ├── cli/                      → @podcast-platform/cli
│   │
│   │ ─── Domain ───
│   ├── footage-generation/       → @podcast-platform/footage-generation
│   ├── seo-generation/           → @podcast-platform/seo-generation
│   ├── book-writing/             → @podcast-platform/book-writing
│   ├── pm-support/               → @podcast-platform/pm-support
│   ├── ba-support/               → @podcast-platform/ba-support
│   ├── coding-support/           → @podcast-platform/coding-support
│   └── ...                       ← Thêm domain mới sau
│
├── package.json                  ← npm workspaces
├── .github/workflows/publish.yml ← CI: publish packages khi merge main
└── README.md
```

### 3.1 Cấu trúc mỗi domain package

```text
packages/footage-generation/
├── package.json           ← { name: "@podcast-platform/footage-generation",
│                              dependencies: { "@podcast-platform/core": "^1.0.0" } }
├── skills/                ← Skill files cho domain này
│   ├── workflow-podcast-processor.md
│   └── podcast-cover-generator.md
│   └── postinstall.js     ← Symlink skills/*.md → .opencode/skills/
├── lib/                   ← Tool code
│   ├── llm.js             ← Nếu cần customize riêng (ưu tiên dùng core)
│   ├── generator.js       ← Gemini batch
│   ├── overlay.js         ← Sharp overlay
│   └── writer.js          ← Prompt/mapping writer
├── templates/             ← Templates cho domain
│   ├── prompts-template.md
│   └── mapping-template.md
└── bin/                   ← CLI riêng (tùy chọn)
    └── generate-footage.cjs
```

### 3.2 Cấu trúc infra package

```text
packages/core/
├── package.json
├── lib/
│   ├── browser.js         ← Puppeteer browser manager
│   ├── logger.js          ← Logger
│   ├── queue.js           ← Job queue
│   └── llm.js             ← LLM client base (Groq/Gemini/OpenAI)
└── bin/                   ← CLI base (tùy chọn)
```

## 4. Package Specifications

### 4.1 Infra Packages

#### `@podcast-platform/core`

**Mục đích:** Foundation cho mọi project.
**Nội dung:**

| Module | Mô tả |
|---|---|
| `lib/browser.js` | Quản lý Puppeteer instance dùng chung |
| `lib/logger.js` | Logger (pino hoặc console) |
| `lib/queue.js` | File-based job queue |
| `lib/llm.js` | LLM client: Groq, Gemini, OpenAI (provider-agnostic) |

**Dependencies:** `puppeteer`, `uuid`

```javascript
const { BrowserManager, Logger, JobQueue, LLMClient } = require('@podcast-platform/core');

const llm = new LLMClient({
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
});
```

#### `@podcast-platform/db-mongo`

**Mục đích:** MongoDB connection + schemas.
**Dependencies:** `mongoose`

```javascript
const { connectDB, models } = require('@podcast-platform/db-mongo');
await connectDB(process.env.MONGODB_URI);
```

#### `@podcast-platform/db-firebase`

**Mục đích:** Firebase integration — Firestore, Auth, Storage.
**Dependencies:** `firebase-admin`

```javascript
const { app, db, storage } = require('@podcast-platform/db-firebase');
```

#### `@podcast-platform/cli`

**Mục đích:** CLI tools dùng chung cho mọi domain.

```json
{
  "bin": {
    "pp-init": "./bin/init.js",
    "pp-update": "./bin/update.js",
    "pp-new-domain": "./bin/new-domain.js"
  }
}
```

### 4.2 Domain Packages

#### `@podcast-platform/footage-generation`

**Mục đích:** Sản xuất hình ảnh/video cho podcast.

| Khoản mục | Mô tả |
|---|---|
| **skills/** | `workflow-podcast-processor.md`, `podcast-cover-generator.md`, `browser-automation-opportunities.md` |
| **lib/llm.js** | LLM client (dùng `require('@podcast-platform/core').LLMClient` — ưu tiên dùng từ core, không copy code) |
| **lib/generator.js** | Gemini batch image generator |
| **lib/overlay.js** | Sharp SVG text overlay |
| **lib/writer.js** | Viết prompts.md + mapping-phan-canh.md |
| **templates/** | Prompt templates, cover templates |
| **Dependencies** | `@podcast-platform/core`, `sharp` |

#### `@podcast-platform/seo-generation`

**Mục đích:** Tạo nội dung SEO cho YouTube, TikTok, blog.

| Khoản mục | Mô tả |
|---|---|
| **skills/** | Video-seo-workflow.md (hiện tại đã có) |
| **lib/llm.js** | LLM client (base từ core) |
| **lib/keyword.js** | Keyword research + clustering |
| **lib/outline.js** | Tạo outline từ script |
| **lib/audit.js** | Audit SEO cho video |
| **templates/** | SEO checklist, keyword template |
| **Dependencies** | `@podcast-platform/core` |

#### `@podcast-platform/book-writing`

**Mục đích:** Hỗ trợ viết sách (outline → chapter → edit → format).

| Khoản mục | Mô tả |
|---|---|
| **skills/** | book-writing-workflow.md |
| **lib/chapter.js** | Tạo chapter từ outline |
| **lib/editor.js** | Review + edit nội dung |
| **lib/format.js** | Định dạng xuất bản (PDF, ePub, Kindle) |
| **templates/** | Book structure templates |
| **Dependencies** | `@podcast-platform/core` |

#### `@podcast-platform/pm-support`

**Mục đích:** Hỗ trợ Project Manager — tự động hóa báo cáo, tracking, planning.

#### `@podcast-platform/ba-support`

**Mục đích:** Hỗ trợ Business Analyst — phân tích yêu cầu, tạo tài liệu BRD/FRD.

#### `@podcast-platform/coding-support`

**Mục đích:** Hỗ trợ lập trình — code review, sinh code, tạo test, refactor.

## 5. Cơ chế symlink skills

Mỗi domain package có postinstall script:

```javascript
// packages/footage-generation/skills/postinstall.js
// Chạy sau npm install: symlink skills/*.md vào .opencode/skills/
// Mỗi file được prefix bằng tên domain để tránh conflict tên
const fs = require('fs');
const path = require('path');

const DOMAIN = 'footage-generation'; // Đổi theo từng domain
const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, '.opencode', 'skills');
const sourceDir = path.join(__dirname);

fs.mkdirSync(targetDir, { recursive: true });

fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.md') && file !== 'postinstall.js') {
        const src = path.join(sourceDir, file);
        // Prefix domain để tránh trùng tên giữa các domain
        const destName = `${DOMAIN}-${file.replace(/\s+/g, '_')}`;
        const dest = path.join(targetDir, destName);
        if (!fs.existsSync(dest)) {
            fs.symlinkSync(path.relative(targetDir, src), dest);
        }
    }
});
```

Khi 1 project install nhiều domain packages, tất cả skill files đều xuất hiện trong `.opencode/skills/` với prefix domain:
- `footage-generation-workflow-podcast-processor.md`
- `footage-generation-podcast-cover-generator.md`
- `seo-generation-video-seo-workflow.md`

## 6. Luồng hoạt động

### 6.1 Tạo project podcast mới

```bash
mkdir ~/projects/my-podcast && cd my-podcast
npm init -y
npm install @podcast-platform/core
npm install @podcast-platform/footage-generation
npm install @podcast-platform/seo-generation   # Nếu cần SEO
# skills tự động symlink vào .opencode/skills/
```

### 6.2 Tạo project viết sách mới

```bash
mkdir ~/projects/my-book && cd my-book
npm init -y
npm install @podcast-platform/core
npm install @podcast-platform/book-writing
```

### 6.3 Cập nhật base

```bash
cd ~/dev/podcast-platform && git pull
cd ~/projects/my-podcast && npm update @podcast-platform/footage-generation
```

### 6.4 Clone sang máy khác

```bash
git clone git@github.com:user/my-podcast.git
cd my-podcast && npm install     # Kéo tất cả packages từ GitHub
# Mọi thứ sẵn sàng
```

## 7. .gitignore mẫu cho client project

```gitignore
node_modules/
.opencode/skills/     # Symlinks — không push
.env.local
outputs/
*.png
*.mp4
```

## 8. Database

Mỗi project tự quyết định có dùng DB không:

| Package | Dùng khi | Giới hạn |
|---|---|---|
| `@podcast-platform/db-mongo` | Cần document store, job queue | MongoDB Atlas free 512MB |
| `@podcast-platform/db-firebase` | Cần realtime, auth, file storage | Firebase Spark free |

Không bắt buộc. Project nhỏ chạy file-based hoàn toàn OK.

## 9. Kế thừa từ Podcast Vision hiện tại

| File hiện tại | Về đâu |
|---|---|
| `lib/llm.js` | `@podcast-platform/core/lib/llm.js` |
| `lib/job.js` | `@podcast-platform/core/lib/queue.js` |
| `_private/gemini-batch-generate.cjs` | `@podcast-platform/footage-generation/lib/generator.js` |
| `lib/overlay.js` | `@podcast-platform/footage-generation/lib/overlay.js` |
| `lib/writer.js` | `@podcast-platform/footage-generation/lib/writer.js` |
| `.opencode/skills/workflow-podcast-processor.md` | `@podcast-platform/footage-generation/skills/` |
| `.opencode/skills/podcast-cover-generator.md` | `@podcast-platform/footage-generation/skills/` |
| `.opencode/skills/browser-automation-opportunities.md` | `@podcast-platform/footage-generation/skills/` |
| `server.js` | Giữ lại trong project (code riêng) |
| `web/index.html` | Giữ lại trong project (frontend riêng) |

## 10. Mở rộng tương lai

- **Coding-support package:** Linter tự động, PR reviewer, test generator
- **Ba-support package:** BRD generator, user story mapper, flow diagram generator
- **Pm-support package:** Sprint report, burndown chart, meeting note generator
- **Plugin system:** Cho phép load skill từ nhiều domain packages cùng lúc

## 11. Non-goals

- Không phải platform public — personal use
- Không phải SaaS
- Không cần user management
- Không CI/CD cho client project
