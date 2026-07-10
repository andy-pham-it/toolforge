# Enhancement Request: Expressive TTS for Podcast Narration (Vietnamese)

**Project:** @andy-toolforge/tts-generator
**Date:** 2026-07-08
**Author:** Podcast production team — Chapter 2 "NGHỊCH LÝ CỦA BẢN NGÃ" (The Paradox of Ego)
**Test file:** `nghich-ly-cua-ban-nga/test-live-tts.wav` (1.3MB, 28s, Charon voice, Vietnamese)

---

## 1. Current State

We successfully tested the TTS pipeline end-to-end with `api_mode: 'live'`:

- **Pipeline:** LLM segmentation → `LiveTTSGenerator` (WebSocket, `gemini-2.5-flash-native-audio-latest`) → base64 WAV output
- **Quality:** Voice is clear, model works. **But the output is flat** — lacks emotional variation, pacing changes, emphasis, or any expressive qualities suitable for a 30-minute narrative podcast.
- **What the podcast needs:** A narrative voice that shifts tone with the content — serious when discussing existential philosophy, warm during reflective moments, tense during storytelling (e.g., the cavemen vs. saber-toothed tiger scene), slow and contemplative for key conclusions.

## 2. Research: Gemini TTS Capabilities

Gemini 3.1 Flash TTS (both REST and Live API) supports **200+ inline audio tags** embedded directly in the text for per-sentence control:

**Pacing tags:**
- `[slow]` / `[fast]` — speaking speed
- `[long pause]` / `[short pause]` — dramatic breaks
- `[breathing]` — audible inhale/exhale

**Emotion/expressiveness tags:**
- `[seriousness]`, `[determination]`, `[whispers]`, `[excited]`, `[laughs]`
- `[sigh]`, `[sighs]`, `[laughing]`, `[chuckles]`
- `[tension]`, `[relief]`, `[warm]`, `[gentle]`, `[firm]`

**Style tags:**
- `[storyteller]` — narrative mode
- `[educational]` — explanatory tone
- `[philosophical]` — contemplative depth

**Live API only (v1alpha):**
- `enable_affective_dialog: true` — enables emotion/affect detection from text content

## 3. Proposed Enhancements

### 3.1 TTSPlanner: Auto-Inject Audio Tags Based on Content Analysis

**What:** After the LLM segments the script, the planner should analyze each segment's content and inject appropriate audio tags.

**How it works:**
1. LLM segments the raw script (already done)
2. For each segment, the LLM (or a second pass) analyzes:
   - **Content type:** narrative, explanatory, philosophical, emotional, transitional
   - **Pacing:** slow (complex ideas), normal (flowing narrative), building (climax)
   - **Emotion:** serious, warm, tense, excited, gentle
3. Tags are prepended to each segment text: `[slow][seriousness] Text here...`

**Example transformation:**

| Raw segment text | With tags injected |
|---|---|
| *"Nếu lý trí của chúng ta đều thừa nhận Trái Đất chỉ là một hạt bụi..."* | `[slow][philosophical] Nếu lý trí của chúng ta đều thừa nhận Trái Đất chỉ là một hạt bụi...` |
| *"Hãy thử làm một thí nghiệm tưởng tượng..."* | `[storyteller] Hãy thử làm một thí nghiệm tưởng tượng...` |
| *"Tại sao chỉ một lời chê bai cũng đủ làm chúng ta mất ngủ?"* | `[slow][long pause][seriousness] Tại sao chỉ một lời chê bai cũng đủ làm chúng ta mất ngủ?` |

**Requested API change:**
```javascript
// New parameter for generate_tts
{
  script: "...",
  expressiveness: "auto" | "manual" | "off",
  // "auto" = LLM analyzes content and injects tags
  // "manual" = user provides tags in script text
  // "off" = plain text, no processing (current behavior)
}
```

### 3.2 Tag Passthrough in TTSGenerator

**What:** Support inline `[...]` audio tags in the text sent to the Gemini TTS API.

**Current issue:** Tags in the input text are likely escaped/sanitized. The generator must NOT strip or escape `[...]` patterns before sending to the API.

**Verification needed:**
- Does `LiveTTSGenerator` pass text through as-is to the WebSocket `textInput`?
- Test: `[slow][whispers] Xin chào các bạn.` vs plain `Xin chào các bạn.`
- Expected: tagged version should sound different (slow speed, whisper quality)

### 3.3 Per-Segment Voice Override

**What:** Allow each segment to use a different voice from the 30-voice library.

**Use case:** A podcast segment narrated by Charon (informative) transitions to an emotional reflection voiced by Enceladus (breathy/intimate), then back to Charon.

**Requested API change:**
```javascript
{
  script: "...",
  voice: "auto", // OR
  segments: [
    { text: "...", voice: "Charon" },
    { text: "...", voice: "Enceladus" },
    { text: "...", voice: "Charon" },
  ]
}
```

### 3.4 Affective Dialog (Live API v1alpha)

**What:** Enable `enable_affective_dialog: true` in the Live API WebSocket setup.

**Current state:** The `LiveTTSGenerator` does not pass this parameter. The v1beta endpoint may not support it, but v1alpha does. The model should automatically adjust emotion based on text content when this flag is set.

**Requested API change:**
```javascript
{
  api_mode: "live",
  live_model: "gemini-2.5-flash-native-audio-latest",
  enable_affective_dialog: true,  // NEW
}
```

### 3.5 Output Format: MP3 / OGG / PCM

**What:** Support additional audio output formats.

**Current:** `batch` mode returns base64 WAV data. WAV is uncompressed (~1.3MB for 28s).

**Requested:**
```javascript
{
  mode: "batch",
  output_format: "mp3" | "ogg" | "wav" | "pcm"  // NEW, default "wav"
}
```

Gemini TTS can return MP3 natively (via `audio/mpeg` MIME type). No transcoding needed server-side if the API handles it.

### 3.6 `style_prompt` Parameter

**What:** A free-text description of the desired voice style, passed to the LLM and/or TTS model.

**Example:** `"A calm, wise narrator explaining deep philosophical concepts to a friend — warm, patient, with moments of dramatic tension during stories."`

**How it works:**
1. Passed to TTSPlanner to guide tag injection strategy
2. Could also be passed to the Live API as a system instruction

```javascript
{
  script: "...",
  style_prompt: "Giọng kể chuyện triết lý, ấm áp, chậm rãi, có lúc căng thẳng khi kể chuyện người nguyên thủy",
}
```

## 4. Priority

| # | Enhancement | Effort | Impact | Priority |
|---|---|---|---|---|
| 3.1 | Auto-inject audio tags in TTSPlanner | Medium | High | **P0** |
| 3.2 | Tag passthrough in TTSGenerator | Low | High | **P0** |
| 3.6 | `style_prompt` parameter | Low | Medium | **P1** |
| 3.4 | Affective dialog flag | Low | Medium | **P1** |
| 3.3 | Per-segment voice override | Medium | Medium | **P2** |
| 3.5 | Output format (MP3/OGG) | Low | Low | **P3** |

## 5. Test Script (Vietnamese)

For testing, use this passage from our Chapter 2 script that contains multiple emotional tones:

```
[slow][philosophical] Nếu lý trí của chúng ta đều thừa nhận Trái Đất chỉ là một hạt bụi, vậy tại sao mỗi sáng thức dậy, cái 'Tôi' của chúng ta vẫn to lớn đến thế?
[long pause]
[seriousness] Tại sao chỉ một lời chê bai cũng đủ làm chúng ta mất ngủ?
[whispers] Tại sao chỉ một ánh mắt xem thường cũng đủ khiến chúng ta tổn thương?
[long pause]
[fast][storyteller] Hãy thử làm một thí nghiệm tưởng tượng. Có hai người nguyên thủy cùng bước ra khỏi hang để đi săn. Họ đột ngột đối mặt với một con hổ răng kiếm đang đói mồi.
```

Expected result: The audio should audibly shift between philosophical/slow, whispered/intimate, and fast/storytelling modes.

---

## 6. Contact

This request is from the podcast production team generating a 7-chapter Vietnamese podcast series (~30 min each). We plan to use `generate_tts` as the primary voice pipeline for the entire series once expressiveness is implemented.
