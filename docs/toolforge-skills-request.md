# Yêu cầu: Predefined skills cho @andy-toolforge/mcp

## Vấn đề

Hiện tại `@andy-toolforge/mcp` v1.3.1 có 34 tools từ 11 domain packages, nhưng agent không thể gọi chúng từ OpenCode vì:

1. `skill_mcp` yêu cầu MCP server phải được khai báo trong skill YAML frontmatter
2. MCP server global (`~/.config/opencode/opencode.jsonc`) không được skill_mcp nhận diện
3. Không có skill file nào khai báo `andy-toolforge` server → agent không thể dùng tool linh động

## Giải pháp

Đưa **6 skill files** vào `@andy-toolforge/mcp/skills/`, kèm `postinstall.js` tự động copy vào `.opencode/skills/` khi cài package (pattern giống `@andy-toolforge/footage-generation`).

---

## Skill 1: `andy-toolforge` — MCP Bridge (quan trọng nhất)

**File:** `skills/andy-toolforge.md`

Skill cốt lõi — khai báo MCP server để agent có thể gọi bất kỳ tool nào trong 34 tools qua `skill_mcp`. Không có skill này, tất cả skill dưới đây đều vô dụng.

```yaml
---
name: andy-toolforge
description: Truy cập tất cả @andy-toolforge MCP tools (34 tools từ 11 packages). Agent gọi tool cần dùng qua skill_mcp với mcp_name="andy-toolforge". Sử dụng khi cần phân tích kịch bản, tạo prompt ảnh, sinh TTS, SEO, research, quản lý dự án, viết sách, phân tích code, voice assistant, hoặc bất kỳ tác vụ nào thuộc hệ sinh thái toolforge.
mcp:
  - name: andy-toolforge
---
# @andy-toolforge MCP Tools

Khi cần thực hiện tác vụ, agent xác định tool phù hợp nhất từ danh sách dưới đây và gọi qua `skill_mcp`:

## Image & Script (footage-generation)
- `analyze_script` — Phân tích kịch bản podcast thành visual segments
- `generate_prompts` — Tạo 5 prompt ảnh/phân đoạn
- `generate_mapping` — Map nhạc nền + sound design vào segments
- `suggest_cover` — Thiết kế cover art (series/episode/thumbnail)
- `generate_batch_image` — Sinh ảnh hàng loạt qua Gemini Images

## Voice (tts-generator)
- `generate_tts` — Chuyển kịch bản thành giọng nói (batch/single/stream)
- `list_tts_voices` — Danh sách 30 giọng đọc

## Voice Assistant (voice-assistant)
- `voice_assistant_session` — Start voice conversation (full-duplex)
- `voice_assistant_configure` — Config system prompt + voice + tools

## Content & Research
- `toolforge_seo_generate` — SEO metadata cho YouTube/TikTok/Facebook
- `toolforge_content_research` — Research trends/keywords/competitor/gaps/ideas
- `andy_toolforge_content_summarizer` — Tóm tắt nội dung
- `andy_toolforge_content_ideator` — Brainstorm ý tưởng chủ đề
- `andy_toolforge_article_manager` — Quản lý article lifecycle
- `andy_toolforge_competitor_analyzer` — Phân tích đối thủ

## Business Analysis (ba-support)
- `toolforge_competitor_analysis` — Crawl + phân tích competitor
- `toolforge_pricing_analysis` — Phân tích giá
- `toolforge_swot_analysis` — SWOT analysis
- `toolforge_trend_analysis` — Phân tích market trends
- `toolforge_business_report` — Tổng hợp report

## Writing (book-writing)
- `toolforge_book_outline` — Tạo dàn ý sách/chương
- `toolforge_book_write_chapter` — Viết chapter
- `toolforge_book_review` — Review consistency
- `toolforge_book_export` — Xuất markdown/plain/html

## Project Management (pm-support)
- `pm_create_project` — Tạo project
- `pm_add_task` — Thêm task
- `pm_track_time` — Track thời gian
- `pm_generate_report` — Báo cáo
- `pm_calculate_invoice` — Tính hóa đơn

## Code Analysis (coding-support)
- `codebase_line_counts` — Đếm dòng code
- `codebase_dead_code` — Tìm dead exports
- `codebase_dependency_graph` — Graph dependencies
- `codebase_complexity` — Complexity report

## Hướng dẫn agent
1. Nhận task từ user
2. Xác định tool phù hợp nhất
3. Gọi `skill_mcp(mcp_name="andy-toolforge", tool_name="<tên_tool>", arguments={...})`
4. Trả kết quả cho user
```

---

## Skill 2: `podcast-visual-production` — Workflow ảnh podcast

**File:** `skills/podcast-visual-production.md`

Phối hợp 4 tools từ footage-generation + tts-generator. Workflow hoàn chỉnh: kịch bản → ảnh → giọng đọc.

```yaml
---
name: podcast-visual-production
description: Workflow hoàn chỉnh sản xuất visual cho podcast — từ kịch bản đến ảnh minh họa, cover, và giọng đọc. Phối hợp analyze_script + generate_prompts + generate_batch_image + generate_tts + suggest_cover. Use this skill when the user provides a podcast script and wants full visual production (images + TTS + cover).
mcp:
  - name: andy-toolforge
---
# Podcast Visual Production Workflow

## Pipeline

```
Kịch bản + tiêu đề + outline
  │
  ├── [1. ANALYZE] ── analyze_script()
  │     → Phân tích segments, tóm tắt nội dung
  │
  ├── [2. PROMPTS] ── generate_prompts()
  │     → 5 prompt ảnh/phân đoạn (a-e)
  │
  ├── [3. COVERS] ── suggest_cover()
  │     → Series + chapter/episode cover
  │
  ├── [4. GENERATE] ── generate_batch_image()
  │     → Sinh tất cả ảnh qua Gemini
  │
  └── [5. TTS] ── generate_tts()
        → Giọng đọc cho kịch bản
```

## Hướng dẫn agent

### Bước 1: Phân tích
Gọi `analyze_script` với script + title + outline (nếu có). Nhận segments.

### Bước 2: Tạo prompts
Gọi `generate_prompts` với script + title + density=2 (mặc định). Xuất prompts.md.

### Bước 3: Tạo cover
Gọi `suggest_cover` với title + description + coverType="all". Xuất prompts-covers.md.

### Bước 4: Sinh ảnh
Gọi `generate_batch_image` với segments từ step 1 + outputDir="./<slug>/images".

### Bước 5: Giọng đọc
Gọi `generate_tts` với script + title + voice="auto" + mode="batch".

## Output
- `<slug>/prompts.md` — Prompt ảnh
- `<slug>/prompts-covers.md` — Prompt cover
- `<slug>/images/` — Ảnh đã sinh
- `<slug>/audio/` — Audio segments

## Note
- Language: tự động phát hiện từ kịch bản (vi/en)
- Slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
```

---

## Skill 3: `podcast-content-strategy` — Nghiên cứu + SEO

**File:** `skills/podcast-content-strategy.md`

Phối hợp content-research + content-operations + seo-generation + book-writing.

```yaml
---
name: podcast-content-strategy
description: Nghiên cứu thị trường, brainstorm chủ đề, tối ưu SEO cho podcast. Phối hợp content_research + seo_generate + book_outline + content_summarizer. Use this skill when the user wants to research topics, optimize SEO, or plan content strategy for their podcast.
mcp:
  - name: andy-toolforge
---
# Podcast Content Strategy

## Flow

### 1. Research trends & keywords
Gọi `toolforge_content_research(action="trends", niche="...", platform="youtube")`
Gọi `toolforge_content_research(action="keywords", niche="...")`

### 2. Phân tích đối thủ
Gọi `andy_toolforge_competitor_analyzer(competitorUrl="...", analysisScope="full")`
Gọi `toolforge_competitor_analysis(url="...")` — deep crawl

### 3. Brainstorm chủ đề
Gọi `andy_toolforge_content_ideator(topic="...", audience="...", format="podcast", numIdeas=5)`

### 4. Viết dàn ý tập
Gọi `toolforge_book_outline(topic="...", chapters=5)` → làm outline cho script

### 5. Tối ưu SEO
Gọi `toolforge_seo_generate(script="...", title="...", language="vi")`
→ Nhận title, description, tags, hashtag cho YouTube/TikTok/Facebook

## Khi nào dùng skill nào
| Nhu cầu | Tool |
|---------|------|
| "Có xu hướng gì hot?" | `toolforge_content_research(action="trends")` |
| "Phân tích kênh đối thủ" | `andy_toolforge_competitor_analyzer()` |
| "Gợi ý chủ đề mới" | `andy_toolforge_content_ideator()` |
| "Viết SEO cho tập mới" | `toolforge_seo_generate()` |
| "Lên dàn ý chi tiết" | `toolforge_book_outline()` |
| "Tóm tắt nội dung" | `andy_toolforge_content_summarizer()` |
| "Khoảng trống thị trường" | `toolforge_content_research(action="gaps")` |
```

---

## Skill 4: `podcast-project-manager` — Quản lý sản xuất

**File:** `skills/podcast-project-manager.md`

Phối hợp pm-support + coding-support. Quản lý tiến độ sản xuất podcast series.

```yaml
---
name: podcast-project-manager
description: Quản lý tiến độ sản xuất podcast — tạo project, task, track thời gian, báo cáo. Phối hợp pm_create_project + pm_add_task + pm_track_time + pm_generate_report. Use this skill when managing podcast production workflow, tracking episode progress, or reporting on project status.
mcp:
  - name: andy-toolforge
---
# Podcast Project Manager

## Workflow

### Khởi tạo series
Gọi `pm_create_project(name="Podcast: <Tên series>")`
Trả về projectId.

### Thêm task cho từng tập
```
pm_add_task(projectId, name="Tập 1: Viết kịch bản", status="todo")
pm_add_task(projectId, name="Tập 1: Tạo ảnh", status="todo")
pm_add_task(projectId, name="Tập 1: Thu âm", status="todo")
pm_add_task(projectId, name="Tập 1: Edit video", status="todo")
pm_add_task(projectId, name="Tập 1: Đăng lên YouTube", status="todo")
```

### Track thời gian
Khi bắt đầu task: ghi nhận giờ
Khi hoàn thành: `pm_track_time(taskId, durationMinutes, note="...")`

### Báo cáo
Gọi `pm_generate_report(projectId, format="markdown")`
→ Xuất bảng tiến độ, tổng thời gian, task còn lại

### Phân tích codebase (tùy chọn)
- `codebase_line_counts(patterns=["<episode>/**"])` — thống kê files
- `codebase_complexity(files=["server.js"])` — đánh giá complexity
```

---

## Skill 5: `podcast-script-development` — Viết kịch bản

**File:** `skills/podcast-script-development.md`

Phối hợp book-writing + content-research.

```yaml
---
name: podcast-script-development
description: Viết và phát triển kịch bản podcast — từ dàn ý đến hoàn chỉnh. Phối hợp book_outline + book_write_chapter + content_summarizer. Use this skill when the user wants to write a podcast script, develop episode outline, or review script quality.
mcp:
  - name: andy-toolforge
---
# Podcast Script Development

## Workflow

### Bước 1: Tạo outline
Gọi `toolforge_book_outline(topic="<chủ đề tập>", chapters=5)`
→ Nhận dàn ý với 5 chapter, mỗi chapter có description + key points

### Bước 2: Viết từng chapter
```
toolforge_book_write_chapter(outline, chapterIndex=1, previousContent="")
```

### Bước 3: Review & refine
Gọi `toolforge_book_review(manuscript={title, chapters})`
→ Phát hiện inconsistency, repetition, logic gaps

### Bước 4: Tóm tắt
Gọi `andy_toolforge_content_summarizer(content="...", title="...")`
→ Tóm tắt ngắn cho description

### Bước 5: Xuất bản
Gọi `toolforge_book_export(manuscript, format="markdown")`
→ File kịch bản hoàn chỉnh

```

---

## Skill 6: `podcast-voice-production` — Sản xuất giọng đọc

**File:** `skills/podcast-voice-production.md`

Phối hợp tts-generator + voice-assistant.

```yaml
---
name: podcast-voice-production
description: Sản xuất giọng đọc cho podcast — chọn giọng, sinh TTS batch/single/stream, tương tác voice. Phối hợp list_tts_voices + generate_tts + voice_assistant_session. Use this skill when the user wants to generate voice audio, choose voices, or use voice interaction for their podcast.
mcp:
  - name: andy-toolforge
---
# Podcast Voice Production

## Tools

### Chọn giọng
Gọi `list_tts_voices()` → 30 voices với mô tả.
5 tones: informative, upbeat, calm, authoritative, friendly (3 voices/tone)

### Sinh giọng (thường dùng nhất)
```js
// Batch mode — mỗi đoạn là 1 file audio riêng
generate_tts(script, title, mode="batch", voice="auto", language="vi")

// Single mode — 1 file audio duy nhất
generate_tts(script, title, mode="single", voice="auto")

// Stream mode — segments có thứ tự
generate_tts(script, title, mode="stream", voice="Charon")
```

### API modes
- `interactions` (REST): gemini-3.1-flash-tts-preview — ổn định, nhanh
- `live` (WebSocket): gemini-2.5-flash-native-audio-latest — chất lượng cao

### Tags cảm xúc
Thêm `tags` parameter: determination, enthusiasm, excitement, curiosity, whispers, positive, neutral, frustration, anger, amusement, awe

### Voice interaction (thử nghiệm)
Gọi `voice_assistant_session(systemPrompt, voice, maxTurns=5)`
→ Tương tác giọng nói real-time với Gemini Live API
```

---

## postinstall.js

**File:** `skills/postinstall.js`

Copy toàn bộ `.md` skill files vào `.opencode/skills/` của project đang cài. Pattern giống hệt `footage-generation/skills/postinstall.js`:

```js
const fs = require('fs');
const path = require('path');

const DOMAIN = 'toolforge';
const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, '.opencode', 'skills');
const sourceDir = path.join(__dirname);

fs.mkdirSync(targetDir, { recursive: true });

fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.md') && file !== 'postinstall.js') {
        const src = path.join(sourceDir, file);
        const destName = `${DOMAIN}-${file}`;
        const dest = path.join(targetDir, destName);
        if (!fs.existsSync(dest)) {
            try {
                fs.symlinkSync(path.relative(targetDir, src), dest);
                console.log(`  🔗 Linked ${destName}`);
            } catch (e) {
                fs.copyFileSync(src, dest);
                console.log(`  📄 Copied ${destName}`);
            }
        }
    }
});
```

Thêm vào `package.json`:
```json
"scripts": {
  "postinstall": "node skills/postinstall.js"
}
```

---

## Tổng kết

| Skill | File | Tools phối hợp | Mục đích |
|-------|------|----------------|----------|
| **MCP Bridge** | `andy-toolforge.md` | Tất cả 34 tools | Cho phép agent gọi bất kỳ tool nào |
| **Visual Production** | `podcast-visual-production.md` | analyze_script + generate_prompts + generate_batch_image + suggest_cover + generate_tts | Workflow ảnh + giọng đọc |
| **Content Strategy** | `podcast-content-strategy.md` | content_research + seo_generate + book_outline + content_summarizer | Nghiên cứu + SEO |
| **Project Manager** | `podcast-project-manager.md` | pm_create_project + pm_add_task + pm_track_time + pm_generate_report | Quản lý tiến độ |
| **Script Development** | `podcast-script-development.md` | book_outline + book_write_chapter + book_review + book_export | Viết kịch bản |
| **Voice Production** | `podcast-voice-production.md` | generate_tts + list_tts_voices + voice_assistant_session | Sản xuất giọng đọc |

## Cách dùng sau khi cài

1. User chạy `npm install @andy-toolforge/mcp --save-dev`
2. `postinstall.js` copy 6 skill files vào `.opencode/skills/` với prefix `toolforge-`
3. OpenCode scan `.opencode/skills/` → nhận diện skills
4. Agent load skill `andy-toolforge` → gọi bất kỳ tool nào qua `skill_mcp`
5. Agent load skill `podcast-visual-production` → chạy workflow hoàn chỉnh

## Test

Sau khi publish và cài vào `generate-images-for-podcast`, chạy:
```
npm install @andy-toolforge/mcp --save-dev
```
Kiểm tra `.opencode/skills/` có 6 files mới prefix `toolforge-`.
Load skill: `skill(name="andy-toolforge")`
Gọi tool: `skill_mcp(mcp_name="andy-toolforge", tool_name="list_tts_voices", arguments={})`
