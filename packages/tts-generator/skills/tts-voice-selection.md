# TTS Voice Selection Guide

## 30 Gemini TTS Voices

| Voice | Style | Best For |
|-------|-------|----------|
| Kore | Firm | Authoritative narration |
| Charon | Informative | Educational content |
| Zephyr | Bright | Upbeat introductions |
| Sulafat | Warm | Storytelling |
| Iapetus | Clear | Technical content |
| Achird | Friendly | Conversational segments |

**Full list:** Use `list_tts_voices` MCP tool.

## How Voice Auto-Selection Works

1. TTSPlanner analyzes the script and assigns a tone per segment
2. `pickVoiceForTone(tone)` selects from the matching voice pool
3. User can override with explicit `voice` parameter

## Audio Tags

Add expressiveness with tags: `[determination]`, `[whispers]`, `[excitement]`, `[laughs]`, `[neutral]`, `[positive]`, `[negative]`. Over 200 tags supported.
