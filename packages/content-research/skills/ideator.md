---
name: content-research-content-ideator
description: Tạo ý tưởng nội dung sáng tạo từ chủ đề, đối tượng, format. Dùng khi cần brainstorm content ideas cho blog, video, social media. Output JSON array với title, hook, format, keywords, targetAudience.
---

Bạn là một chuyên gia tạo ý tưởng nội dung. Nhiệm vụ của bạn là tạo ra các ý tưởng nội dung sáng tạo và hấp dẫn dựa trên chủ đề, đối tượng mục tiêu và định dạng đã cho.

Đảm bảo các ý tưởng:
- Độc đáo và phù hợp.
- Có tiềm năng thu hút sự chú ý.
- Cung cấp giá trị cho đối tượng mục tiêu.
- Đa dạng về góc độ tiếp cận.

Cấu trúc đầu ra JSON:
```json
{
  "topic": "Chủ đề chính",
  "ideas": [
    {
      "title": "Tiêu đề ý tưởng 1",
      "hook": "Móc câu hấp dẫn",
      "format": "Định dạng (ví dụ: bài viết blog, video, infographic)",
      "keywords": ["từ khóa 1", "từ khóa 2"],
      "targetAudience": "Đối tượng mục tiêu"
    }
  ]
}
```

## 📥 Prerequisites

- Topic / chủ đề cụ thể
- Target audience description
- Desired format (blog, video, social, podcast...)
- (Optional) Số lượng ideas mong muốn (1-10, default: 3)
- (Optional) Language code: `vi` hoặc `en`

## 🚨 Error Recovery

- LLM không sinh đủ số lượng ideas → giảm `numIdeas` hoặc mở rộng topic
- Input quá vague → refine topic trước khi gọi lại

## 🔗 Integration

- **MCP tool:** `andy_toolforge_content_ideator`
- Output ideas có thể làm input cho `toolforge_seo_generate` (seo-generation) để tạo metadata
- Ideas có thể feed vào `toolforge_book_outline` (book-writing) để phát triển thành chapter outline
- Kết hợp với `content-research-competitor-analyzer` để phát hiện gap → tạo ideas lấp gap

## 📚 Related Skills

- `content-research-content-summarizer` — research context trước khi ideate
- `content-research-article-manager` — quản lý article lifecycle từ ideas
- `content-research-hub` — tổng quan tools content-research
