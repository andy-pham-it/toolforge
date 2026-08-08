# @andy-toolforge/hermes-opencode-mcp-bridge

MCP server bridging Hermes Agent to the opencode CLI. CommonJS, no build step.

## Layout

- `lib/config.js` — config load/merge/write (`~/.config/hermes-opencode/config.json`)
- `lib/session.js` — conversation_id ↔ opencode session map with idle sweep
- `lib/parser.js` — parse `opencode run --format json` output (JSONL)
- `lib/tools/*.js` — one file per tool (opencode_run, opencode_read, opencode_status, opencode_set_models, opencode_task)
- `lib/server.js` — MCP server registration (5 tools), `lib/index.js` entrypoint
- `lib/*.test.js` — `node:test` tests, co-located

## Rules

- CommonJS only. No ESM in `lib/`. No build step.
- Tests never spawn the real opencode CLI — always mock `node:child_process`.
- Tools reference `childProcess.spawn`/`execFile` via the module object so
  `mock.method` works in tests.
- Design doc: `docs/superpowers/specs/2026-08-08-hermes-opencode-mcp-bridge-design.md`
