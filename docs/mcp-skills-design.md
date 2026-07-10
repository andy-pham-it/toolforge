# MCP Skills — Design Doc

> Adding 6 skill files to `@andy-toolforge/mcp/skills/` with postinstall symlink mechanism.
> Ngày: 2026-07-10

## Goal

Thêm skill files vào MCP package để AI agents có thể gọi 34 toolforge tools qua `skill_mcp` với workflow cụ thể cho từng domain (visual production, content strategy, project management, script development, voice production).

## Approach

**Approach A** — Follow footage-generation pattern:

- Tạo `packages/mcp/skills/` chứa 6 `.md` skill files
- `postinstall.js` symlink vào `.opencode/skills/` với prefix `toolforge-`
- Update `package.json`: thêm `scripts.postinstall`, thêm `skills/` + `scripts/` vào `files`

## Package changes

### `packages/mcp/package.json`

```diff
 {
+  "scripts": {
+    "postinstall": "node scripts/postinstall.js",
+    "test": "node --test lib/*.test.js"
+  },
-  "scripts": {
-    "test": "node --test lib/*.test.js"
-  },
-  "files": ["lib/", "bin/"],
+  "files": ["lib/", "bin/", "skills/", "scripts/"],
 }
```

### `packages/mcp/scripts/postinstall.js`

Copy từ `packages/footage-generation/skills/postinstall.js` với 2 thay đổi:

```javascript
// before:
const DOMAIN = 'footage-generation';
// after:
const DOMAIN = 'toolforge';
```

Note: source dir là `path.join(__dirname, '..', 'skills')` vì postinstall đặt trong `scripts/`, khác footage-generation (đặt trong `skills/`).

## Skill files (6 files in `packages/mcp/skills/`)

### 1. `andy-toolforge.md` — MCP Bridge

**Core skill.** Khai báo MCP server name `andy-toolforge` và danh sách 34 tools. Agent dùng skill này để biết cách gọi bất kỳ tool nào qua `skill_mcp`.

Cấu trúc:
- MCP Server name + cách dùng skill_mcp
- Danh sách tools theo nhóm (Visual Production, SEO, Content Research, Content Operations, Business Analysis, Book Writing, Project Management, TTS & Voice, Code Analysis, Router)

### 2. `podcast-visual-production.md` — Visual Production Pipeline

Workflow từ script đến images hoàn chỉnh:
1. `analyze_script` — phân tích script → segments
2. `generate_prompts` — sinh prompts chi tiết (optional)
3. `suggest_cover` — thiết kế cover art
4. `generate_batch_image` — batch generate images
5. `generate_mapping` — map BGM + sound design (optional)

### 3. `podcast-content-strategy.md` — Research + SEO

1. Research trends/keywords/gaps (`toolforge_content_research`)
2. Phân tích competitor (`andy_toolforge_competitor_analyzer`)
3. SEO metadata (`toolforge_seo_generate`)

### 4. `podcast-project-manager.md` — Project Management

1. Tạo project (`pm_create_project`)
2. Add tasks (`pm_add_task`)
3. Track time (`pm_track_time`)
4. Generate report (`pm_generate_report`)
5. Tính invoice (`pm_calculate_invoice`)

### 5. `podcast-script-development.md` — Script Writing

1. Outline (`toolforge_book_outline`)
2. Write chapters (`toolforge_book_write_chapter`)
3. Review (`toolforge_book_review`)
4. Export (`toolforge_book_export`)

### 6. `podcast-voice-production.md` — TTS + Voice

1. List voices (`list_tts_voices`)
2. Generate TTS (`generate_tts`)
3. Voice assistant (`voice_assistant_session`)

## Naming convention

- Skill file gốc trong `skills/`: `<name>.md` (vd: `andy-toolforge.md`)
- Symlink target: `.opencode/skills/toolforge-<name>.md` (vd: `.opencode/skills/toolforge-andy-toolforge.md`)
- postinstall.js xử lý prefix tự động: `${DOMAIN}-${file}` với `DOMAIN = 'toolforge'`

## Postinstall mechanism

```javascript
// scripts/postinstall.js
const DOMAIN = 'toolforge';
const sourceDir = path.join(__dirname, '..', 'skills');
// ...
// Tạo symlink: .opencode/skills/toolforge-<name>.md → ../../<relative>/skills/<name>.md
```

Fallback: copy file nếu symlink fails (cross-device, filesystem không hỗ trợ).

## Constraints

- **CommonJS** — postinstall.js dùng `require()` như toàn bộ monorepo
- **Không dependency mới** — chỉ dùng `fs`, `path` (built-in)
- **Prefix `toolforge-`** — tránh xung đột với footage-generation (`footage-generation-`) và các domain package khác

## Out of scope

- Nội dung chi tiết từng skill file (sẽ viết trong implementation phase)
- Thêm test cho postinstall.js

## Open questions

- Postinstall đặt trong `scripts/` (tách rời khỏi skills/) hay `skills/` (gần source)? Quyết định: `scripts/` — giữ skills/ chỉ chứa `.md` files.
