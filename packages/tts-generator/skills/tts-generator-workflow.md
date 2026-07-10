---
name: tts-generator-workflow
description: Use when converting podcast/video scripts to speech using Gemini TTS.
---

# TTS Generator Workflow

## When to use

Use this skill when you need to convert podcast/video scripts to voice audio. The TTS Generator handles:
- Smart script segmentation (LLM-based paragraph analysis)
- Multi-voice selection from 30 Gemini TTS voices
- Batch, single, or stream audio output

## Workflow

1. **Prepare script**: Full podcast script text with clear paragraph breaks
2. **Choose voice**: "auto" for smart selection, or pick from 30 voices (see tts-voice-selection skill)
3. **Run batch generation**: The tool segments and generates audio in parallel
4. **Assemble output**: Audio clips ready for final editing

## MCP Tools

- `generate_tts` — Full pipeline: script → segments → audio
- `list_tts_voices` — Browse available voices with descriptions

## Audio tags for expressiveness

Add comma-separated tags for emotional tone: determination, enthusiasm, excitement, curiosity, whispers, laughs, positive, neutral, negative, frustration, anger, amusement, awe, admiration

## 📋 Prerequisites

- **Input:** Full script text and episode title
- **API Keys:** `GEMINI_API_KEY` for Gemini TTS API
- **Dependencies:** `@andy-toolforge/tts-generator` package
- **Related skills:** `toolforge-tts-generator-hub` for all TTS tools

## ⚠️ Error Recovery

| Error | Cause | Solution |
|-------|-------|----------|
| Rate limit hit | Too many requests | Increase `segment_delay` (default 5000ms) or reduce segments per batch |
| TTS audio empty | Voice not found | Retry with `voice="auto"` — falls back to working voice |
| Segment generation fails | API timeout | Split script into shorter segments and retry individually |

## 🔗 Integration

**MCP Alternative:** All tools in this skill are available via MCP:
- `skill_mcp(mcp_name="andy-toolforge", tool_name="generate_tts")`
- `skill_mcp(mcp_name="andy-toolforge", tool_name="list_tts_voices")`

**Works with:** `toolforge-footage-generation-hub` (visuals + voice), `toolforge-voice-assistant-hub` (interactive voice)

## 📎 Related Skills

- `toolforge-tts-generator-hub` — Complete TTS tool reference and api_mode guide
- `toolforge-tts-voice-selection` — Voice choice by content tone
- `toolforge-podcast-visual-production` — Combine TTS with generated visuals
