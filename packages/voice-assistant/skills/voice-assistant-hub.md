---
name: voice-assistant-hub
description: Use when setting up voice conversations, configuring assistant personality, or running interactive voice sessions.
---

# Voice Assistant Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `voice_assistant_configure` | Configure assistant: systemPrompt, voice, default tools |
| `voice_assistant_session` | Start bounded voice conversation (text over MCP, user speaks via audio) |

## Workflow
1. `voice_assistant_configure` — set up personality + voice
2. `voice_assistant_session` — run interactive session (maxTurns, timeoutSeconds)
3. Session returns transcript on completion

## Related Skills
- `toolforge-podcast-voice-production` — TTS + voice assistant in podcast pipeline
- `tts-generator-hub` — TTS voice selection

## Integration
- Voice sessions can use TTS-generated voices for response
- Session transcripts feed into content-research for analysis
- Assistant configuration persists per-session (in-memory)
