# @andy-toolforge/mcp — MCP Server

> Model Context Protocol server exposing toolforge domain packages as MCP tools. Provides CLI and library interfaces for AI agents to use toolforge capabilities (SEO, media generation, content research).

## Structure

```
packages/mcp/
  bin/
    cli.js        — CLI entry: `toolforge-mcp` binary
  lib/
    index.js      — Entry: exports { createServer, MCPServer }
    mcp-server.js — MCPServer  Core MCP server implementation
    (Plugin tools loaded dynamically from each package's mcp-tools.js)
  package.json    — deps: @andy-toolforge/core, @andy-toolforge/content-research, @andy-toolforge/footage-generation
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `MCPServer` | `lib/mcp-server.js` | MCP server class — registers tools, handles JSON-RPC. |
| `createServer(config)` | `lib/index.js` | Factory: `createServer({ apiKey, provider, model })` → MCPServer. |

## Conventions

- Each tool in `lib/tools/<name>.js` exports a single `{ handler, schema }` object.
- Tools call domain packages (footage-generation, content-research, seo-generation) — never duplicate domain logic.
- Use `require('@andy-toolforge/content-research').ContentSummarizer` etc. — never require by relative path across packages.

## Testing

```bash
npm test -w @andy-toolforge/mcp
```
