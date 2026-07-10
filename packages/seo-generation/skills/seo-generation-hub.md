---
name: seo-generation-hub
description: Use when generating SEO metadata (title, description, tags, keywords) for video/audio content across YouTube, TikTok, and Facebook.
---

# SEO Generation Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `toolforge_seo_generate` | Generate SEO metadata for YouTube, TikTok, Facebook simultaneously |

## Workflow
1. Prep: full final script + working title
2. `toolforge_seo_generate` → returns title, description, tags, keywords, hashtags, timestamps per platform
3. Apply: attach metadata to platform uploads

## Related Skills
- `toolforge-podcast-content-strategy` — research + SEO workflow
- `toolforge-content-research-hub` — keyword research before SEO
- `toolforge-podcast-visual-production` — visual content being published

## Integration
- Run after script is finalized, before publishing
- SEO metadata used by content-operations distributor
- Multi-platform: YouTube (description + tags), TikTok (hashtags), Facebook (description)
