# LLM Provider Adapter Pattern — Core Refactor

## Goal
Refactor `@andy-toolforge/core`'s LLMClient to use a Strategy Pattern with Provider Adapters. Each provider (Gemini, Groq, OpenAI) gets its own adapter file. The core LLMClient holds a priority-ordered list of adapters and tries the next on failure — enabling cross-provider fallback. Domain subclasses (footage-generation, content-research) keep working unchanged. The MCP Server's model-chain fallback is replaced by the shared adapter chain.

## Constraints
- CommonJS (`require` / `module.exports`) — no ESM
- `chat(systemPrompt, userPrompt, jsonMode, fetchFn)` interface MUST NOT CHANGE — domain subclasses depend on it
- `chatJSON()` MUST continue to work unchanged
- Tests MUST pass with minimal changes
- No new npm dependencies in `@andy-toolforge/core`
- Backward compatible: existing `new LLMClient({ provider, apiKey, model })` must still work (acts as single-adapter config)
- Adapters for `@google/genai` SDK (GenAIClient) and OpenAI-compatible (Groq/Gemini openai endpoint) both supported
- The `@andy-toolforge/genai-tools` GenAIClient becomes a thin GenAIAdapter wrapper — GenAIClient class may remain as a compatibility alias

## Acceptance criteria
- [x] ProviderAdapter base contract defined (JSDoc interface in `lib/provider-adapter.js`)
- [x] OpenAIAdapter: wraps existing OpenAI-compatible chat completions (Groq, Gemini OpenAI endpoint, OpenAI) — keeps current fetch-based logic
- [x] GenAIAdapter: wraps `@google/genai` SDK's `generateContent()` to conform to the adapter interface
- [x] CoreLLMClient refactored: constructor accepts `adapters[]` (priority-ordered); `chat()` iterates adapters on failure; backward-compatible `{ provider, apiKey, model }` constructor mode creates a single OpenAIAdapter
- [x] MCP Server (`packages/mcp/lib/mcp-server.js`) updated to use the new adapter-based LLMClient instead of its own model-chain fallback
- [x] StockLLM (`packages/vn-stock/lib/llm.js`) updated to use the new CoreLLMClient with adapters instead of hardcoding GenAIClient + LLMClient
- [x] Domain subclasses (footage-generation, content-research) remain source-compatible — zero code changes needed
- [x] All existing tests pass: `npm test -w @andy-toolforge/core`
- [x] New adapter unit tests added

## File-level changes
### `packages/core/lib/provider-adapter.js` (NEW)
- Export `ProviderAdapter` base class with interface contract
- `async chat({ systemPrompt, messages, jsonMode, fetchFn }) => { content, usage? }`
- Normalized output format

### `packages/core/lib/openai-adapter.js` (NEW)
- Extracts current fetch-based logic from CoreLLMClient
- Handles: Groq, Gemini (OpenAI endpoint), OpenAI
- Retry/backoff logic per adapter
- `async chat({ systemPrompt, messages, jsonMode, fetchFn })`

### `packages/core/lib/genai-adapter.js` (NEW)
- Wraps `@google/genai` SDK's `GoogleGenerativeAI` / `generateContent()`
- Maps to normalized adapter output
- Only used when `@google/genai` is available (optional dep via `genai-tools` or caller installs it)

### `packages/core/lib/llm.js` (MODIFY)
- Constructor enhancements:
  - If `adapters[]` provided, use them directly (priority order)
  - If `{ provider, apiKey, model }` provided (backward-compat), create single OpenAIAdapter
  - If `{ genaiKey }` provided (backward-compat for existing GenAIClient usage), create GenAIAdapter
- `chat()` method: iterate adapters in priority order, catch errors, try next
- `chatJSON()` unchanged — still delegates to `this.chat()`

### `packages/core/lib/index.js` (MODIFY)
- Export new adapter classes

### `packages/core/lib/llm.test.js` (MODIFY)
- Add tests for adapter iteration, fallback behavior
- Existing backward-compat tests kept

### `packages/mcp/lib/mcp-server.js` (MODIFY)
- Replace `_nextModel()` + model-chain fallback with adapter-based approach
- MCPServer passes `adapters[]` to LLMClient instead of `{ provider, apiKey, model }`
- `_isRetryableError()` merges into adapter retry logic
- `_nextModel()` becomes selecting next adapter

### `packages/vn-stock/lib/llm.js` (MODIFY)
- Replace hardcoded `new GenAIClient()` + `new LLMClient()` with single `new CoreLLMClient({ adapters: [genaiAdapter, openaiAdapter] })`

## Test plan
- `npm test -w @andy-toolforge/core` — existing + new adapter tests
- Unit tests for: adapter fallback chain, backward-compat constructor, error propagation
- Manual check: domain subclasses import unchanged

## Out of scope
- No changes to domain packages' own code (footage-generation, content-research) beyond their import if needed
- No changes to `@andy-toolforge/genai-tools` structure (GenAIClient can remain as re-export alias)
- No ESM conversion
- No new provider support (OpenAI adapter covers existing 3 providers via OpenAI-compatible endpoint; GenAIAdapter covers native Gemini SDK)

## Open questions
- Should GenAIAdapter live in `@andy-toolforge/genai-tools` (near its SDK) or in core? Decision: in core for now, since `@google/genai` is the native Gemini path — a soft `require()` with fallback for when the dep isn't installed.
