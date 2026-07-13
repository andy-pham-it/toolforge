# Toolforge genai-tools Package — Design Specification

## Overview

Create a new domain package `@andy-toolforge/genai-tools` that exposes Google Gemini advanced API features as reusable MCP tools. Phase 1 of the Toolforge multi-domain expansion strategy (Option C — Incremental Hybrid).

**Current state:** The monorepo uses `@google/genai` SDK in `tts-generator` and `voice-assistant` for audio/image generation, but no package currently exposes Search Grounding or structured output (responseSchema) capabilities as reusable tools.

**Desired state:** A standalone `@andy-toolforge/genai-tools` package with 2 MCP-ready tools (`search_grounding`, `extract_structured`) that auto-register via the MCP plugin discovery system, with skill files for agent context.

---

## Phase 1: Package Scaffolding & Dependencies

### New package structure

```
packages/genai-tools/
├── package.json         # npm workspace: @andy-toolforge/genai-tools
├── lib/
│   ├── index.js         # Export all tools + tool factory
│   ├── genai-client.js  # Shared GoogleGenAI client wrapper
│   └── tools/
│       ├── search-grounding.js    # search_grounding logic
│       └── extract-structured.js  # extract_structured logic
├── mcp-tools.js         # MCP plugin factory — auto-discovered by @andy-toolforge/mcp
└── skills/
    └── genai-tools-search-grounding.md  # Agent skill file
```

### Dependencies

- `@google/genai` (>=2.10.0) — already in monorepo (used by tts-generator, voice-assistant)
- `@andy-toolforge/core` (>=1.0.0) — for Logger only

### No build step

CommonJS (`require()` / `module.exports`). No ESM, consistent with monorepo convention.

### Workspace registration

Add `"packages/genai-tools"` to root `package.json` workspaces array (if not already covered by `packages/*` glob).

---

## Tool 1: `search_grounding`

### Purpose

Allow AI agents to search Google and receive answers with real-time citations via Gemini's Google Search Grounding feature.

### Behavior

- Uses `@google/genai` SDK with `tools: [{ googleSearch: {} }]` config
- Gemini automatically decides when to search; response includes `groundingMetadata` with cited sources
- Results formatted as: answer text + structured citations array

### MCP Tool Definition

```js
{
  name: 'search_grounding',
  description: 'Search Google for real-time information with cited sources',
  inputSchema: {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string', description: 'Search query' },
      model: {
        type: 'string',
        enum: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
        default: 'gemini-2.5-flash'
      }
    }
  }
}
```

### Output

```json
{
  "answer": "Gemini-generated answer with grounded citations",
  "citations": [
    { "title": "Page Title", "uri": "https://...", "snippet": "Relevant snippet..." }
  ],
  "model": "gemini-2.5-flash"
}
```

### Error handling

- `GEMINI_API_KEY` / `GOOGLE_API_KEY` missing → clear error message
- API failure → wrapped error with model name
- No grounding results → return answer with empty citations array

---

## Tool 2: `extract_structured`

### Purpose

Extract structured JSON data from unstructured text using Gemini's `responseSchema` feature. Replaces regex/nlp parsing with LLM-powered extraction.

### Behavior

- Uses `@google/genai` SDK with `responseModalities: ["TEXT"]` + `responseSchema` (JSON Schema)
- Gemini returns JSON object conforming to the provided schema
- Supports any valid JSON Schema — caller defines the output shape

### MCP Tool Definition

```js
{
  name: 'extract_structured',
  description: 'Extract structured JSON data from text using a schema',
  inputSchema: {
    type: 'object',
    required: ['text', 'schema'],
    properties: {
      text: { type: 'string', description: 'Raw text to extract from' },
      schema: { type: 'object', description: 'JSON Schema defining the output structure' },
      instruction: { type: 'string', description: 'Optional extraction instruction (e.g. "Extract product name, price, and availability")' },
      model: {
        type: 'string',
        enum: ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemma-4-9b-it'],
        default: 'gemini-2.5-flash'
      }
    }
  }
}
```

### Output

```json
{
  "data": { /* object conforming to provided schema */ },
  "model": "gemini-2.5-flash"
}
```

### Error handling

- Missing API key → clear error
- Schema validation failure → error message with schema details
- Model doesn't support responseSchema → fallback model or clear error
- Empty text → error: "text cannot be empty"

---

## Integration with MCP Server

### Auto-discovery via Plugin Architecture

No manual registration needed. The `@andy-toolforge/mcp` server auto-discovers MCP tools from every `@andy-toolforge` package via `_loadPluginTools()`:

```
_loadPluginTools() scans node_modules/@andy-toolforge/<pkg>/mcp-tools.js
for every installed @andy-toolforge package. If the file exists and exports
a function(config) returning [{ definition, handler }], the tools are
registered automatically.
```

The package simply provides `packages/genai-tools/mcp-tools.js` following the standard factory pattern:

```js
// packages/genai-tools/mcp-tools.js
module.exports = function (config = {}) {
    module.exports._pluginConfig = config;
    return [
        { definition: searchGroundingDef, handler: searchGroundingHandler },
        { definition: extractStructuredDef, handler: extractStructuredHandler },
    ];
};
```

No changes to `packages/mcp` are required. The plugin system handles registration automatically when both packages are installed and linked via npm workspaces.

### Reference pattern

See `packages/tts-generator/mcp-tools.js` — the same pattern used by `generate_tts`, `list_tts_voices`, and `inject_tts_tags`.

### Coexistence

Existing tools remain unchanged. genai-tools tools are additive — no breaking changes to existing MCP tool signatures.

---

## Skill File

`packages/genai-tools/skills/genai-tools-search-grounding.md` — describes:
- When to use search_grounding vs extract_structured
- Model selection guidance (gemini-2.5-flash for complex, gemini-3.1-flash-lite for speed)
- Output format expectations
- Error recovery tips

---

## Out of Scope (Phase 1)

- Imagen 4 image generation (requires paid plan — code exists in footage-generation but paused)
- Stock trading tools (Phase 2)
- Training support tools (Phase 3)
- Core infrastructure upgrades (post-install consolidation, AGENTS.md refactoring)
- Voice assistant tools (existing in separate package)
- Streaming/long-running operations

---

## Open Questions

- Should `search_grounding` support dynamic threshold (min citations count)? — Deferred to implementation
- Should `extract_structured` support streaming for large texts? — Deferred; Phase 1 is synchronous only
