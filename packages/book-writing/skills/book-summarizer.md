---
name: book-summarizer
description: Tạo summary sách — blog post, video script, slide deck. Dùng khi user có content sách và cần tóm tắt cho marketing, review, hoặc social media.
---

# Book Summarizer

Skill này hướng dẫn AI tóm tắt nội dung sách thành nhiều format khác nhau.

## 📥 Input

- **Book content** — manuscript, chapter summaries, hoặc notes
- **Format** — blog post, video script, slide deck, social post
- **Target length** — (optional) số từ / thời lượng video
- **Tone** — (optional) formal, casual, promotional

## 📤 Output

### Blog Post Summary (800-1200 từ)

```markdown
# [Title]: Key Takeaways

## Introduction
[Context about the book]

## Key Takeaways
1. **Takeaway 1** — explanation
2. **Takeaway 2** — explanation

## Conclusion
[Final thoughts + CTA]
```

### Video Script (3-5 phút)

```
[HOOK] — câu mở đầu thu hút (5s)
[INTRO] — giới thiệu sách (15s)
[BODY] — 3 key takeaways (2-3 phút)
[OUTRO] — kết luận + call to action (15s)
```

### Slide Deck (5-10 slides)

| Slide | Content |
|-------|---------|
| 1 | Title + Author |
| 2 | Problem statement |
| 3-5 | Key concepts |
| 6 | Actionable steps |
| 7 | Q&A / CTA |

## 🎯 Rules

1. **Extract key takeaways** — 3-5 điểm chính nhất, không tham lam
2. **Mỗi format** có cấu trúc riêng — blog khác video, video khác slide
3. **Hook** cho video: 3-5 giây đầu quyết định retention
4. **Blog summary** phải đọc được độc lập — không cần đọc sách gốc
5. **Slide deck** tối đa 10 slides — mỗi slide 1 ý chính

## 📋 Template

```
## Summary: [Book Title]

### Key Takeaways
1. ...
2. ...

### Format: [blog/video/slide]

[Content based on format]
```

## 📋 Prerequisites

- Book content (manuscript, chapter summaries, or detailed notes)
- Target format selected: blog post, video script, slide deck, or social post
- `LLMClient` instance with valid API key

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Summary too generic | Source content insufficient | Request chapter-level summaries or full manuscript |
| Hook doesn't grab attention | Missing context about audience | Specify target audience and tone |
| Slide deck exceeds 10 slides | Too many concepts per slide | Consolidate related points, keep 1 idea per slide |

## 🔗 Integration

- **MCP tools:** `toolforge_book_outline`, `toolforge_book_write_chapter`, `toolforge_book_review`, `toolforge_book_export`
- **Domain packages:** Summaries can be used by `seo-generation` for metadata or `content-operations` for content calendars
- **Cross-domain:** Book summaries feed `andy-toolforge_content_summarizer` (content-research) for multi-format output

## 📚 Related Skills

- `book-writing-assistant` — write the full book before summarizing
- `book-writing-hub` — overview of all book writing tools
- `seo-generation-hub` — generate SEO metadata from summaries
- `andy-toolforge` (MCP Bridge) — invoke book tools via `skill_mcp`
