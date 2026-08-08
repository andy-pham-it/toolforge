# Hermes ↔ OpenCode MCP Bridge — Design

**Date:** 2026-08-08
**Status:** Approved (user-reviewed)
**Spec source:** `/Users/admin/personal/hermes-opencode-mcp-bridge/SPEC.md`

## Goal

Build an MCP server that bridges **Hermes Agent** (the "brain": self-improving, memory, future voice) to **OpenCode CLI** (the "hands": code editing, terminal, git, multi-model). Hermes stays the primary interface; OpenCode does the coding. The bridge is a separate process Hermes spawns — language-agnostic, chosen as **NodeJS/CommonJS** to fit the andy-toolforge monorepo platform (npm workspaces, node:test, auto-publish via GitHub Actions).

## Constraints

- Lives **inside** the andy-toolforge monorepo at `packages/hermes-opencode-mcp-bridge/` (npm workspace member — user decision #7).
- NodeJS/CommonJS (per AGENTS.md: `require()` / `module.exports`, no ESM, no build step). Python direction **completely dropped** (user decision).
- Uses the official `@modelcontextprotocol/sdk` (Server + StdioServerTransport) — protocol-compliant for Hermes as MCP client.
- Scope: Phase 1 (core bridge) + Phase 2 (Hermes integration) + Phase 3 (polish: config, tests, README) in one shot (user decision).
- Out of scope (per SPEC.md): voice integration, self-improvement loops, multi-project support, real-time streaming.
- No linter/formatter config in monorepo; tests use `node:test` co-located in `lib/*.test.js`.

## Architecture

```
Hermes Agent (brain)
    │  MCP over stdio (command: node, args: [<abs>/lib/server.js])
    ▼
hermes-opencode-mcp-bridge  (this package — MCP server)
    │  subprocess: opencode run --format json ...
    ▼
OpenCode CLI (hands: edit, terminal, git, multi-model)
```

### Module layout

```
packages/hermes-opencode-mcp-bridge/
├── package.json          # CommonJS, "main": "lib/index.js", bin: hermes-opencode-bridge
├── lib/
│   ├── index.js          # entry — creates server, registers tools, starts stdio transport
│   ├── server.js         # MCP Server instance + tool registration
│   ├── config.js         # config load/merge (defaults + ~/.config/hermes-opencode/config.json)
│   ├── session.js        # conversation_id ↔ opencode session map, idle cleanup
│   ├── parser.js         # parse `opencode run --format json` output
│   └── tools/
│       ├── opencode-task.js       # main: run task (new or follow-up)
│       ├── opencode-read.js       # read file confined to projectDir
│       ├── opencode-run.js        # arbitrary shell command in projectDir
│       ├── opencode-status.js     # version/models/agents info
│       └── opencode-set-models.js # update configurable model list
├── scripts/
│   └── smoke-test.js     # manual end-to-end vs real CLI (documented in README)
├── README.md
└── AGENTS.md
```

## The 5 Tools

### 1. `opencode_task`
- **Input:** `{task: string, files?: string[], model?: string, agent?: string, auto_commit?: boolean, conversation_id?: string, timeout_ms?: number}`
- **Output:** `{status: 'success'|'error', session_id, summary, files_changed: string[], diff: string}` (or `{status:'error', error:{code, message}}`)
- **New task:** spawn `opencode run --format json --agent <agent> --dir <projectDir> [-m <model>] [-f <file>...] "<task>"`
- **Follow-up:** `conversation_id` present → session map lookup → `opencode run --format json --session <opencodeSessionId> --fork "<task>"`
- **Defaults:** agent ← config.default_agent ('fixer'), model ← config.default_model.
- **Timeout policy (user decision):** no hard deadline by default (tasks may take 2–5 min); optional `timeout_ms` bounds it; on timeout kill process tree, return TIMEOUT error, KEEP session mapping so Hermes can follow up.

### 2. `opencode_read`
- **Input:** `{path: string (relative), line_range?: string like '10-50'}`
- **Output:** `{content, path: absolute, size}`
- Path confined to projectDir (block `../` and absolute escapes).

### 3. `opencode_run`
- **Input:** `{command: string, timeout?: number}` (default 30s)
- **Output:** `{stdout, stderr, exit_code}`
- Spawns shell (`bash -c`) in projectDir. No allowlist/confirmation (user decision — Hermes is trusted).

### 4. `opencode_status`
- **Input:** none
- **Output:** `{version, models: string[], agents: string[], auth_providers: []}`
- Uses `opencode --version`, `opencode models`, `opencode agent list`, cached 60s.

### 5. `opencode_set_models`
- **Input:** `{models: string[]}`
- **Output:** `{models, written: true}`
- Writes to config file so Hermes can maintain the model list at runtime.

## Config

`~/.config/hermes-opencode/config.json`:

```json
{
  "opencode_bin": "~/.opencode/bin/opencode",
  "default_project_dir": "~/projects",
  "default_agent": "fixer",
  "default_model": "opencode/deepseek-v4-flash-free",
  "models": [],
  "session_timeout": 300,
  "auto_commit": false,
  "verbose": false
}
```

- `models: []` = use all models from `opencode models` dynamically.
- Config missing → defaults; bad JSON → CONFIG_ERROR with message.
- Hermes integration: `~/.hermes/config.yaml` gains `mcp_servers: opencode: {command: "node", args: ["<abs path to lib/server.js"]}`.

## Data Flow

### Happy path (new task)
Hermes → `opencode_task {task, files:['src/auth.ts'], agent:'fixer'}` → session.js generates `conversation_id = 'hob-' + random 6 chars` → spawn opencode CLI → parser.js reads JSON lines (sessionID from init event; files_changed from message.part/file-edits; summary from last text parts; diff via `git diff` in projectDir when git repo && !auto_commit) → session map stores `{conversation_id → opencodeSessionId, projectDir, createdAt, lastUsedAt, activePid}` → returns success payload.

### Follow-up
Hermes → `opencode_task {task: 'fix the lint errors', conversation_id}` → lookup map → spawn with `--session <id> --fork` → same parsing → update lastUsedAt.

### Session cleanup
Background interval every 60s (unref'd timer) removes mappings where `now - lastUsedAt > session_timeout` AND no activePid running. Only removes the bridge mapping — opencode cleans up its own sessions. In-memory only; no persistence (Hermes disconnect = clean exit).

## Error Handling

All tools return `{status:'error', error:{code, message}}`. Standard codes:

| Code | Trigger |
|---|---|
| `CONFIG_ERROR` | bad config / opencode_bin missing / project_dir missing (no spawn) |
| `TIMEOUT` | killed process tree; return partial stdout/stderr; keep session mapping |
| `TASK_ERROR` | opencode ran, nonzero exit or error event; return max summary + stderr |
| `PARSE_ERROR` | unparseable/empty output; return RAW output verbatim, never swallow |
| `NOT_FOUND` | read path missing |
| `PATH_ESCAPE` | `../` or absolute escaping projectDir |
| `INVALID_ARGS` | model not in list / bad agent; validate pre-spawn, list valid options |
| `MISSING_CONVERSATION` | conversation_id not in map; hint session expired, suggest new call |

## Edge Cases

1. JSON output read line-by-line; skip non-JSON lines; readline + timeout watchdog (no hang on empty output).
2. Wrong opencode_bin → CONFIG_ERROR pre-spawn.
3. Project not a git repo → diff='', files_changed from events, no crash.
4. Model not in `opencode models` → reject with prefix-match suggestions.
5. `files:[]` → spawn without `-f`.
6. Cleanup race — only remove mapping when idle-expired AND no activePid running.
7. Hermes disconnect → stdio closes → clean process exit.
8. Huge git diff → cap 200KB with truncate marker.
9. `auth_providers` → `[]` (no simple CLI command; documented in README).
10. Concurrency — each task own process; session map keyed by conversation_id; Node single-threaded event loop keeps Map safe.

## Testing Strategy

- `node:test`, co-located `lib/*.test.js` (monorepo convention).
- **No real opencode CLI in CI** — all subprocess mocked (fast, deterministic).
- `lib/config.test.js` — load/merge defaults, bad JSON, missing file (tmpdir fixtures).
- `lib/session.test.js` — conversation_id format, follow-up lookup, idle-expiry cleanup, race (activePid), fake timers.
- `lib/parser.test.js` — parse JSON events → session_id/files_changed/summary; skip non-JSON; empty output → PARSE_ERROR with raw; diff cap 200KB.
- `lib/tools/opencode-task.test.js` — spawn args (--format json/--agent/--dir/-m/-f/--session --fork); mock child_process.spawn.
- `lib/tools/opencode-run.test.js` — shell, exit_code, timeout kill; mock spawn + fake timers.
- `lib/tools/opencode-read.test.js` — read, PATH_ESCAPE, NOT_FOUND; tmpdir fixtures.
- `lib/tools/opencode-status.test.js` — parse + 60s cache; mock execFile + fake timers.
- `lib/server.test.js` — integration via MCP SDK client in-process; all 5 tools; assert response shape.
- Manual smoke script `scripts/smoke-test.js` runs real CLI with tiny task — documented in README.

## Acceptance Criteria

- [x] Design approved by user (all 4 sections)
- [ ] MCP server starts without errors; 5 tools registered and callable
- [ ] opencode_task runs CLI (new + follow-up via conversation_id) and returns result
- [ ] opencode_read reads correctly; opencode_run executes; opencode_status returns info
- [ ] opencode_set_models updates config model list
- [ ] Session management works (follow-ups, idle cleanup)
- [ ] Config file support + user-friendly errors
- [ ] All tests pass; README with install instructions
- [ ] Hermes config integration documented (`hermes mcp add` equivalent)

## Out of Scope

Voice integration, self-improvement loops, multi-project support, real-time streaming, auth_providers detection, Python implementation.
