# Migration Guide: Client Project → Toolforge

Hướng dẫn chuyển một client project từ local `lib/` files sang toolforge packages.

## Overview

Các bước tổng quát:
1. Toolforge packages available (local link hoặc published)
2. Cập nhật `package.json`
3. Sửa imports
4. Chạy postinstall skills
5. Xoá old lib files

## Step-by-step (VD: generate-images-for-podcast)

### 1. Toolforge packages

```bash
cd ~/personal/toolforge
npm install
for pkg in packages/*; do (cd "$pkg" && npm link); done
```

### 2. Link vào client project

```bash
cd ~/personal/generate-images-for-podcast
npm link @andy-toolforge/core @andy-toolforge/footage-generation
```

### 3. Cập nhật package.json

**Trước** (direct deps):
```json
{
  "dependencies": {
    "puppeteer": "^25.1.0",
    "sharp": "^0.35.2",
    "uuid": "^14.0.1",
    "express": "^5.2.1",
    "dotenv": "^17.4.2"
  }
}
```

**Sau** (toolforge):
```json
{
  "dependencies": {
    "@andy-toolforge/core": "^1.0.0",
    "@andy-toolforge/footage-generation": "^1.0.0",
    "express": "^5.2.1",
    "dotenv": "^17.4.2"
  }
}
```

> `puppeteer`, `sharp`, `uuid` được quản lý bởi toolforge packages.

### 4. Sửa imports (server.js)

**Trước:**
```js
const LLMClient = require('./lib/llm');
const PromptWriter = require('./lib/writer');
const ImageGenerator = require('./lib/generator');
const TextOverlayer = require('./lib/overlay');
```

**Sau:**
```js
const { PromptWriter, ImageGenerator, TextOverlayer, LLMClient } = require('@andy-toolforge/footage-generation');
```

### 5. Cài skill files

```bash
node node_modules/@andy-toolforge/footage-generation/skills/postinstall.js
```

Kiểm tra:
```bash
ls .opencode/skills/ | grep footage-generation
# footage-generation-workflow-podcast-processor.md
# footage-generation-podcast-cover-generator.md
# footage-generation-browser-automation-opportunities.md
```

### 6. Xoá old lib files

```bash
rm lib/llm.js lib/generator.js lib/writer.js lib/overlay.js
# Giữ lại lib/job.js nếu là job manager custom
```

### 7. Verify

```bash
node server.js
curl -X POST http://localhost:3456/jobs/new \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test","script":"Hello world","lang":"vi"}'
```

## Migration map

| Old file | New location |
|----------|-------------|
| `lib/llm.js` | `@andy-toolforge/footage-generation` LLMClient (extends core) |
| `lib/generator.js` | `@andy-toolforge/footage-generation` ImageGenerator |
| `lib/overlay.js` | `@andy-toolforge/footage-generation` TextOverlayer |
| `lib/writer.js` | `@andy-toolforge/footage-generation` PromptWriter |
| `lib/job.js` | Keep local (tightly coupled) |
| `lib/logger.js` | `@andy-toolforge/core` Logger |
| `lib/browser.js` | `@andy-toolforge/core` BrowserManager |
| `lib/queue.js` | `@andy-toolforge/core` JobQueue |
| `.opencode/skills/workflow-podcast-processor.md` | Installed by package as `footage-generation-workflow-podcast-processor.md` |

## General pattern for any domain

Khi migrate một domain mới:

1. Xác định các module trong `lib/` cần chuyển
2. Tạo/update package tương ứng trong toolforge
3. Các module dùng chung (LLM, browser, logger) → `@andy-toolforge/core`
4. Các module domain-specific → `@andy-toolforge/<domain>`
5. Skill files → package's `skills/`
6. Client project install package, update imports, xoá old files
