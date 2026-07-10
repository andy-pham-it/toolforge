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
