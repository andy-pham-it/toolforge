# Toolforge Architecture

## Overview

Toolforge là monorepo chứa các package npm dùng chung cho mọi dự án automation
cá nhân. Mỗi package phục vụ một **domain** riêng: sinh ảnh podcast, SEO content,
viết sách, hỗ trợ PM/BA, coding tools.

## Package classification

### Infra packages (nền tảng)

Cung cấp foundational services:

- **`@andy-toolforge/core`**: LLM client, browser automation, logger, job queue
- **`@andy-toolforge/db-mongo`** (planned): MongoDB connection, migration helpers
- **`@andy-toolforge/cli`** (planned): CLI framework dùng chung

### Domain packages (nghiệp vụ)

Mỗi domain package là một self-contained module, phụ thuộc vào `@andy-toolforge/core`
nhưng không phụ thuộc lẫn nhau:

- **`@andy-toolforge/footage-generation`**: Sinh ảnh/video cho podcast
- **`@andy-toolforge/seo-generation`**: Tối ưu SEO content
- **`@andy-toolforge/book-writing`**: Hỗ trợ viết sách
- **`@andy-toolforge/pm-support`**: Project management tools
- **`@andy-toolforge/ba-support`**: Business analysis tools
- **`@andy-toolforge/coding-support`**: Coding automation tools

## Module structure (mỗi package)

```
packages/<name>/
├── lib/
│   ├── index.js          # Export tất cả public API
│   ├── <module1>.js      # Một module chức năng
│   └── <module2>.js
├── skills/
│   ├── postinstall.js    # Symlink skill files vào .opencode/skills/
│   ├── <skill-name>.md   # Agent skill cho domain này
│   └── ...
├── templates/
│   └── ...               # File mẫu (prompt templates, config mẫu)
└── package.json
```

## LLMClient class hierarchy

```
@andy-toolforge/core/lib/llm.js
  → LLMClient (generic)
    - chat(systemPrompt, userPrompt, jsonMode)
    - Hỗ trợ provider: groq, gemini, openai

@andy-toolforge/footage-generation/lib/llm.js
  → LLMClient extends CoreLLMClient
    - analyzeScript(script, title, outline, density, lang)
    - generateCoverPrompts(title, outline, lang)
    - Đọc skill file từ .opencode/skills/ với prefix footage-generation-

Domain package X/lib/llm.js
  → LLMClient extends CoreLLMClient
    - Các method domain-specific, đọc skill file với prefix <domain>-
```

## Skill file mechanism

Domain packages ship skill `.md` files trong thư mục `skills/`.
Sau `npm install` (hoặc postinstall), các file này được symlink/copy vào
`.opencode/skills/` của client project với prefix tên domain:

```
postinstall.js:
  footage-generation-workflow-podcast-processor.md
  footage-generation-podcast-cover-generator.md
  footage-generation-browser-automation-opportunities.md
```

Prefix tránh xung đột tên khi nhiều domain package cài trong cùng project.

## Key design decisions

### Tại sao monorepo mà không phải multi-repo?
- Dễ sync — một `npm install` là xong
- Dễ refactor — workspace link cho hiệu lực ngay
- Dễ publish — CI xử lý từ root

### Tại sao CommonJS?
- Tương thích với tất cả client project (cả CJS và ESM)
- Đơn giản, không cần build step

### Tại sao mỗi domain một package riêng?
- Không kéo dependency không cần thiết
- Mỗi domain có version lifecycle riêng
- Client project chỉ install đúng package cần

### Tại sao skill file prefix?
- Tránh collision: `workflow-podcast-processor.md` có thể trùng giữa các domain
- Phân loại rõ: `footage-generation-` ∈ footage package, `seo-` ∈ seo package

## Appendix: Standalone Scripts

### gemini-batch-generate.cjs

Located at `_private/gemini-batch-generate.cjs` in the original client project.
**Decision:** NOT migrated to toolforge. Rationale:

- Tightly coupled to Gemini Images web UI (uses Puppeteer to drive
  `gemini.google.com/images` DOM — brittle by nature)
- Retry logic pattern already migrated to core's `LLMClient.chat()`
- Script is standalone, CLI-based, and project-specific
- If needed in another project, copy as-is and adapt

To use: `node _private/gemini-batch-generate.cjs <prompts-file> [output-dir]`
