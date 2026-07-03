# @andy-toolforge/mcp — Specification

> **Status:** Living document — reflects current implementation as of 2026-07-03.
> **Version:** 2.0-dev (plugin-based discovery, transitional from v1 built-in tools)
> **Architecture:** Plugin-based, CommonJS, configurable LLM provider routing

---

## 1. Executive Summary

`@andy-toolforge/mcp` provides a **Model Context Protocol (MCP) server** that exposes toolforge domain capabilities as MCP tools for AI agents. It uses a **plugin-based architecture**: core MCP infrastructure loads built-in tools directly, then discovers additional tools from all installed `@andy-toolforge/*` packages via `mcp-tools.js` convention.

**Key design decisions:**
- **LLM tools, not infrastructure tools** — Each tool wraps an LLM call to a domain package. No direct filesystem manipulation, no Puppeteer/sharp pipelines at the MCP layer.
- **Plugin discovery over config-driven** — Instead of a monolithic `toolforge.config.ts` schema, tools are contributed by each domain package. Plugins register automatically when the package is installed.
- **CommonJS throughout** — No ESM, no build step. `require()` compatible with any consumer.
- **Built-in priority** — Built-in tools always win over plugins on name conflict.

---

## 2. Architecture Overview

```
Agent (Claude/Cursor/IDE)
    │  JSON-RPC (stdin/stdout)
    ▼
┌─────────────────────────────────────────┐
│         @andy-toolforge/mcp             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      MCPServer class            │    │
│  │  ─ constructor(config)          │    │
│  │  ─ start()                      │    │
│  │  ─ _handle(msg)                 │    │
│  │  ─ _handleToolCall(id, params)  │    │
│  │  ─ getToolList()                │    │
│  │  ─ llm (lazy getter/setter)     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      Built-in tools (9)         │    │
│  │  lib/tools/*.js                 │    │
│  │  ─ seo_generate                 │    │
│  │  ─ analyze_script               │    │
│  │  ─ generate_prompts             │    │
│  │  ─ generate_mapping             │    │
│  │  ─ suggest_cover                │    │
│  │  ─ content_summarizer           │    │
│  │  ─ content_ideator              │    │
│  │  ─ article_manager              │    │
│  │  ─ competitor_analyzer          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    Plugin discovery engine      │    │
│  │  _loadPluginTools()              │    │
│  │  _findToolforgeScopeDir()        │    │
│  │  Scans @andy-toolforge/*/        │    │
│  │    mcp-tools.js                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    toolforge_suggest (router)    │    │
│  │  LLM-powered tool suggestion    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘

    ▲                   ▲                   ▲
    │ plugin            │ built-in          │ built-in
    ▼                   ▼                   ▼
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ domain   │    │ footage-     │    │ content-     │
│ packages │    │ generation   │    │ research     │
│ (mcp-    │    │ (direct)     │    │ (direct)     │
│ tools.js)│    └──────────────┘    └──────────────┘
└──────────┘
```

### 2.1 MCPServer Class

```js
const server = new MCPServer({
    apiKey: '...',       // Provider API key (required)
    provider: 'gemini',  // 'gemini' | 'groq'
    model: 'gemini-2.0-flash',
    discover: true,      // Auto-discover plugin tools (default: true)
});
```

| Method | Purpose |
|--------|---------|
| `start()` | Listen on stdin for JSON-RPC messages (MCP transport) |
| `getToolList()` | Return tool definitions for `tools/list` |
| `llm` (get/set) | Lazily-created `LLMClient`; setter allows test injection |

### 2.2 LLM Provider Routing

The server creates an `LLMClient` from `@andy-toolforge/core` with the configured provider/model. Each tool handler receives this client and uses it for all LLM calls. Providers supported: `gemini`, `groq`.

---

## 3. Plugin Discovery Mechanism

### 3.1 `_loadPluginTools()`

Called from constructor (when `config.discover !== false`). Traverses up from `__dirname` looking for `node_modules/@andy-toolforge/`, then iterates each package directory:

```
node_modules/@andy-toolforge/
  ├── ba-support/
  │   └── mcp-tools.js         ← loaded
  ├── book-writing/
  │   └── mcp-tools.js         ← loaded
  ├── content-operations/
  │   └── mcp-tools.js         ← loaded
  ├── core/                    ← no mcp-tools.js, skipped
  ├── footage-generation/      ← tools loaded as built-in, not plugin
  └── ...
```

**Rules:**
- Packages sorted alphabetically for deterministic loading
- Each `mcp-tools.js` must export a function `(config) => [{ definition, handler }]`
- Error isolation: one failing package never blocks others
- Built-in tools take priority: plugin tools with conflicting names are skipped with a warning

### 3.2 `_findToolforgeScopeDir()`

Walks up the directory tree from `__dirname` looking for `node_modules/@andy-toolforge/`. Works for:
- **Monorepo dev**: packages/mcp/ → walk up to root → root/node_modules/@andy-toolforge/ (symlink)
- **Production install**: any depth where node_modules/@andy-toolforge/ exists

### 3.3 mcp-tools.js Contract

```js
// packages/<domain>/mcp-tools.js
module.exports = function mcpTools(config) {
    return [
        {
            definition: {
                name: 'toolforge_my_tool',
                description: 'Description shown to AI agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        param1: { type: 'string', description: '...' },
                    },
                    required: ['param1'],
                },
            },
            handler: async (llm, args) => {
                // llm: LLMClient from @andy-toolforge/core
                // args: validated arguments from caller
                return { result: '...' };
            },
        },
    ];
};
```

---

## 4. Built-in Tools

9 tools bundled in `packages/mcp/lib/tools/`, loaded before plugins.

| Tool Name | File | Domain | Purpose |
|-----------|------|--------|---------|
| `toolforge_seo_generate` | `seo-generate.js` | seo-generation | Generate SEO metadata (title, desc, tags) for YouTube/TikTok/Facebook |
| `analyze_script` | `analyze-script.js` | footage-generation | Analyze script → visual segments with image prompts |
| `generate_prompts` | `generate-prompts.js` | footage-generation | Generate 5 image prompts per segment with style classification |
| `generate_mapping` | `generate-mapping.js` | footage-generation | Map background music + sound design per segment |
| `suggest_cover` | `suggest-cover.js` | footage-generation | Suggest cover art design with palette + generation prompt |
| `andy_toolforge_content_summarizer` | `content-summarizer.js` | content-research | Summarize articles/reports via LLM |
| `andy_toolforge_content_ideator` | `content-ideator.js` | content-research | Generate content ideas by topic/audience/format |
| `andy_toolforge_article_manager` | `content-manager.js` | content-research | Classify, tag, summarize, or improve content |
| `andy_toolforge_competitor_analyzer` | `content-analyzer.js` | ba-support | Crawl competitor URL → SWOT analysis |

---

## 5. `toolforge_suggest` — LLM Router

A meta-tool that uses an LLM to route natural-language tasks to the best registered tool.

**Input:**
```json
{ "task": "I need SEO metadata for a video about React hooks" }
```

**Output:**
```json
{
    "bestTool": "toolforge_seo_generate",
    "reason": "SEO metadata generation for video content",
    "suggestedArgs": { "title": "...", "script": "...", "language": "vi" }
}
```

The tool receives an up-to-date list of all registered tools (excluding itself) and uses the LLM to match the task to the most appropriate tool. This enables agents to discover tool capabilities without prior knowledge.

---

## 6. Plugin Tools (Domain Packages)

### 6.1 `@andy-toolforge/content-operations` — Content Research

| Tool | Actions | Purpose |
|------|---------|---------|
| `toolforge_content_research` | trends, keywords, competitor, gaps, ideas | Multi-action content research |

### 6.2 `@andy-toolforge/ba-support` — Business Analysis

| Tool | Purpose |
|------|---------|
| `toolforge_competitor_analysis` | Competitor crawl + analysis with SWOT framework |
| `toolforge_pricing_analysis` | Pricing strategy analysis |
| `toolforge_swot_analysis` | SWOT analysis |
| `toolforge_trend_analysis` | Market trend analysis |
| `toolforge_business_report` | Comprehensive business report generation |

### 6.3 `@andy-toolforge/book-writing` — Book Writing

| Tool | Purpose |
|------|---------|
| `toolforge_book_outline` | Outline book structure from topic |
| `toolforge_book_write_chapter` | Write a chapter with outline context |
| `toolforge_book_review` | Review chapter for consistency + quality |
| `toolforge_book_export` | Export book to markdown/plain text/HTML |

---

## 7. Project Structure

```
packages/mcp/
├── bin/
│   └── cli.js              — CLI entry: toolforge-mcp binary
├── lib/
│   ├── index.js            — Entry: exports { createServer, MCPServer }
│   ├── mcp-server.js       — MCPServer class (277 lines)
│   └── tools/              — Built-in MCP tool definitions (9 tools)
│       ├── seo-generate.js
│       ├── analyze-script.js
│       ├── generate-prompts.js
│       ├── generate-mapping.js
│       ├── suggest-cover.js
│       ├── content-manager.js
│       ├── content-ideator.js
│       ├── content-summarizer.js
│       └── content-analyzer.js
├── test/                   — (reserved for future integration tests)
├── package.json
└── AGENTS.md
```

---

## 8. Configuration

Production consumers create a server:

```js
const { createServer } = require('@andy-toolforge/mcp');
const server = createServer({
    apiKey: process.env.GEMINI_API_KEY,
    provider: 'gemini',
    discover: true,
});
server.start();
```

Or with Groq:

```js
createServer({
    apiKey: process.env.GROQ_API_KEY,
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
});
```

### 8.1 `discover: false`

When `discover: false` is set, plugin loading is skipped entirely. Only the 9 built-in tools + `toolforge_suggest` are registered (10 total). Useful for testing or minimal deployments.

---

## 9. Testing

```bash
npm test -w @andy-toolforge/mcp
```

Tests use vitest with inline mocking. The test suite covers:

| Test Group | Coverage |
|------------|----------|
| `MCPServer` JSON-RPC | `initialize`, `tools/list`, `tools/call`, unknown method, parse errors |
| Built-in tools | Each tool: valid input returns output, error case handled |
| Plugin discovery | `_findToolforgeScopeDir()`, `toolforge_suggest` registration + validation |
| `discover: false` | Exactly 10 tools (9 built-in + suggest) |
| `discover: true` | 14+ tools including plugin tools from content-operations, ba-support, book-writing |

---

## 10. Implementation Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Built-in tools (seo, footage, content-research) | ✅ Complete (v1) |
| **2** | Plugin discovery mechanism + toolforge_suggest | ✅ Complete (v2-dev) |
| **3** | Domain mcp-tools.js (content-operations, ba-support, book-writing) | ✅ Complete |
| **4** | footage-generation, seo-generation, content-research plugin migration | ⏳ Pending — tools currently built-in; should get mcp-tools.js for consistency |
| **5** | ContentPatternLinter module | ✅ Complete |
| **6** | Governance tools (lint series metadata) | 📋 Planned — new module under content-operations |
| **7** | Asset pipeline (prompts → fetch → optimize → embed) | 📋 Planned — new package or content-operations extension |

---

## 11. Migration Notes

### From v1 (built-in only) to v2 (plugin + discovery)

**No breaking changes.** v2 adds:
- `_loadPluginTools()` runs automatically when `discover` is not `false`
- `toolforge_suggest` is always registered as the last tool
- Existing tool names are unchanged

If a plugin tool conflicts with a built-in tool, the built-in wins and a warning is logged. No tools are overwritten.

### Adding mcp-tools.js to a domain package

1. Create `packages/<domain>/mcp-tools.js` exporting a function
2. Return array of `{ definition, handler }` objects
3. The tool is auto-discovered at next server start — no registration needed
4. Run `npm test -w @andy-toolforge/mcp` to verify (tests exist for plugin counting)

---

## 12. Appendix: Future Architecture (Config-Driven Governance)

The original spec v2.0 (archived) described a config-driven governance model with `toolforge.config.ts`, series discovery, metadata lint, and asset pipeline. These are **not implemented yet** but remain planned as:

| Component | Proposed Package | Status |
|-----------|-----------------|--------|
| `ProjectConfig` schema (Zod) | `@andy-toolforge/core` | 📋 Planned |
| `governance_lint`, `check_all`, `fix` | New package or content-operations | 📋 Planned |
| `assets_embed`, `optimize` | New package | 📋 Planned |
| `lifecycle_init`, `sync`, `rename` | New package | 📋 Planned |

These will follow the **same plugin pattern**: each ships its own `mcp-tools.js`, discovery mechanism already exists.

---

*End of specification v2.0-dev*
