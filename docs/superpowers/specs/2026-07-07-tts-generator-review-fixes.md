# TTS Generator Review Fixes

> Fixes for all 4 BLOCKING + 10 HIGH issues found in post-implementation review of `@andy-toolforge/tts-generator`.

## Issues Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | BLOCKING | `generator.js` | `speech_config` empty-string key — should be array of `{tag}` objects |
| 2 | BLOCKING | `generator.js` | `generation_config` snake_case vs camelCase in Interactions API |
| 3 | BLOCKING | `generator.js` | Wrong Interactions API response shape assumption |
| 4 | BLOCKING | `mcp-tools.js` | Stream mode returns batch data — not actual streaming |
| 5 | HIGH | `planner.js` | Missing default LLM (Gemma) for standalone use |
| 6 | HIGH | `mcp-tools.js` | `pickVoiceForTone()` never wired into pipeline |
| 7 | HIGH | `generator.js` | Fragile 403 fallback — mutates `body.model` in-place |
| 8 | HIGH | `generator.js` | `attempt = -1` loop hack — confusing and fragile |
| 9 | HIGH | `mcp-tools.js` | `plan.segments` mutation — shared state pollution |
| 10 | HIGH | `generator.js` | Failed segments in `generateBatch` may lack `id` |
| 11 | HIGH | `output.js` | Naive WAV concatenation — headers corrupt output |
| 12 | HIGH | `generator.js` | API key in URL query — logged by proxies |
| 13 | HIGH | `mcp-tools.js` | Missing input validation |
| 14 | HIGH | `generator.js` | No early API key validation — cryptic errors |

## Fix Plan

### Fix 1-3: `_buildRequestBody()` rewrite (`generator.js`)

**Problem:** Config fields use snake_case (`generation_config`, `voice_config`, `speech_config`) while the Gemini Interactions API expects camelCase (`generationConfig`, `voiceConfig`, `speechConfig`). Also `speech_config` is set as `{ "": [...] }` instead of `[{tag: "tag1"}]`.

**Fix:**
- `generation_config` → `generationConfig`, `response_modalities` → `responseModalities`
- `voice_config` → `voiceConfig`, `voice_name` → `voiceName`
- `speech_config` → `speechConfig`, change from object-with-empty-key to array
- Merge audioTags + pace into a single `speechConfig` array

### Fix 4: Stream mode (`mcp-tools.js`)

**Problem:** `mode='stream'` calls `formatBatch()` and wraps the result — identical to batch mode.

**Fix:** In MCP context, true streaming isn't possible (no SSE support). Rename output to indicate it's a "virtual stream" (ordered segments). Add metadata about each segment's position. Document the MCP streaming limitation.

### Fix 5: Default LLM (`planner.js`)

**Problem:** When `config.llm` is null/undefined and no MCP runtime provides one, planner falls back to regex immediately.

**Fix:** Import `LLMClient` from `@andy-toolforge/core` and create a default instance (Gemma 4 26B via Groq) if no LLM provided and not running in MCP context.

### Fix 6: Wire `pickVoiceForTone` (`mcp-tools.js`)

**Problem:** When `voice='auto'`, the handler doesn't select a voice intelligently.

**Fix:** When `voice='auto'`, call `pickVoiceForTone()` based on script content analysis or default to `'informative'`. Apply to all segments without an explicit voice override.

### Fix 7-8: Clean retry mechanism (`generator.js`)

**Problem:** `attempt = -1` hack to restart loop for 403 fallback is confusing. The for-loop shared with retry logic makes the fallback path unreliable.

**Fix:** Replace for-loop with explicit retry phases:
1. Try primary model with exponential backoff (max 3 attempts)
2. If 403 on last attempt, log fallback and retry with fallback model (max 3 attempts)
3. Clear error message on total failure

### Fix 9: No mutation (`mcp-tools.js`)

**Problem:** `plan.segments.forEach(s => { s.audioTags = ... })` mutates the original plan object.

**Fix:** Create new segment objects via spread/map instead of mutating in-place.

### Fix 10: Failed segment ids (`generator.js`)

**Problem:** In `generateBatch`, if a segment promise is rejected (not caught by inner `.catch`), the error object has no `id`.

**Fix:** The inner `.catch` on each `generate()` call handles errors with `id`. Add a safety net in the `Promise.allSettled` else branch to extract id if available from the rejection reason.

### Fix 11: WAV concatenation (`output.js`)

**Problem:** `Buffer.concat(audioBuffers)` concatenates WAV files including headers, producing invalid output.

**Fix:** Parse each WAV buffer to find the data chunk offset (byte 40 for standard 16-bit PCM WAV), strip header from all but the first buffer. For non-WAV or unknown formats, log a warning and do naive concat.

### Fix 12: API key security (`generator.js`)

**Problem:** `?key=${this.apiKey}` in URL query string — URLs are logged by proxies, load balancers, and server logs.

**Fix:** Remove key from URL. Use `x-goog-api-key` header instead (supported by Gemini API).

### Fix 13-14: Input validation (`generator.js`, `mcp-tools.js`)

**Problem:** No early validation of empty script, missing apiKey, invalid segments.

**Fix:**
- `TTSGenerator` constructor: throw if `apiKey` is falsy
- `generate(segment)`: validate segment has `text` field
- `mcp-tools.js`: validate `script` and `title` non-empty strings

## Test Updates

All fixes need test updates:
- `generator.test.js`: update mock request body expectations (camelCase fields, header auth), add tests for apiKey validation, input validation, WAV concatenation
- `planner.test.js`: add test for default LLM creation
- `output.test.js`: add test for WAV-aware concatenation
- `mcp-tools.js`: covered by integration test (Task 6 already committed)
