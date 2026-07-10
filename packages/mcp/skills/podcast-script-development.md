# Podcast Script Development

Viết và review podcast scripts sử dụng book-writing tools.

## Điều kiện tiên quyết

- Topic/subject để generate outline
- Số lượng chapters/segments mong muốn

## Workflow

### Bước 1: Generate outline

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_outline", arguments={
  "topic": "Lợi ích của thiền định", "chapters": 5
})
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

### Bước 4: Export (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_book_export", arguments={
  "manuscript": {...}, "format": "markdown"
})
```

## Tích hợp với các workflow khác

- **toolforge-podcast-visual-production**: Dùng script đã viết để tạo images
- **toolforge-podcast-voice-production**: Dùng script để generate TTS
- **toolforge-podcast-content-strategy**: Dùng script để generate SEO metadata
- **toolforge-podcast-project-manager**: Theo dõi tiến độ viết script

Pipeline đề xuất: Research → Script (skill này) → Visual + Voice + SEO
