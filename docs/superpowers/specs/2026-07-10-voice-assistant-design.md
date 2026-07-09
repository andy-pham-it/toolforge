# Voice Assistant — Design Spec

> Plugin AI trợ lý ảo bằng giọng nói cho Toolforge monorepo.
> Dùng Gemini Live API (WebSocket bidirectional audio + built-in STT/TTS).

**Date:** 2026-07-10
**Status:** Draft
**Package:** `@andy-toolforge/voice-assistant`
**Dependencies:** `@google/genai`, `@andy-toolforge/core` (LLMClient pattern, Logger)

---

## 1. Mục tiêu

Tạo một plugin AI trợ lý ảo bằng giọng nói (voice assistant) có thể:

- **Nhận giọng nói người dùng** (microphone → STT built-in từ Gemini Live API)
- **Xử lý bằng AI** (Gemini 2.5 Flash Native Audio)
- **Gọi tool/action** (domain-specific: tra cứu database, gửi email, điều khiển thiết bị IoT, v.v.)
- **Trả lời bằng giọng nói** (TTS built-in từ Gemini Live API)
- **Cấu hình linh hoạt** theo từng domain (system prompt, voice, tools)
- **Hoạt động standalone** (Node.js library) và qua **MCP** (cho agent ecosystem)

---

## 2. Kiến trúc tổng quan

### 2.1. Package structure

```
packages/voice-assistant/
├── package.json
├── lib/
│   ├── index.js          # Public exports
│   ├── assistant.js      # VoiceAssistant class (main entry)
│   ├── session.js        # VoiceSession class (per-connection state machine)
│   ├── session.test.js   # Tests
│   └── tools.js          # Tool execution helpers
├── mcp-tools.js          # MCP tool definitions (auto-discovered)
├── skills/
│   └── voice-assistant-workflow.md   # Skill file cho AI agent
└── AGENTS.md             # Domain context
```

### 2.2. Vị trí trong hệ thống

```
┌─────────────────────────────────────────────────┐
│                  Client App                      │
│  (Desktop / Mobile / Web via @google/genai SDK) │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│         @andy-toolforge/voice-assistant           │
│                                                   │
│  VoiceAssistant        VoiceSession               │
│  ┌──────────┐         ┌─────────────────┐        │
│  │ .start() │◄────────│ State Machine   │        │
│  │ .ask()   │         │ idle→connecting→│        │
│  │ events   │         │ listening→      │        │
│  └──────────┘         │ thinking→       │        │
│                       │ speaking→loop   │        │
│                       └────────┬────────┘        │
└────────────────────────────────┼─────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────┐
│           Gemini Live API (WebSocket)             │
│  gemini-live-*-native-audio                       │
│  Built-in STT + TTS + Function Calling            │
└──────────────────────────────────────────────────┘
```

### 2.3. Data flow (full duplex)

```
User mic ──audio──► VoiceAssistant ──audio──► Gemini Live API
                                                      │
                                           (built-in STT)
                                                      │
                                              model reasons
                                                      │
                                          ┌───────────┴──────────┐
                                          ▼                      ▼
                                    functionCall()          audio response
                                          │                      │
                                          ▼                      ▼
                                    execute handler         built-in TTS
                                          │                      │
                                          ▼                      ▼
                                    functionResponse()    user hears voice
                                          │
                                          └───► API continues
```

---

## 3. Config Schema

```js
{
  // Required
  apiKey: string,

  // Optional with defaults
  model: 'gemini-2.5-flash-native-audio-latest',
  systemPrompt: 'You are a helpful voice assistant.',
  voice: 'Charon',                     // Gemini Live voice name

  // Domain-specific tools
  tools: [
    {
      name: 'lookup_order',
      description: 'Tra cứu thông tin đơn hàng',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' }
        },
        required: ['orderId']
      },
      handler: async (args) => { /* return result */ }
    }
  ],

  // Audio config (realtime input from mic)
  audioInput: {
    sampleRate: 24000,    // Hz
    channels: 1,
    encoding: 'LINEAR16'
  }
}
```

**Tool handler contract:**
- Input: `(args: object) => Promise<any>`
- Output: Trả về JSON-serializable result → được gửi vào `functionResponse` của Gemini Live API
- Error: Nếu handler throw, gửi error message vào functionResponse để Gemini xử lý bằng giọng nói

---

## 4. API Surfaces

### 4.1. Standalone Library (Node.js)

```js
const { VoiceAssistant } = require('@andy-toolforge/voice-assistant');

const assistant = new VoiceAssistant({
  apiKey: process.env.GEMINI_API_KEY,
  systemPrompt: 'Bạn là trợ lý bán hàng.',
  tools: [
    {
      name: 'lookup_product',
      description: 'Tra cứu sản phẩm theo tên',
      parameters: { /* JSON Schema */ },
      handler: async ({ name }) => db.findProduct(name)
    }
  ]
});

// Full-duplex: start a live session with microphone
await assistant.start(audioStream);

// Events
assistant.on('listening', () => console.log('🎤 Listening...'));
assistant.on('thinking', () => console.log('🤔 Processing...'));
assistant.on('speaking', () => console.log('🔊 Speaking...'));
assistant.on('toolCall', ({ name, args }) => console.log(`🛠 Call ${name}`, args));
assistant.on('turnComplete', () => console.log('✅ Turn complete'));
assistant.on('error', (err) => console.error('❌', err));

// One-shot: ask with text (no mic input)
const response = await assistant.ask('What is my last order status?');

// Push-to-talk control
assistant.startListening();   // Resume sending audio to API
assistant.stopListening();    // Pause audio capture (let model finish)

// Cleanup
await assistant.disconnect();
```

### 4.2. MCP Tools

Hai MCP tools được expose qua `mcp-tools.js` — auto-discovered bởi MCP server:

| Tool | Description | Scope |
|------|-------------|-------|
| `voice_assistant_session` | Start a bounded voice conversation. Agent calls this (via MCP text) → user speaks via audio → Gemini responds + calls tools → session ends. Max 10 turns, configurable. | Bounded |
| `voice_assistant_configure` | Set persistent assistant config (systemPrompt, voice, default tools). Stored in memory for the session. | Persistent |

**voice_assistant_session** — Dành cho AI agents muốn bắt đầu một cuộc hội thoại giọng nói. Agent gọi tool này (qua MCP text) → hệ thống kết nối Gemini Live API → user nói → Gemini xử lý + gọi tool → kết thúc session. Kết quả trả về: transcript và session summary.

```json
{
  "name": "voice_assistant_session",
  "description": "Start a voice conversation session. The AI agent initiates this (text over MCP), then the user speaks directly via audio. Gemini processes speech, calls tools if needed, and responds with voice. Returns session transcript on completion.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "systemPrompt": { "type": "string", "description": "Override system prompt for this session" },
      "voice": { "type": "string", "description": "Override voice for this session" },
      "maxTurns": { "type": "number", "description": "Max conversation turns (default: 10)" },
      "timeoutSeconds": { "type": "number", "description": "Session idle timeout (default: 60)" }
    }
  }
}
```

**voice_assistant_configure** — Dành cho user/service cấu hình assistant trước:

```json
{
  "name": "voice_assistant_configure",
  "description": "Configure the voice assistant settings (systemPrompt, voice, default tools).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "systemPrompt": { "type": "string" },
      "voice": { "type": "string" },
      "tools": { "type": "array" }
    }
  }
}
```

---

## 5. Session State Machine

```
        ┌──────────────────────────────────────┐
        │                                      │
        ▼                                      │
    ┌─────────┐  connect()  ┌───────────┐      │
    │  idle   │────────────►│ connecting│      │
    │         │◄────────────│           │      │
    └─────────┘ disconnect  └─────┬─────┘      │
                                  │             │
                                  ▼             │
                            ┌──────────┐       │
               startListening│ listening│       │
              ┌──────────────│          │       │
              │              └─────┬────┘       │
              │                    │ user audio │
              │                    ▼            │
              │              ┌──────────┐      │
              │              │ thinking │       │
              │              │          │       │
              │              └──┬───┬───┘       │
              │                 │   │           │
              │         functionCall  audio     │
              │                 │   │           │
              │                 ▼   ▼           │
              │          execute tool  speaking─┼──►(loop back)
              │                 │               │
              │          functionResponse───────┘
              │                 │
              │    turnComplete │
              │                 ▼
              │           startListening (auto)
              └─────────── (or stopListening)

  stopListening ──► (pause audio send, let model finish)
  disconnect ──► idle
```

### States

| State | Meaning | Audio Tx | Audio Rx |
|-------|---------|----------|----------|
| `idle` | No connection | No | No |
| `connecting` | WebSocket opening | No | No |
| `listening` | Sending user audio to API | Yes | Passive |
| `thinking` | Model processing | No | No |
| `speaking` | Model sending audio back | No | Yes |
| `toolCall` | Tool being executed | No | No |

### Transitions

- `listening → thinking`: User stops speaking (Gemini detects end of utterance) OR `stopListening()` called
- `thinking → functionCall`: Model decides to call a tool
- `functionCall → tool → thinking`: Tool handler executed, result sent back
- `thinking → speaking`: Model produces audio response
- `speaking → turnComplete`: Model audio ends
- `turnComplete → listening`: Auto-resume listening (full duplex)
- `turnComplete → idle`: Disconnect or `stopListening()` + silence timeout

---

## 6. Tool Calling

Gemini Live API supports `functionCall` và `functionResponse` trong cùng WebSocket:

1. **Model gửi `functionCall`** — `{ functionCall: { name: 'lookup_order', args: { orderId: '123' } } }`
2. **VoiceAssistant nhận, tìm handler theo `name`**
3. **Gọi `handler(args)`** — async, có thể là DB query / API call
4. **Gửi `functionResponse`** — `{ functionResponse: { name: 'lookup_order', response: { ... } } }`
5. **Gemini tiếp tục** — dùng kết quả để sinh audio response

**Error handling:**
- Handler không tìm thấy: response `{ error: 'Tool "xxx" not found' }`
- Handler throw: catch, response `{ error: error.message }`
- Gemini tự động xử lý lỗi bằng giọng nói (ví dụ: "Xin lỗi, tôi không thể tra cứu đơn hàng lúc này.")

---

## 7. Implementation Plan

### 7.1. Files to create

| File | Responsibility |
|------|---------------|
| `packages/voice-assistant/package.json` | npm package: name, version, deps (`@google/genai`), workspace config |
| `packages/voice-assistant/lib/index.js` | Export { VoiceAssistant } |
| `packages/voice-assistant/lib/assistant.js` | VoiceAssistant class: start/ask/events/tool dispatch |
| `packages/voice-assistant/lib/session.js` | VoiceSession class: state machine, Gemini Live WebSocket lifecycle |
| `packages/voice-assistant/lib/session.test.js` | Tests for session state machine (no API key needed) |
| `packages/voice-assistant/mcp-tools.js` | MCP tool definitions: voice_assistant_session, voice_assistant_configure |
| `packages/voice-assistant/skills/voice-assistant-workflow.md` | Skill file cho AI agent |
| `packages/voice-assistant/AGENTS.md` | Domain context |

### 7.2. Implementation order

1. **package.json** — Define package, dependencies
2. **session.js** — State machine, Gemini Live API WebSocket handling
3. **session.test.js** — Test state transitions (mock WebSocket)
4. **assistant.js** — Higher-level API (start/ask/events)
5. **index.js** — Exports
6. **mcp-tools.js** — MCP integration
7. **skills/ + AGENTS.md** — Documentation

### 7.3. Key implementation details

**Gemini Live API connection** (session.js):

```js
const { Live } = require('@google/genai');

class VoiceSession extends EventEmitter {
  async connect(config) {
    this.setState('connecting');
    
    this.live = await Live.connect({
      model: config.model,
      apiKey: config.apiKey,
      config: {
        systemInstruction: { parts: [{ text: config.systemPrompt }] },
        voiceConfig: { prebuiltVoice: config.voice },
        tools: config.tools.map(t => ({
          functionDeclaration: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        }))
      }
    });

    // Handle incoming audio
    this.live.on('audio', (audioData) => {
      this.setState('speaking');
      this.emit('audio', audioData);
    });

    // Handle tool calls
    this.live.on('functionCall', async (call) => {
      this.setState('toolCall');
      this.emit('toolCall', { name: call.name, args: call.args });
      
      const handler = this.toolHandlers[call.name];
      try {
        const result = handler ? await handler(call.args) : { error: `Tool "${call.name}" not found` };
        await this.live.send({ functionResponse: { name: call.name, response: result } });
      } catch (err) {
        await this.live.send({ functionResponse: { name: call.name, response: { error: err.message } } });
      }
      
      this.setState('thinking');
    });

    // Handle turn completion
    this.live.on('turnComplete', () => {
      this.setState('turnComplete');
      this.emit('turnComplete');
      if (this.autoListen) this.startListening();
    });

    // Send setup complete
    await this.live.send({ setupComplete: true });
    this.setState('listening');
  }

  sendAudio(chunk) { this.live.send({ audio: chunk }); }
  startListening() { this.autoListen = true; this.setState('listening'); }
  stopListening() { this.autoListen = false; }
  async disconnect() { await this.live.close(); this.setState('idle'); }
}
```

**Note:** The exact `@google/genai` Live API API surface may differ — implementation will adapt to the actual SDK.

---

## 8. Usage Examples

### 8.1. E-commerce assistant (Desktop app)

```js
const assistant = new VoiceAssistant({
  systemPrompt: 'Bạn là trợ lý bán hàng thông minh. Giúp khách hàng tra cứu sản phẩm, đặt hàng, kiểm tra đơn hàng.',
  voice: 'Kore',
  tools: domainTools  // lookup_product, create_order, check_order_status
});

assistant.start(micStream);
```

### 8.2. IoT assistant (Mobile app)

```js
const assistant = new VoiceAssistant({
  systemPrompt: 'You are a smart home assistant. Control lights, AC, curtains, and answer questions.',
  voice: 'Zephyr',
  tools: iotTools  // turn_light, set_temperature, open_curtain
});

assistant.start(micStream);
```

### 8.3. Customer support (Web/Agent via MCP)

Agent MCP gọi `voice_assistant_session` với systemPrompt riêng:

```json
{
  "session": {
    "systemPrompt": "Bạn là nhân viên hỗ trợ kỹ thuật. Hướng dẫn khách hàng khắc phục lỗi mạng.",
    "voice": "Puck",
    "maxTurns": 15
  }
}
```

---

## 9. Domain Adaptation

VoiceAssistant là **domain-agnostic** — mọi sự khác biệt giữa các domain đều nằm ở systemPrompt + tools. Plugin không cần sửa code core khi chuyển domain.

### 9.1. Học tiếng Anh

```js
const tutor = new VoiceAssistant({
  systemPrompt: `You are an English tutor. Follow these rules:
- Respond in English unless the user asks for a Vietnamese explanation
- Correct grammar errors gently: "Good try! A more natural way to say that is..."
- When the user asks about a word, provide: pronunciation (IPA), definition, example sentence
- Suggest 1-2 alternative expressions per turn when appropriate
- Keep your speech at a moderate pace for learners`,
  voice: 'Zephyr',  // warm, clear voice
  tools: [
    {
      name: 'check_grammar',
      description: 'Analyze a sentence for grammar errors and suggest corrections',
      parameters: { /* sentence: string */ },
      handler: async ({ sentence }) => grammarAPI.check(sentence)
    },
    {
      name: 'lookup_word',
      description: 'Look up a word: definition, IPA pronunciation, examples',
      parameters: { /* word: string */ },
      handler: async ({ word }) => dictionaryAPI.lookup(word)
    },
    {
      name: 'assess_pronunciation',
      description: 'Analyze user pronunciation from a short audio clip and give feedback',
      parameters: { /* audioBase64: string, expectedWord: string */ },
      handler: async ({ audioBase64, expectedWord }) => speechAssessmentAPI.score(audioBase64, expectedWord)
    }
  ]
});
```

### 9.2. Trợ lý cá nhân (notes, calendar, email)

```js
const pa = new VoiceAssistant({
  systemPrompt: `Bạn là trợ lý cá nhân. Bạn có thể:
- Tạo ghi chú nhanh, tìm kiếm ghi chú cũ
- Xem lịch, tạo sự kiện mới, đặt lịch hẹn
- Soạn và gửi email, đọc email mới
- Luôn xác nhận trước khi thực hiện hành động quan trọng (gửi email, xoá sự kiện)
- Trả lời ngắn gọn, tự nhiên bằng giọng nói`,
  voice: 'Kore',
  tools: [
    { name: 'create_note', description: 'Create a new note', handler: async ({ title, body }) => notesAPI.create(title, body) },
    { name: 'search_notes', description: 'Search notes by keyword', handler: async ({ query }) => notesAPI.search(query) },
    { name: 'get_calendar_events', description: 'Get upcoming calendar events', handler: async ({ date }) => calendarAPI.getEvents(date) },
    { name: 'schedule_event', description: 'Create a new calendar event', handler: async ({ title, start, end, description }) => calendarAPI.createEvent(title, start, end, description) },
    { name: 'send_email', description: 'Send an email', handler: async ({ to, subject, body }) => emailAPI.send(to, subject, body) },
    { name: 'read_recent_emails', description: 'Read recent unread emails', handler: async ({ max }) => emailAPI.getInbox(max) }
  ]
});
```

### 9.3. Trợ lý tìm kiếm & phân tích (công nghệ, chứng khoán, kinh doanh)

```js
const analyst = new VoiceAssistant({
  systemPrompt: `Bạn là chuyên gia phân tích. Bạn có thể:
- Tra cứu thông tin thị trường chứng khoán, giá cổ phiếu
- Tìm kiếm và tóm tắt tin tức công nghệ / kinh doanh
- Phân tích báo cáo tài chính, chỉ số ngành
- Đưa ra nhận định dựa trên dữ liệu (kèm disclaimer: không phải lời khuyên đầu tư)
- Trả lời bằng tiếng Việt, ngắn gọn, có số liệu cụ thể`,
  voice: 'Puck',
  tools: [
    { name: 'search_web', description: 'Search the web for recent information', handler: async ({ query }) => webSearch.search(query) },
    { name: 'summarize_article', description: 'Fetch and summarize an article from a URL', handler: async ({ url }) => summarize.fetchAndSummarize(url) },
    { name: 'get_stock_price', description: 'Get current stock price and daily change', handler: async ({ symbol }) => financeAPI.stockPrice(symbol) },
    { name: 'get_company_info', description: 'Get company profile and financial metrics', handler: async ({ symbol }) => financeAPI.companyProfile(symbol) },
    { name: 'get_market_news', description: 'Get latest news about a stock or sector', handler: async ({ topic }) => financeAPI.news(topic) }
  ]
});
```

### 9.4. Trợ lý y tế (healthcare)

```js
const healthAssistant = new VoiceAssistant({
  systemPrompt: `Bạn là trợ lý y tế thông minh. Bạn có thể:
- Tra cứu triệu chứng bệnh và cung cấp thông tin tham khảo (kèm disclaimer: không thay thế bác sĩ)
- Nhắc lịch uống thuốc, theo dõi sức khỏe hàng ngày
- Tra cứu thông tin bệnh viện, bác sĩ gần đây
- Hỗ trợ đặt lịch hẹn khám bệnh
- Luôn kèm disclaimer khi đưa ra thông tin y tế`,
  voice: 'Kore',
  tools: [
    { name: 'symptom_checker', description: 'Tra cứu thông tin về triệu chứng', handler: async ({ symptom }) => medicalDB.lookupSymptom(symptom) },
    { name: 'find_nearby_hospitals', description: 'Tìm bệnh viện/phòng khám gần đây', handler: async ({ location, specialty }) => mapsAPI.findNearby(location, specialty) },
    { name: 'book_appointment', description: 'Đặt lịch hẹn khám bệnh', handler: async ({ doctorId, date, time }) => bookingAPI.schedule(doctorId, date, time) },
    { name: 'medication_reminder', description: 'Tạo nhắc nhở uống thuốc', handler: async ({ medication, time, frequency }) => reminderAPI.create(medication, time, frequency) },
    { name: 'health_tip', description: 'Cung cấp mẹo sức khỏe theo chủ đề', handler: async ({ topic }) => healthTips.get(topic) }
  ]
});
```

### 9.5. Trợ lý du lịch

```js
const travelAssistant = new VoiceAssistant({
  systemPrompt: `Bạn là trợ lý du lịch thông minh. Bạn có thể:
- Tìm kiếm chuyến bay, khách sạn, tour du lịch
- Đề xuất itinerary theo ngân sách và sở thích
- Cung cấp thông tin thời tiết, địa điểm tham quan
- Đặt vé máy bay, phòng khách sạn (xác nhận trước khi đặt)
- Hỗ trợ đa ngôn ngữ: tiếng Việt, tiếng Anh`,
  voice: 'Zephyr',
  tools: [
    { name: 'search_flights', description: 'Tìm chuyến bay', handler: async ({ from, to, date }) => flightAPI.search(from, to, date) },
    { name: 'search_hotels', description: 'Tìm khách sạn theo địa điểm', handler: async ({ location, checkIn, checkOut }) => hotelAPI.search(location, checkIn, checkOut) },
    { name: 'get_weather', description: 'Dự báo thời tiết', handler: async ({ location, date }) => weatherAPI.forecast(location, date) },
    { name: 'recommend_attractions', description: 'Gợi ý địa điểm tham quan', handler: async ({ city, interests }) => travelAPI.attractions(city, interests) },
    { name: 'book_flight', description: 'Đặt vé máy bay', handler: async ({ flightId, passengers }) => bookingAPI.bookFlight(flightId, passengers) }
  ]
});
```

### 9.6. Trợ lý nhà hàng / ẩm thực

```js
const restaurantAssistant = new VoiceAssistant({
  systemPrompt: `Bạn là trợ lý ẩm thực. Bạn có thể:
- Gợi ý món ăn theo sở thích, chế độ ăn, nguyên liệu có sẵn
- Tra cứu công thức nấu ăn, hướng dẫn từng bước
- Tìm nhà hàng theo khu vực, loại món ăn, giá cả
- Đặt bàn nhà hàng, gọi món
- Tính toán dinh dưỡng cho khẩu phần ăn`,
  voice: 'Puck',
  tools: [
    { name: 'suggest_dish', description: 'Gợi ý món ăn dựa trên sở thích/nguyên liệu', handler: async ({ preferences, ingredients }) => recipeAI.suggest(preferences, ingredients) },
    { name: 'get_recipe', description: 'Tra cứu công thức nấu ăn', handler: async ({ dishName }) => recipeDB.lookup(dishName) },
    { name: 'find_restaurant', description: 'Tìm nhà hàng', handler: async ({ location, cuisine, priceRange }) => mapsAPI.findRestaurants(location, cuisine, priceRange) },
    { name: 'reserve_table', description: 'Đặt bàn nhà hàng', handler: async ({ restaurantId, date, time, partySize }) => bookingAPI.reserve(restaurantId, date, time, partySize) },
    { name: 'nutrition_info', description: 'Tính toán thông tin dinh dưỡng', handler: async ({ dishName, portion }) => nutritionAPI.calculate(dishName, portion) }
  ]
});
```

### 9.7. Trợ lý DevOps (developer operations)

```js
const devopsAssistant = new VoiceAssistant({
  systemPrompt: `You are a DevOps assistant. You can:
- Check CI/CD pipeline status, recent deployments
- View server/application logs and metrics
- Restart services, scale resources
- Query database, run read-only commands
- Monitor system health and alert on anomalies
- Always confirm before any destructive action (restart, scale down, delete)`,
  voice: 'Fenrir',
  tools: [
    { name: 'check_pipeline', description: 'Check CI/CD pipeline status for a project/branch', handler: async ({ project, branch }) => ciAPI.pipelineStatus(project, branch) },
    { name: 'view_logs', description: 'View recent application logs', handler: async ({ service, lines }) => logAPI.tail(service, lines) },
    { name: 'get_metrics', description: 'Get system metrics (CPU, memory, requests)', handler: async ({ service, duration }) => metricsAPI.get(service, duration) },
    { name: 'restart_service', description: 'Restart a service (requires confirmation)', handler: async ({ service }) => infraAPI.restart(service) },
    { name: 'run_query', description: 'Run a read-only SQL query', handler: async ({ query }) => dbAPI.readOnlyQuery(query) }
  ]
});
```

### 9.8 Ghép nối domain

Các config trên có thể được:
- **Định nghĩa tĩnh** trong code (như examples trên)
- **Lưu trong database** và load theo user
- **Override qua MCP** tool `voice_assistant_configure` (cho agent tự động chuyển domain)
- **Kết hợp nhiều domain** bằng cách merge tools từ nhiều module (VD: cá nhân + chứng khoán)

---

## 10. Out of Scope (v1)

- **Audio file processing** (pre-recorded audio) — v1 only handles realtime microphone input
- **Multi-language ASR config** — Gemini Live API auto-detects language
- **Local fallback** — requires internet to Gemini API
- **Conversation persistence** — each session is ephemeral
- **Speaker diarization** — single speaker only
- **Voice activity detection (VAD)** — delegated to client app (mic stream control)

---

## 11. Open Questions

- `@google/genai` Live API exact API surface — cần kiểm tra SDK docs khi implement
- Mic stream API format (Node.js `audio-stream` / browser `MediaStream` / React Native `react-native-audio`) — client cần chuyển đổi về LINEAR16 PCM 24kHz
- Tool handler timeout — cần configurable timeout để tránh treo WebSocket
