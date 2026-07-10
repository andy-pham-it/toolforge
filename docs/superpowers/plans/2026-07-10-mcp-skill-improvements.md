# MCP Skill Improvements Plan

> **For agentic workers:** Execute each task in order. Each task modifies one skill file with additive changes. Verify all 23 MCP tests still pass at the end.

**Goal:** Fix 6 quality issues found in the 6 MCP skill files — add cross-references, error recovery, prerequisites, and concrete guidance for ambiguous steps.

**Architecture:** 6 independent file edits, each adding 2-3 new sections to existing `.md` files in `packages/mcp/skills/`. All changes are additive (no deletions).

**Tech Stack:** Markdown

## Global Constraints

- Vietnamese language for all headings and descriptions (following existing pattern)
- All changes additive only — never delete existing content
- Follow existing markdown formatting conventions in each file
- All 23 MCP tests must pass after all changes

---

### Task 1: Fix andy-toolforge.md (Bridge Skill)

**File:** `packages/mcp/skills/andy-toolforge.md`

**Issue #2:** Bridge is a passive table — doesn't link to the 5 workflow skills.

**Changes:**
- [ ] **Step 1: Add "## Workflow Skills" section** after the Router table (after line 90)

Append after the existing content:

```markdown

## Workflow Skills

Ngoài việc gọi tool trực tiếp, bạn có thể load các skill workflow dưới đây để thực hiện tác vụ phức tạp:

| Skill | Mô tả |
|-------|-------|
| `toolforge-podcast-visual-production` | Tạo images + cover + BGM từ script |
| `toolforge-podcast-content-strategy` | Research topics, competitor analysis, SEO |
| `toolforge-podcast-project-manager` | Quản lý project, tasks, time tracking, invoice |
| `toolforge-podcast-script-development` | Viết và review podcast scripts |
| `toolforge-podcast-voice-production` | TTS và voice assistant |

**Pipeline sản xuất podcast hoàn chỉnh:**

1. `toolforge-podcast-content-strategy` → Research nội dung + phân tích competitor
2. `toolforge-podcast-script-development` → Viết script từ outline
3. `toolforge-podcast-voice-production` → Tạo TTS audio từ script
4. `toolforge-podcast-visual-production` → Tạo images + cover + BGM
5. `toolforge-podcast-content-strategy` → SEO metadata cho episode hoàn chỉnh
```

- [ ] **Step 2: Verify** — `cat packages/mcp/skills/andy-toolforge.md | tail -20` shows the new section

---

### Task 2: Fix podcast-visual-production.md

**File:** `packages/mcp/skills/podcast-visual-production.md`

**Issues:** #1 (no cross-refs), #3 (no error recovery), #4 (no prereqs)

**Changes:**

- [ ] **Step 1: Add prerequisites section** after the title line (after line 1)

Replace:
```
# Podcast Visual Production

Tạo hình ảnh cho podcast episodes: từ script đến images + cover + BGM.
```
With:
```
# Podcast Visual Production

Tạo hình ảnh cho podcast episodes: từ script đến images + cover + BGM.

## Điều kiện tiên quyết

- Script podcast hoàn chỉnh (dạng text)
- Tiêu đề episode
- Output directory có quyền ghi file
```

- [ ] **Step 2: Add error recovery after Step 4**

After the `generate_batch_image` code block (currently the last step before the BGM step), insert:

```
> **Lưu ý:** `generate_batch_image` chạy background. Kiểm tra thư mục `outputDir` để xem tiến độ.
> Nếu cần sinh ảnh lại, chạy lại với `outputDir` mới để tránh ghi đè.
```

- [ ] **Step 3: Add "Tích hợp" section at the end**

Append at end of file:

```
## Tích hợp với các workflow khác

- **toolforge-podcast-voice-production**: Sau khi có images, tạo TTS audio cho cùng script
- **toolforge-podcast-content-strategy**: Dùng SEO metadata cho episode đã hoàn chỉnh
- **toolforge-podcast-project-manager**: Theo dõi tiến độ sản xuất visual

Pipeline đề xuất: Script → Visual (skill này) + Voice → SEO
```

---

### Task 3: Fix podcast-content-strategy.md

**File:** `packages/mcp/skills/podcast-content-strategy.md`

**Issues:** #1 (no cross-refs), #3 (no error recovery), #4 (no prereqs), missing `content_ideator`

**Changes:**

- [ ] **Step 1: Add prerequisites section**

Replace:
```
# Podcast Content Strategy

Research topics, phân tích competitor, tối ưu SEO cho podcast episodes.
```
With:
```
# Podcast Content Strategy

Research topics, phân tích competitor, tối ưu SEO cho podcast episodes.

## Điều kiện tiên quyết

- Niche/topic để research trends
- Competitor URL để phân tích (nếu có)
- Script hoàn chỉnh để generate SEO metadata
```

- [ ] **Step 2: Add cross-reference after Step 2 (competitor analysis)**

After the competitor_analyzer code block, insert:

```
### Bước 2.5: Generate content ideas (optional)

Sau khi phân tích competitor, dùng `andy_toolforge_content_ideator` để tạo ideas mới:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="andy_toolforge_content_ideator", arguments={
  "topic": "podcast về thiền định", "audience": "người Việt 25-40 tuổi",
  "format": "video", "numIdeas": 5, "lang": "vi"
})
```
```

- [ ] **Step 3: Add error recovery to Step 3**

After the SEO code block, insert:

```
> **Lưu ý:** SEO generate yêu cầu script hoàn chỉnh. Nếu chưa có script, chạy step 1-2 trước.
> Nếu kết quả SEO không phù hợp, điều chỉnh `language` parameter.
```

- [ ] **Step 4: Add integration section at end**

Append at end:

```
## Tích hợp với các workflow khác

- **toolforge-podcast-visual-production**: Sau khi research, tạo visual content
- **toolforge-podcast-script-development**: Dùng research insights để viết script
- **toolforge-podcast-project-manager**: Theo dõi kế hoạch content

Pipeline đề xuất: Research (skill này) → Script → Visual + Voice → SEO (skill này)
```

---

### Task 4: Fix podcast-project-manager.md

**File:** `packages/mcp/skills/podcast-project-manager.md`

**Issues:** #1 (no cross-refs), #3 (no error recovery), #4 (no prereqs), missing status tracking

**Changes:**

- [ ] **Step 1: Add prerequisites section**

Replace:
```
# Podcast Project Manager

Quản lý project, tasks, time tracking, và invoices cho sản xuất podcast.
```
With:
```
# Podcast Project Manager

Quản lý project, tasks, time tracking, và invoices cho sản xuất podcast.

## Điều kiện tiên quyết

- Project name để tạo project
- Task names để thêm tasks
- Project ID (có sau Step 1) — **lưu lại** để dùng cho các step sau
```

- [ ] **Step 2: Improve Step 2 with status guidance**

Replace existing Step 2 block with:
```
### Bước 2: Thêm task (nếu chưa tạo lúc đầu)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_add_task", arguments={
  "projectId": "...", "name": "Edit video", "status": "todo"
})
```

Các status có thể dùng: `todo`, `in-progress`, `done`.
```

- [ ] **Step 3: Add integration section at end**

Append at end:

```
## Tích hợp với các workflow khác

- **Tất cả workflow skills**: Dùng Project Manager để theo dõi tiến độ từng giai đoạn sản xuất

Pipeline đề xuất: Tạo project (skill này) → Script → Visual → Voice → SEO → Cập nhật task status
```

---

### Task 5: Fix podcast-script-development.md

**File:** `packages/mcp/skills/podcast-script-development.md`

**Issues:** #1 (no cross-refs), #3 (no error recovery), #4 (no prereqs), #5 (mapping ambiguity)

**Changes:**

- [ ] **Step 1: Add prerequisites section**

Replace:
```
# Podcast Script Development

Viết và review podcast scripts sử dụng book-writing tools.
```
With:
```
# Podcast Script Development

Viết và review podcast scripts sử dụng book-writing tools.

## Điều kiện tiên quyết

- Topic/subject để generate outline
- Số lượng chapters/segments mong muốn
```

- [ ] **Step 2: Replace vague mapping step with concrete guidance**

Replace the existing Step 2 section:
```
### Bước 2: Viết từng chapter

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_write_chapter", arguments={
  "outline": {...}, "chapterIndex": 1
})
```

### Bước 3: Review consistency

...
```
With:
```
### Bước 2: Viết nội dung cho từng segment

Mỗi chapter trong outline = 1 segment trong podcast.

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_write_chapter", arguments={
  "outline": {...}, "chapterIndex": 1
})
```

**Mapping chapter → segment:**
- Chapter title → Segment title
- Chapter content/outline → Segment script nội dung
- Giữ nguyên thứ tự chapters làm thứ tự segments

### Bước 3: Review consistency

Sau khi viết xong tất cả chapters, review toàn bộ manuscript:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_review", arguments={
  "manuscript": {"title": "...", "chapters": [...]}
})
```

> **Lưu ý:** Review tool kiểm tra consistency, contradictions, repetition. Nếu phát hiện vấn đề, sửa chapter tương ứng rồi review lại.
```

- [ ] **Step 3: Add integration section at end**

Append at end:

```
## Tích hợp với các workflow khác

- **toolforge-podcast-visual-production**: Dùng script đã viết để tạo images
- **toolforge-podcast-voice-production**: Dùng script để generate TTS
- **toolforge-podcast-content-strategy**: Dùng script để generate SEO metadata
- **toolforge-podcast-project-manager**: Theo dõi tiến độ viết script

Pipeline đề xuất: Research → Script (skill này) → Visual + Voice + SEO
```

---

### Task 6: Fix podcast-voice-production.md

**File:** `packages/mcp/skills/podcast-voice-production.md`

**Issues:** #1 (no cross-refs), #3 (no error recovery), #4 (no prereqs), #6 (missing api_mode decision)

**Changes:**

- [ ] **Step 1: Add prerequisites section**

Replace:
```
# Podcast Voice Production

Text-to-speech và voice assistant cho podcast episodes.
```
With:
```
# Podcast Voice Production

Text-to-speech và voice assistant cho podcast episodes.

## Điều kiện tiên quyết

- Script hoàn chỉnh (dạng text)
- API keys đã cấu hình (GEMINI_API_KEY hoặc GROQ_API_KEY tùy provider)
- Voice name đã chọn (dùng `list_tts_voices` để xem danh sách)
```

- [ ] **Step 2: Add error recovery to Step 2**

After the TTS code block, insert:

```
> **Lưu ý khi chọn API mode:**
> - `interactions` (REST) — ổn định, phù hợp batch processing, không cần WebSocket
> - `live` (WebSocket) — real-time streaming, phù hợp khi cần giọng đọc liên tục
>
> Nếu gặp rate limiting, tăng `segment_delay` (mặc định 5000ms).
> Nếu một voice bị lỗi, thử voice khác trong danh sách.
```

- [ ] **Step 3: Add integration section at end**

Append at end:

```
## Tích hợp với các workflow khác

- **toolforge-podcast-visual-production**: Chạy song song — tạo images và TTS từ cùng script
- **toolforge-podcast-content-strategy**: Dùng SEO metadata cho episode có voice
- **toolforge-podcast-project-manager**: Theo dõi tiến độ sản xuất voice

Pipeline đề xuất: Script → Voice (skill này) + Visual → Ghép audio/video
```

---

### Task 7: Verify integration

- [ ] **Step 1: Run MCP tests**

```bash
npm test -w @andy-toolforge/mcp
```

Expected: All 23 tests pass.

- [ ] **Step 2: Spot-check all 6 files**

```bash
for f in packages/mcp/skills/*.md; do
  echo "=== $f ==="
  wc -l "$f"
  grep -c "Tích hợp" "$f" || echo "  WARNING: missing Tích hợp section"
  grep -c "Điều kiện tiên quyết" "$f" || echo "  WARNING: missing Điều kiện tiên quyết section"
done
```

Expected: Each file has a Tích hợp section and Điều kiện tiên quyết section.

- [ ] **Step 3: Verify symlink still works**

```bash
node packages/mcp/scripts/postinstall.js
ls -la ~/.opencode/skills/toolforge-* 2>/dev/null | head -10
```

Expected: 6 symlinks exist with toolforge- prefix.
