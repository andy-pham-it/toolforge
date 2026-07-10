---
name: tts-voice-selection
description: Use when choosing a Gemini TTS voice with style guidance and tone matching.
---

# TTS Voice Selection Guide

## Quick picks by content type

| Content type | Recommended voice | Why |
|-------------|------------------|-----|
| Philosophical/contemplative | Charon (Informative) | Calm, educational tone |
| Energetic opening | Zephyr (Bright) | Positive, energetic |
| Authoritative statement | Kore (Firm) | Assertive, commanding |
| Emotional/personal | Achernar (Soft) | Gentle, intimate |
| Technical explanation | Iapetus (Clear) | Precise, articulate |
| Friendly/conversational | Achird (Friendly) | Warm, approachable |
| Closing/wrap-up | Sulafat (Warm) | Cozy, comforting |

## All 30 voices

Use `list_tts_voices` MCP tool to see all available voices with descriptions.

## Tags for emotional control

Add audio tags to shape delivery: [determination], [whispers], [laughs], [excitement], [curiosity], [amusement], [awe]

## 📋 Prerequisites

- **Input:** Content tone analysis, script sample to match voice style
- **API Keys:** `GEMINI_API_KEY` for listing voices via MCP
- **Dependencies:** `@andy-toolforge/tts-generator` package

## ⚠️ Error Recovery

| Error | Cause | Solution |
|-------|-------|----------|
| Voice unavailable | Voice not found in API | Fall back to `Zephyr` or `Charon` — most reliable voices |
| Tone mismatch | Voice doesn't match content | Try 2-3 recommended voices from Quick picks table |

## 🔗 Integration

**MCP Alternative:** Full voice catalog available via MCP:
- `skill_mcp(mcp_name="andy-toolforge", tool_name="list_tts_voices")`

**Works with:** `toolforge-tts-generator-hub` for TTS workflow, `toolforge-podcast-visual-production` for full pipeline

## 📎 Related Skills

- `toolforge-tts-generator-hub` — Complete TTS tool reference including api_mode decision guide
- `toolforge-tts-generator-workflow` — End-to-end TTS generation workflow
- `toolforge-podcast-voice-production` — Voice production with TTS + voice assistant
