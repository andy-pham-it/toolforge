---
name: footage-generation-hub
description: Use when generating images, overlays, image prompts, BGM maps, or cover art for podcast/video content.
---

# Footage Generation Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `analyze_script` | Analyze script → visual segments with image prompts & formattedSummary |
| `generate_prompts` | Generate 5 image prompts (a-e) per segment with visual style classification |
| `generate_batch_image` | Batch image generation via Gemini Images (background process, async) |
| `generate_mapping` | Map BGM tracks + sound design per segment based on mood/pace |
| `suggest_cover` | Suggest cover art (series/episode/thumbnail) with style, palette, prompt |

## Workflow
1. `analyze_script` — get segments + prompts
2. `generate_prompts` — refine prompts per segment
3. `generate_batch_image` — spawn image generation (background)
4. `generate_mapping` — add BGM + sound design
5. `suggest_cover` — design cover art

## Related Skills
- `toolforge-podcast-visual-production` — full visual pipeline
- `toolforge-podcast-voice-production` — TTS for voiceover
- `toolforge-podcast-content-strategy` — research + SEO before production

## Integration
- Images feed into HyperFrames compositions for video rendering
- Covers used as YouTube thumbnails / podcast artwork
- BGM maps synced to video timeline
