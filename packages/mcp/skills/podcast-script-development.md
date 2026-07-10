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
