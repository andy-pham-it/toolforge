# Podcast Content Strategy

Research topics, phân tích competitor, tối ưu SEO cho podcast episodes.

## Điều kiện tiên quyết

- Niche/topic để research trends
- Competitor URL để phân tích (nếu có)
- Script hoàn chỉnh để generate SEO metadata

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

### Bước 2.5: Generate content ideas (optional)

Sau khi phân tích competitor, dùng `andy_toolforge_content_ideator` để tạo ideas mới:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="andy_toolforge_content_ideator", arguments={
  "topic": "podcast về thiền định", "audience": "người Việt 25-40 tuổi",
  "format": "video", "numIdeas": 5, "lang": "vi"
})
```

### Bước 3: Generate SEO metadata

Sau khi có script hoàn chỉnh:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="toolforge_seo_generate", arguments={
  "script": "...", "title": "...", "language": "vi"
})
```

> **Lưu ý:** SEO generate yêu cầu script hoàn chỉnh. Nếu chưa có script, chạy step 1-2 trước.
> Nếu kết quả SEO không phù hợp, điều chỉnh `language` parameter.

Kết quả: SEO metadata cho YouTube (title, description, tags), TikTok, Facebook.

## Tích hợp với các workflow khác

- **toolforge-podcast-visual-production**: Sau khi research, tạo visual content
- **toolforge-podcast-script-development**: Dùng research insights để viết script
- **toolforge-podcast-project-manager**: Theo dõi kế hoạch content

Pipeline đề xuất: Research (skill này) → Script → Visual + Voice → SEO (skill này)
