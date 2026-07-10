---
name: tts-generator-hub
description: Use when generating voice audio from scripts, selecting TTS voices, or producing narration for podcast/video content.
---

# TTS Generator Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `generate_tts` | Full TTS pipeline: script → smart segmentation → Gemini TTS → audio output |
| `list_tts_voices` | List all 30 Gemini TTS voices with descriptions + style guides |

## Workflow
1. Prep: final script with pace/voice preferences
2. `generate_tts` — generate audio (batch/single/stream modes)
3. For advanced use: `api_mode="live"` for WebSocket real-time, `api_mode="interactions"` for REST

## Related Skills
- `toolforge-podcast-voice-production` — full TTS + voice assistant workflow
- `tts-voice-selection` — voice selection guidance

## Decision: API Mode
| Mode | When to use |
|------|-------------|
| `interactions` | Default. REST API, reliable, 30 voices. Use for batch podcast production. |
| `live` | WebSocket real-time. Lower latency, experimental. Use for live/interactive scenarios. |

## Integration
- Audio feeds into video production (HyperFrames)
- Voice output used for podcast distribution
- Scripts come from script-development workflows
