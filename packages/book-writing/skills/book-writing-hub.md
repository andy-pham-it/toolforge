---
name: book-writing-hub
description: Use when outlining books, writing chapters, reviewing manuscripts, or exporting to markdown/plain/html.
---

# Book Writing Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `toolforge_book_outline` | Generate detailed book outline from topic (1-50 chapters) |
| `toolforge_book_write_chapter` | Write a chapter based on outline with continuity support |
| `toolforge_book_review` | Review manuscript: consistency, contradictions, repetition, tone, logic |
| `toolforge_book_export` | Export to markdown/plain/html |

## Workflow
1. `book_outline` — plan structure
2. `book_write_chapter` — write chapter-by-chapter (pass previousContent for continuity)
3. `book_review` — review draft for issues
4. `book_export` — final export

## Related Skills
- `toolforge-podcast-script-development` — adapt book content to podcast scripts
- `toolforge-podcast-content-strategy` — content strategy around book themes

## Integration
- Book content can be repurposed into podcast scripts (script-development hub)
- Chapter summaries feed into content-operations calendar
- Exported drafts used as source material for TTS audiobook (tts-generator hub)
