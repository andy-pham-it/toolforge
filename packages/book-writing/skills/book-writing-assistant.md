---
name: book-writing-assistant
description: Hỗ trợ AI viết sách từ outline → chapter → final draft. Dùng khi user cần viết sách, tạo manuscript, hoặc phát triển nội dung dài.
---

# Book Writing Assistant

Skill này hướng dẫn AI viết sách hoàn chỉnh từ chủ đề đến bản thảo cuối cùng.

## 📥 Input

- **Topic / Chủ đề** — sách về cái gì
- **Target audience** — (optional) đối tượng độc giả
- **Tone** — (optional) academic, popular science, self-help, technical, v.v.
- **Length** — (optional) số chương hoặc số trang

## 📤 Output

### 1. Outline

```json
{
  "title": "Tên sách",
  "chapters": [
    { "number": 1, "title": "Chương 1", "description": "...", "keyPoints": ["..."] }
  ]
}
```

### 2. Manuscript

Mỗi chương: 800-2000 từ, markdown format, H2 subsections.

### 3. Review

- Score /10
- Issues: contradiction, repetition, missing reference
- Strengths

### 4. Export

- **Markdown** — mặc định, đẹp cho GitHub/Notion
- **Plain text** — không markdown syntax
- **HTML** — sẵn sàng publish

## 🎯 Rules

1. **Luôn bắt đầu bằng outline** — không viết chapter khi chưa có outline
2. **Mỗi chapter** 800-2000 từ, có H2 subsections
3. **Continuity** — chapter sau tham chiếu đến chapter trước
4. **Review** trước khi export — phát hiện contradictions
5. **Export cuối cùng** — hỏi user chọn format

## 📋 Workflow

1. Gọi `BookWriter.generateOutline(topic, chapterCount)` → lấy outline
2. Confirm outline với user (có thể sửa)
3. Gọi `BookWriter.writeChapter(outline, 1)` → chapter 1
4. Gọi `BookWriter.writeChapter(outline, 2, previousContent)` → chapter 2 (có continuity)
5. Lặp cho đến hết chapters
6. Gọi `BookWriter.reviewConsistency(manuscript)` → review
7. Gọi `BookWriter.exportFormat(manuscript, 'markdown')` → xuất bản

## 📋 Template

```
## Sách: [Title]

### Outline
- Chapter 1: ...
- Chapter 2: ...

### Tiến độ
- [x] Outline
- [ ] Chapter 1
- [ ] Chapter 2
- [ ] Review
- [ ] Export
```

## 📋 Prerequisites

- Clear topic or thesis for the book
- `LLMClient` instance with valid API key (Groq or Gemini)
- Optional: target audience, tone, and chapter count preferences

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Outline too generic | Topic too broad | Narrow the topic or provide specific angle |
| Chapter content contradicts earlier | Continuity broken | Run `BookWriter.reviewConsistency()` to detect issues |
| Export format issues | Missing chapters | Complete all chapters before export |
| LLM context limit reached | Chapter too long | Keep chapters 800–2000 words, split if needed |

## 🔗 Integration

- **MCP tools:** `toolforge_book_outline`, `toolforge_book_write_chapter`, `toolforge_book_review`, `toolforge_book_export`
- **Domain packages:** Book content can feed `andy-toolforge_content_summarizer` for marketing summaries
- **Cross-domain:** Combine with `content-operations` to plan book-launch content calendar

## 📚 Related Skills

- `book-summarizer` — summarize completed book for marketing
- `book-writing-hub` — overview of all book writing tools
- `content-operations-editorial-calendar` — plan book launch content
- `andy-toolforge` (MCP Bridge) — invoke book tools via `skill_mcp`
