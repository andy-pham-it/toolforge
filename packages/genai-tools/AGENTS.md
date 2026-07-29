# @andy-toolforge/genai-tools — GenAI Client & Utilities

> Domain package providing a thin wrapper around the Google GenAI SDK,
> a core ProviderAdapter extension for chat/retry/fallback, and LLM utility
> tools (grounded search, structured data extraction).

## Structure

```
packages/genai-tools/
  lib/
    index.js                 — Entry: exports { GenAIClient, GenAIAdapter,
                                  searchGrounding, extractStructured }
    genai-client.js          — GenAIClient — Thin wrapper around @google/genai SDK
    genai-adapter.js         — GenAIAdapter — extends core ProviderAdapter
    tools/
      search-grounding.js    — searchGrounding — Google Search–grounded Gemini
      extract-structured.js  — extractStructured — JSON schema extraction
  mcp-tools.js               — MCP tool handlers
  package.json               — deps: @andy-toolforge/core, @google/genai
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `GenAIClient` | `lib/genai-client.js` | Thin wrapper around `@google/genai` SDK. Constructor: `new GenAIClient({ apiKey?, model? })`. Methods: `chat(content)`, `chatStream(content)`, `setModel(model)`. |
| `GenAIAdapter` | `lib/genai-adapter.js` | Extends core `ProviderAdapter` with chat(), retry logic, and fallback chains. Constructor: `new GenAIAdapter({ apiKey?, models?, maxRetries? })`. |
| `searchGrounding` | `lib/tools/search-grounding.js` | Answer a query using Google Search–grounded Gemini. Returns answer with cited sources. Signature: `searchGrounding(query, { model? })`. |
| `extractStructured` | `lib/tools/extract-structured.js` | Extract structured JSON from text using Gemini responseSchema. Signature: `extractStructured(content, schema, { instruction?, model? })`. |

## Conventions

- `GenAIAdapter` should be used when ProviderAdapter integration is needed (pipeline stages, fallback).
- `GenAIClient` is for direct SDK usage without pipeline overhead.
- Both support model override per-call.
- MCP tools registered via `mcp-tools.js`.
- Skill files prefixed with `genai-tools-`.

## Testing

```bash
npm test -w @andy-toolforge/genai-tools
```

## See also

- `@andy-toolforge/core/lib/llm.js` — core ProviderAdapter / LLMClient
