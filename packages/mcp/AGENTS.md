# @andy-toolforge/mcp — MCP Server

> Model Context Protocol server exposing toolforge domain packages as MCP tools.
> Provides CLI and library interfaces for AI agents to use toolforge capabilities
> (SEO, media generation, content research, stock analysis, TTS, etc.).
>
> Tools are loaded **dynamically** — each domain package with an `mcp-tools.js`
> file registers its tools with the MCP server at startup.

## Structure

```
packages/mcp/
  bin/
    cli.js        — CLI entry: `toolforge-mcp` binary
  lib/
    index.js      — Entry: exports { createServer, MCPServer }
    mcp-server.js — MCPServer — Core MCP server implementation
    tools/        — Package-specific tool handlers (loaded dynamically)
  package.json    — deps: @andy-toolforge/core, @andy-toolforge/content-research,
                     @andy-toolforge/footage-generation, ...
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `MCPServer` | `lib/mcp-server.js` | MCP server class — registers tools, handles JSON-RPC. Methods: `start()`, `stop()`, `registerTools(pkg)`. |
| `createServer(config)` | `lib/index.js` | Factory: `createServer({ apiKey, provider, model })` → MCPServer instance. |

## Packages with MCP tools (mcp-tools.js)

The MCP server auto-discovers tools by loading `mcp-tools.js` from each registered domain package:

| Package | MCP Tools |
|---------|-----------|
| `@andy-toolforge/authoring` | Lesson/scaffold/image/series tools |
| `@andy-toolforge/ba-support` | Competitor analysis, pricing, SWOT, trends, reports |
| `@andy-toolforge/book-writing` | Book outline, chapter writing, review, export |
| `@andy-toolforge/coding-support` | Code analysis tools |
| `@andy-toolforge/content-operations` | Content ops tools |
| `@andy-toolforge/content-research` | Content research tools |
| `@andy-toolforge/footage-generation` | Image/video generation tools |
| `@andy-toolforge/genai-tools` | LLM utility tools |
| `@andy-toolforge/pm-support` | Project management tools |
| `@andy-toolforge/sdlc-workflows` | SDLC document generation tools (27 — largest) |
| `@andy-toolforge/seo-generation` | SEO metadata generation tools |
| `@andy-toolforge/tts-generator` | Text-to-speech generation tools |
| `@andy-toolforge/vn-stock` | Stock analysis tools |
| `@andy-toolforge/voice-assistant` | Voice assistant tools |

**Packages without MCP tools** (not registered as tool providers):
- `@andy-toolforge/llm-gateway-core` — pure pipeline library, no MCP tools
- `@andy-toolforge/llm-gateway` — gateway service with own CLI/HTTP, no MCP tools

## Conventions

- Each tool in `lib/tools/<name>.js` exports a single `{ handler, schema }` object.
- Tools call domain packages (footage-generation, content-research, seo-generation, etc.) — never duplicate domain logic.
- Use `require('@andy-toolforge/content-research').ContentSummarizer` etc. — never require by relative path across packages.
- Tool schemas follow JSON-RPC / MCP protocol conventions.

## Testing

```bash
npm test -w @andy-toolforge/mcp
```

## See also

- `packages/*/mcp-tools.js` — Individual package tool registrations
- `packages/sdlc-workflows/mcp-tools.js` — Largest tool set (27 tools)
