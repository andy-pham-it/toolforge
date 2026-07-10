# Podcast Voice Production

Text-to-speech và voice assistant cho podcast episodes.

## Workflow

### Bước 1: Liệt kê giọng đọc

```
skill_mcp(mcp_name="andy-toolforge", tool_name="list_tts_voices", arguments={})
```

Chọn voice phù hợp với nội dung (Zephyr, Puck, Charon, Kore...).

### Bước 2: Generate TTS

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_tts", arguments={
  "script": "...", "title": "...", "voice": "Zephyr",
  "language": "vi", "mode": "batch", "api_mode": "interactions"
})
```

### Bước 3: Voice assistant (optional)

Tương tác voice real-time:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="voice_assistant_session", arguments={
  "systemPrompt": "Bạn là trợ lý podcast...", "voice": "Zephyr"
})
```
