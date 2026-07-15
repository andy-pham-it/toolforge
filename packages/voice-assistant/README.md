# @andy-toolforge/voice-assistant

> AI voice assistant using Gemini Live API — bidirectional audio with native STT, TTS, and function calling.

## Features

- **Full-duplex audio** — realtime microphone input + voice output over Gemini Live WebSocket
- **Native STT/TTS** — no separate speech-to-text or text-to-speech pipeline
- **Built-in function calling** — declare tools, Gemini dispatches automatically
- **Domain-agnostic** — configure systemPrompt + tools for any use case
- **Two API levels** — high-level `VoiceAssistant` (simple events) + low-level `VoiceSession` (state machine)
- **MCP tools** — `voice_assistant_configure` and `voice_assistant_session` for agent integration

## Installation

```bash
npm install @andy-toolforge/voice-assistant
```

Requires `GEMINI_API_KEY` environment variable.

## Exports

| Class | File | Purpose |
|-------|------|---------|
| `VoiceAssistant` | `lib/assistant.js` | High-level API: start/ask/events/tool dispatch |
| `VoiceSession` | `lib/session.js` | Low-level state machine + Gemini Live WebSocket lifecycle |

## Quick Start

### 1. High-level API (VoiceAssistant)

```javascript
const { VoiceAssistant } = require('@andy-toolforge/voice-assistant');
const { createReadStream } = require('fs');

const assistant = new VoiceAssistant({
    apiKey: process.env.GEMINI_API_KEY,
    systemPrompt: 'You are a helpful voice assistant.',
    voice: 'Charon',
    tools: [
        {
            name: 'get_weather',
            description: 'Get current weather for a city',
            handler: async (args) => ({ temperature: 28, condition: 'sunny' }),
        },
    ],
});

// Event lifecycle
assistant.on('listening', () => console.log('🎤 Listening...'));
assistant.on('thinking', () => console.log('🤔 Thinking...'));
assistant.on('speaking', () => console.log('🔊 Speaking...'));
assistant.on('toolCall', (calls) => console.log('🔧 Tool call:', calls));
assistant.on('audio', (audioData) => {
    // audioData: { mimeType: string, data: string (base64) }
    console.log('Received audio chunk');
});
assistant.on('error', (err) => console.error(err));

// Start with a microphone stream
const micStream = createReadStream('/dev/audio');  // platform-specific
await assistant.start(micStream);

// Or send text queries
await assistant.ask('What is the weather in Hanoi?');

// Cleanup
await assistant.disconnect();
```

### 2. Low-level API (VoiceSession)

```javascript
const { VoiceSession } = require('@andy-toolforge/voice-assistant');

const session = new VoiceSession({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash-native-audio-latest',
    systemPrompt: 'You are a helpful assistant.',
    voice: 'Kore',
    tools: [...],
});

session.on('stateChange', ({ from, to }) => console.log(`${from} → ${to}`));
session.on('text', (text) => console.log('Model text:', text));
session.on('audio', (chunk) => { /* play audio */ });
session.on('error', (err) => console.error(err));
session.on('close', () => console.log('Session closed'));

await session.connect();
session.sendText('Tell me about Vietnam');
await session.disconnect();
```

## API Reference

### VoiceAssistant

#### Constructor

```javascript
new VoiceAssistant(config)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Gemini API key |
| `model` | `string` | `gemini-2.5-flash-native-audio-latest` | Gemini Live model |
| `systemPrompt` | `string` | `You are a helpful voice assistant.` | System instruction |
| `voice` | `string` | `Charon` | Prebuilt voice name |
| `tools` | `Array` | `[]` | Tool definitions with `{ name, description, parameters?, handler }` |
| `audioInput` | `object` | `{ sampleRate: 24000, channels: 1, encoding: 'LINEAR16' }` | Audio input format |

#### Methods

| Method | Description |
|--------|-------------|
| `start(audioStream)` | Start full-duplex session with a Readable stream (LINEAR16 PCM 24 kHz mono) |
| `ask(text)` | Send one-shot text prompt to active session |
| `on(event, handler)` | Register event handler |
| `off(event, handler)` | Remove event handler |
| `startListening()` | Re-enable auto-listening |
| `stopListening()` | Disable auto-listening |
| `disconnect()` | End session and cleanup |

#### Events

| Event | Description |
|-------|-------------|
| `listening` | Waiting for user input |
| `thinking` | Model processing |
| `speaking` | Model generating audio response |
| `toolCall` | Model invoked a tool |
| `turnComplete` | Model finished responding |
| `audio` | Received audio chunk `{ mimeType, data }` |
| `text` | Received text response |
| `error` | Error occurred |
| `close` | Session closed |

### VoiceSession

#### Constructor

```javascript
new VoiceSession(config)
```

Same config as `VoiceAssistant` constructor.

#### Methods

| Method | Description |
|--------|-------------|
| `connect(overrides?)` | Connect to Gemini Live API; returns when setupComplete |
| `sendAudio(chunk)` | Send raw audio `{ mimeType, data: string\|Buffer }` |
| `sendText(text)` | Send text query (user turn) |
| `startListening()` | Re-enable auto-listening after model turn |
| `stopListening()` | Stay in turn-complete after model finishes |
| `disconnect()` | Close session and reset to IDLE |

#### Properties

| Property | Description |
|----------|-------------|
| `state` | Current state: `idle`, `connecting`, `listening`, `thinking`, `speaking`, `toolCall`, `turnComplete` |
| `STATES` | Static enum of all state constants |

#### Events (EventEmitter)

| Event | Payload | Description |
|-------|---------|-------------|
| `stateChange` | `{ from, to }` | State transition |
| `text` | `string` | Model text output |
| `audio` | `{ mimeType, data }` | Model audio output |
| `toolCalls` | `Array` | Model function calls |
| `turnComplete` | — | Model finished turn |
| `error` | `Error` | Error occurred |
| `close` | — | Connection closed |

## MCP Tools

Auto-discovered by `@andy-toolforge/mcp`:

| Tool | Description |
|------|-------------|
| `voice_assistant_configure` | Configure assistant settings (systemPrompt, voice, tools) for current session |
| `voice_assistant_session` | Start a bounded voice conversation; returns transcript on completion |

## Domain Examples

The package is domain-agnostic — customize via systemPrompt + tools:

| Domain | Suggested Voice | Description |
|--------|----------------|-------------|
| English tutor | `Zephyr` | Language learning conversation |
| Personal assistant | `Kore` | Task management, reminders |
| Market analyst | `Puck` | Stock/company research |
| Healthcare | `Kore` | Symptom triage, medical info |
| Travel assistant | `Zephyr` | Itinerary, recommendations |
| DevOps | `Fenrir` | Server monitoring, deployment |

## Architecture

```
┌────────────────┐     ┌────────────────┐
│ VoiceAssistant │────>│  VoiceSession  │────>│ Gemini Live API │
│  (high-level)  │     │  (state machine)│     │ (WebSocket)    │
└────────────────┘     └────────────────┘     └────────────────┘
       │                      │                       │
       │ Events               │ Events                │ Audio I/O
       ▼                      ▼                       ▼
   User Code             Tool Handlers          Mic / Speaker
```

- `VoiceAssistant` wraps `VoiceSession` with simpler lifecycle
- `VoiceSession` manages WebSocket lifecycle via `@google/genai`
- Tools declared in config are auto-registered with Gemini function calling
- See `docs/superpowers/specs/2026-07-10-voice-assistant-design.md` for full design

## Development

```bash
npm test -w @andy-toolforge/voice-assistant
```
