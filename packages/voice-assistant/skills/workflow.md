# Voice Assistant Workflow

> Hướng dẫn AI agent sử dụng `@andy-toolforge/voice-assistant` để tạo trợ lý giọng nói.

## Khi nào dùng

- User muốn có trợ lý ảo bằng giọng nói
- User cần tích hợp voice command vào app
- User muốn tạo domain-specific voice assistant (bán hàng, IoT, support, học tập)

## Cấu hình

```js
const { VoiceAssistant } = require('@andy-toolforge/voice-assistant');

const assistant = new VoiceAssistant({
  apiKey: process.env.GEMINI_API_KEY,
  systemPrompt: 'Bạn là trợ lý thông minh...',
  voice: 'Charon',
  tools: [
    {
      name: 'my_tool',
      description: 'Description',
      parameters: { type: 'object', properties: { /* ... */ } },
      handler: async (args) => { /* ... */ }
    }
  ]
});
```

## API

| Method | Description |
|--------|-------------|
| `assistant.start(audioStream)` | Start full-duplex voice session |
| `assistant.startListening()` | Resume audio capture |
| `assistant.stopListening()` | Pause audio capture |
| `assistant.disconnect()` | End session |

## Events

| Event | When |
|-------|------|
| `listening` | Sending audio to API |
| `thinking` | Model processing |
| `speaking` | Model sending audio back |
| `toolCall` | Tool being executed |
| `turnComplete` | Turn finished |
| `error` | An error occurred |

## MCP Tools

- `voice_assistant_session`: Start bounded voice conversation
- `voice_assistant_configure`: Set persistent config

## Domain Adaptation

Thay đổi `systemPrompt` + `tools` để chuyển domain. Không cần sửa code core.

Xem `docs/superpowers/specs/2026-07-10-voice-assistant-design.md` §9 cho 7 domain examples chi tiết: English tutor, personal assistant, market analyst, healthcare, travel, restaurant/food, DevOps.

## Usage Examples

### Desktop app (Electron/Tauri)

```js
const { VoiceAssistant } = require('@andy-toolforge/voice-assistant');
const mic = require('node-microphone');

const assistant = new VoiceAssistant({
  apiKey: process.env.GEMINI_API_KEY,
  systemPrompt: 'You are a smart home assistant. Control lights, AC, and answer questions.',
  voice: 'Zephyr',
  tools: iotTools
});

const micStream = new mic().startRecording();
await assistant.start(micStream);

assistant.on('speaking', () => console.log('AI is speaking...'));
assistant.on('toolCall', ({ name, args }) => console.log(`Tool: ${name}`, args));

// Later:
await assistant.disconnect();
```

### Mobile app (React Native)

```js
// Capture audio via react-native-audio-recorder
// Send LINEAR16 PCM 24kHz chunks to a Node.js relay server:
const ws = new WebSocket('ws://relay-server:8080');
micStream.on('data', (chunk) => {
  if (isListening) ws.send(chunk);
});
```

### MCP Agent usage

```
User: "Hãy gọi cho khách hàng Nguyễn Văn A để xác nhận đơn hàng"

Agent uses voice_assistant_session tool:
→ Opens voice session with customer support prompt
→ AI talks to the customer via audio
→ Returns transcript summary

Agent (to user): "Đã xác nhận xong. Khách hàng A sẽ nhận hàng vào thứ 4."
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Live.connect` fails | API key missing | Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| No audio response | Voice not set | Defaults to `Charon` |
| Tool returns error | Handler throws | Check `error` event |
| Session hangs | StopListening + no disconnect | Call `assistant.disconnect()` |
