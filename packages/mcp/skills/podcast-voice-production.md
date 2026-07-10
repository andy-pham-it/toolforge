# Podcast Voice Production

Text-to-speech và voice assistant cho podcast episodes.

## Điều kiện tiên quyết

- Script hoàn chỉnh (dạng text)
- API keys đã cấu hình (GEMINI_API_KEY hoặc GROQ_API_KEY tùy provider)
- Voice name đã chọn (dùng `list_tts_voices` để xem danh sách)

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

> **Lưu ý khi chọn API mode:**
> - `interactions` (REST) — ổn định, phù hợp batch processing, không cần WebSocket
> - `live` (WebSocket) — real-time streaming, phù hợp khi cần giọng đọc liên tục
>
> Nếu gặp rate limiting, tăng `segment_delay` (mặc định 5000ms).
> Nếu một voice bị lỗi, thử voice khác trong danh sách.

### Bước 3: Voice assistant (optional)

Tương tác voice real-time:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="voice_assistant_session", arguments={
  "systemPrompt": "Bạn là trợ lý podcast...", "voice": "Zephyr"
})
```

## Tích hợp với các workflow khác

- **toolforge-podcast-visual-production**: Chạy song song — tạo images và TTS từ cùng script
- **toolforge-podcast-content-strategy**: Dùng SEO metadata cho episode có voice
- **toolforge-podcast-project-manager**: Theo dõi tiến độ sản xuất voice

Pipeline đề xuất: Script → Voice (skill này) + Visual → Ghép audio/video
