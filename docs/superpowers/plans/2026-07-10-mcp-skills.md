# MCP Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 skill files to `@andy-toolforge/mcp/skills/` with postinstall symlink mechanism (prefix `toolforge-`), following the footage-generation pattern.

**Architecture:** Skill `.md` files live in `packages/mcp/skills/`. A `scripts/postinstall.js` symlinks them into `.opencode/skills/` with prefix `toolforge-`. `package.json` is updated to include the new directories in `files` and add the `postinstall` script.

**Tech Stack:** CommonJS (`require`/`module.exports`), Node.js built-in `fs`/`path`

## Global Constraints

- All JS files use CommonJS (`require()`, `module.exports`) — no ESM
- postinstall.js uses only Node.js built-in modules (`fs`, `path`)
- Skill files use `skill_mcp(mcp_name="andy-toolforge", ...)` to invoke tools
- Symlink target format: `.opencode/skills/toolforge-<name>.md`
- Domain prefix: `toolforge-` (chosen by user, not `mcp-`)

---

### Task 1: Package infrastructure (package.json + postinstall.js)

**Files:**
- Modify: `packages/mcp/package.json`
- Create: `packages/mcp/scripts/postinstall.js`

**Interfaces:**
- Consumes: MCP package.json (needs `scripts` + `files` fields updated)
- Produces: postinstall.js that creates symlinks for all `.md` files in `skills/`

- [ ] **Step 1: Update package.json**

Add `"postinstall"` to `scripts`, add `"skills/"` and `"scripts/"` to `files`:

```json
{
  "files": [
    "lib/",
    "bin/",
    "skills/",
    "scripts/"
  ],
  "scripts": {
    "postinstall": "node scripts/postinstall.js",
    "test": "node --test lib/*.test.js"
  }
}
```

- [ ] **Step 2: Create postinstall.js**

Path: `packages/mcp/scripts/postinstall.js`

```javascript
const fs = require('fs');
const path = require('path');

const DOMAIN = 'toolforge';
const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, '.opencode', 'skills');
const sourceDir = path.join(__dirname, '..', 'skills');

fs.mkdirSync(targetDir, { recursive: true });

fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.md') && file !== 'postinstall.js') {
        const src = path.join(sourceDir, file);
        const destName = `${DOMAIN}-${file.replace(/\s+/g, '_')}`;
        const dest = path.join(targetDir, destName);
        if (!fs.existsSync(dest)) {
            try {
                fs.symlinkSync(path.relative(targetDir, src), dest);
                console.log(`  🔗 Linked ${destName}`);
            } catch (e) {
                // Fallback: copy if symlink fails
                fs.copyFileSync(src, dest);
                console.log(`  📄 Copied ${destName}`);
            }
        }
    }
});
```

Note: sourceDir uses `path.join(__dirname, '..', 'skills')` because this file is in `scripts/`, not in `skills/` (unlike footage-generation where postinstall lives inside `skills/`).

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/package.json packages/mcp/scripts/postinstall.js
git commit -m "feat(mcp): add postinstall.js and update package.json for skills
Add postinstall symlink script with prefix toolforge-, following the
footage-generation pattern. Update files[] and scripts[] in package.json."
```

---

### Task 2: Create the MCP Bridge skill (andy-toolforge.md)

**Files:**
- Create: `packages/mcp/skills/andy-toolforge.md`

**Interfaces:**
- Consumes: MCP server name `andy-toolforge`, the full tool list from the design doc
- Produces: Core skill file that declares MCP server + all 34 tools

- [ ] **Step 1: Create `packages/mcp/skills/andy-toolforge.md`**

```markdown
# Toolforge MCP Bridge

Kết nối agent với @andy-toolforge ecosystem thông qua MCP protocol.
Gọi bất kỳ tool nào trong 34 tools qua `skill_mcp`.

## MCP Server

Server name: `andy-toolforge` (khai báo trong opencode.json)

## Cách dùng

```
skill_mcp(mcp_name="andy-toolforge", tool_name="<tool>", arguments={...})
```

## Tools

### Visual Production
| Tool | Mô tả |
|------|-------|
| `analyze_script` | Phân tích script → visual segments + prompts |
| `generate_prompts` | 5 image prompts/segment (5 visual styles) |
| `generate_mapping` | Map BGM + sound design per segment |
| `suggest_cover` | Cover art (series/episode/thumbnail) |
| `generate_batch_image` | Batch generate images từ segments |

### SEO
| Tool | Mô tả |
|------|-------|
| `toolforge_seo_generate` | SEO metadata cho YouTube/TikTok/Facebook |

### Content Research
| Tool | Mô tả |
|------|-------|
| `andy_toolforge_content_summarizer` | Summarize articles/reports |
| `andy_toolforge_content_ideator` | Generate content ideas |
| `andy_toolforge_article_manager` | Classify, tag, summarize articles |
| `andy_toolforge_competitor_analyzer` | Crawl + LLM phân tích competitor |

### Content Operations
| Tool | Mô tả |
|------|-------|
| `toolforge_content_research` | Research trends, keywords, gaps |

### Business Analysis
| Tool | Mô tả |
|------|-------|
| `toolforge_competitor_analysis` | Crawl + profile competitor |
| `toolforge_pricing_analysis` | Phân tích pricing |
| `toolforge_swot_analysis` | SWOT từ competitor data |
| `toolforge_trend_analysis` | Market trends |
| `toolforge_business_report` | Business reports |

### Book Writing
| Tool | Mô tả |
|------|-------|
| `toolforge_book_outline` | Book outline từ topic |
| `toolforge_book_write_chapter` | Viết chapter với continuity |
| `toolforge_book_review` | Review manuscript |
| `toolforge_book_export` | Export (markdown/plain/html) |

### Project Management
| Tool | Mô tả |
|------|-------|
| `pm_create_project` | Tạo project |
| `pm_add_task` | Thêm task |
| `pm_track_time` | Track time |
| `pm_generate_report` | Generate report |
| `pm_calculate_invoice` | Tính invoice |

### TTS & Voice
| Tool | Mô tả |
|------|-------|
| `generate_tts` | Text-to-speech (Gemini TTS) |
| `list_tts_voices` | Danh sách 30 voices |
| `voice_assistant_session` | Voice conversation session |
| `voice_assistant_configure` | Cấu hình voice assistant |

### Code Analysis
| Tool | Mô tả |
|------|-------|
| `codebase_line_counts` | Count lines of code |
| `codebase_dead_code` | Find dead exports |
| `codebase_dependency_graph` | Dependency graph |
| `codebase_complexity` | Complexity report |

### Router
| Tool | Mô tả |
|------|-------|
| `toolforge_suggest` | Mô tả task → gợi ý tool phù hợp |
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/skills/andy-toolforge.md
git commit -m "feat(mcp): add MCP Bridge skill file (andy-toolforge.md)
Core skill declaring MCP server name and listing all 34 tools."
```

---

### Task 3: Create the 5 workflow skill files

**Files:**
- Create: `packages/mcp/skills/podcast-visual-production.md`
- Create: `packages/mcp/skills/podcast-content-strategy.md`
- Create: `packages/mcp/skills/podcast-project-manager.md`
- Create: `packages/mcp/skills/podcast-script-development.md`
- Create: `packages/mcp/skills/podcast-voice-production.md`

**Interfaces:**
- Consumes: MCP Bridge skill (task 2) defines the base tool calling pattern
- Produces: 5 workflow-specific skill files, each with concrete steps

- [ ] **Step 1: Create `packages/mcp/skills/podcast-visual-production.md`**

```markdown
# Podcast Visual Production

Tạo hình ảnh cho podcast episodes: từ script đến images + cover + BGM.

## Workflow

### Bước 1: Phân tích script

```
skill_mcp(mcp_name="andy-toolforge", tool_name="analyze_script", arguments={
  "script": "...", "title": "...", "density": 2, "lang": "vi"
})
```

Kết quả: segments array (mỗi segment có title + summary + prompts).

### Bước 2: Sinh image prompts chi tiết (optional)

Nếu muốn kiểm soát nhiều hơn prompts, gọi `generate_prompts`:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_prompts", arguments={
  "script": "...", "title": "...", "language": "vi", "density": 5
})
```

### Bước 3: Thiết kế cover art

```
skill_mcp(mcp_name="andy-toolforge", tool_name="suggest_cover", arguments={
  "title": "...", "description": "...", "coverType": "all", "language": "vi"
})
```

### Bước 4: Batch generate images

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_batch_image", arguments={
  "segments": [...], "outputDir": "./images"
})
```

### Bước 5: Map BGM + sound design (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_mapping", arguments={
  "segments": [...], "mood": "philosophical", "language": "vi"
})
```
```

- [ ] **Step 2: Create `packages/mcp/skills/podcast-content-strategy.md`**

```markdown
# Podcast Content Strategy

Research topics, phân tích competitor, tối ưu SEO cho podcast episodes.

## Workflow

### Bước 1: Research trends & keywords

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_content_research", arguments={
  "action": "trends", "niche": "podcast", "platform": "youtube", "language": "vi"
})
```

### Bước 2: Phân tích competitor

```
skill_mcp(mcp_name="andy-toolforge", tool_name="andy_toolforge_competitor_analyzer", arguments={
  "competitorUrl": "https://...", "analysisScope": "full", "lang": "vi"
})
```

### Bước 3: Generate SEO metadata

Sau khi có script hoàn chỉnh:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_seo_generate", arguments={
  "script": "...", "title": "...", "language": "vi"
})
```

Kết quả: SEO metadata cho YouTube (title, description, tags), TikTok, Facebook.
```

- [ ] **Step 3: Create `packages/mcp/skills/podcast-project-manager.md`**

```markdown
# Podcast Project Manager

Quản lý project, tasks, time tracking, và invoices cho sản xuất podcast.

## Workflow

### Bước 1: Tạo project

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_create_project", arguments={
  "name": "Podcast Season 2",
  "tasks": [{"name": "Write script Ep 1"}, {"name": "Record audio Ep 1"}]
})
```

Kết quả: project ID.

### Bước 2: Thêm task (nếu chưa tạo lúc đầu)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_add_task", arguments={
  "projectId": "...", "name": "Edit video", "status": "todo"
})
```

### Bước 3: Track thời gian

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_track_time", arguments={
  "taskId": "...", "durationMinutes": 120, "note": "Script outline"
})
```

### Bước 4: Generate report

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_generate_report", arguments={
  "projectId": "...", "format": "markdown"
})
```

### Bước 5: Tính invoice (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_calculate_invoice", arguments={
  "projectId": "...", "rate": 50
})
```
```

- [ ] **Step 4: Create `packages/mcp/skills/podcast-script-development.md`**

```markdown
# Podcast Script Development

Viết và review podcast scripts sử dụng book-writing tools.

## Workflow

### Bước 1: Generate outline

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_outline", arguments={
  "topic": "Lợi ích của thiền định", "chapters": 5
})
```

Sau đó mapping chapters → podcast segments.

### Bước 2: Viết từng chapter

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_write_chapter", arguments={
  "outline": {...}, "chapterIndex": 1
})
```

### Bước 3: Review consistency

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_review", arguments={
  "manuscript": {"title": "...", "chapters": [...]}
})
```

### Bước 4: Export (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_export", arguments={
  "manuscript": {...}, "format": "markdown"
})
```
```

- [ ] **Step 5: Create `packages/mcp/skills/podcast-voice-production.md`**

```markdown
# Podcast Voice Production

Text-to-speech và voice assistant cho podcast episodes.

## Workflow

### Bước 1: Liệt kê giọng đọc

```
skill_mcp(mcp_name="andy-toolforge", tool_name="list_tts_voices", arguments={})
```

Chọn voice phù hợp với nội dung (Zephyr, Puck, Charon, Kore...).

### Bước 2: Generate TTS

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_tts", arguments={
  "script": "...", "title": "...", "voice": "Zephyr",
  "language": "vi", "mode": "batch", "api_mode": "interactions"
})
```

### Bước 3: Voice assistant (optional)

Tương tác voice real-time:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="voice_assistant_session", arguments={
  "systemPrompt": "Bạn là trợ lý podcast...", "voice": "Zephyr"
})
```
```

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/skills/
git commit -m "feat(mcp): add 5 workflow skill files
- podcast-visual-production: analyze → prompts → covers → images → BGM
- podcast-content-strategy: research → competitor → SEO
- podcast-project-manager: project → tasks → time → report → invoice
- podcast-script-development: outline → write → review → export
- podcast-voice-production: TTS → voice assistant"
```

---

### Task 4: Verify integration

**Files:** None (verification only)

**Interfaces:** Consumes all files from tasks 1-3

- [ ] **Step 1: Verify postinstall creates correct symlinks**

Create a temporary directory and install the package:

```bash
cd /tmp
rm -rf test-mcp-skills
mkdir test-mcp-skills
cd test-mcp-skills
npm init -y
npm install /Users/admin/personal/toolforge/packages/mcp
```

Expected: console shows `🔗 Linked toolforge-<name>.md` for each of the 6 skill files.

- [ ] **Step 2: Verify symlink targets resolve correctly**

```bash
ls -la .opencode/skills/
cat .opencode/skills/toolforge-andy-toolforge.md
```

Expected: 6 symlinks pointing to the real `.md` files in MCP package, content readable.

- [ ] **Step 3: Clean up**

```bash
cd /Users/admin/personal/toolforge
rm -rf /tmp/test-mcp-skills
```
