# @andy-toolforge/voice-assistant

> Domain package: AI voice assistant using Gemini Live API.

## Key Classes

| Class | File | Purpose |
|-------|------|---------|
| `VoiceAssistant` | `lib/assistant.js` | Main entry: start/ask/events/tool dispatch |
| `VoiceSession` | `lib/session.js` | State machine + Gemini Live WebSocket lifecycle |

## Architecture

- Gemini Live API handles STT + TTS + Function Calling natively
- Plugin is domain-agnostic: systemPrompt + tools = full customization
- Works standalone (Node.js) and via MCP (agent ecosystem)
- See `docs/superpowers/specs/2026-07-10-voice-assistant-design.md` for full design
- Implementation plan: `docs/superpowers/plans/2026-07-10-voice-assistant.md`

## Dependencies

- `@google/genai ^2.10.0` — Gemini Live API WebSocket client
- `@andy-toolforge/core ^1.0.0` — LLMClient pattern, Logger

## Development

```bash
npm test -w @andy-toolforge/voice-assistant
```

## Domain Examples

See design spec §9 for 7 ready-to-use domain configs:
- English tutor (`voice: Zephyr`)
- Personal assistant (`voice: Kore`)
- Market analyst (`voice: Puck`)
- Healthcare (`voice: Kore`)
- Travel assistant (`voice: Zephyr`)
- Restaurant / Food (`voice: Puck`)
- DevOps assistant (`voice: Fenrir`)
