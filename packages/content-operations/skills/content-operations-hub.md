---
name: content-operations-hub
description: Use when planning content calendars, discovering trends, generating content, optimizing SEO, distributing across platforms, or analyzing performance.
---

# Content Operations Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `toolforge_content_research` | Trends, keywords, competitor, gaps, ideas per niche/platform |

## Workflow
Content-ops is primarily driven via skill files (not single MCP tools):

1. **Trend Discovery** → `toolforge-content-research` skill → `toolforge_content_research` (action: trends)
2. **Editorial Calendar** → plan content schedule
3. **Content Creation** → create from plans via domain skills
4. **Distribution** → push to platforms
5. **Performance Analysis** → track + report

## Related Skills
- `toolforge-content-research-hub` — source material for planning
- `toolforge-podcast-content-strategy` — podcast-specific content strategy
- `toolforge-podcast-visual-production` — visual content creation
- `toolforge-podcast-script-development` — script writing

## Integration
- Content operations orchestrates the entire pipeline: research → plan → create → distribute → analyze
- SEO metadata from seo-generation attached to each published piece
