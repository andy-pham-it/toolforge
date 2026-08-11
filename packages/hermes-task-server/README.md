# @andy-toolforge/hermes-task-server

MCP tool `hermes_task` — dispatch a one-shot agentic task to the locally installed
[Hermes Agent](https://hermes.ai) CLI (`~/.hermes/hermes-agent`, v0.20.0) using only
Hermes' _alive_ free-tier providers.

Zero runtime dependencies. CommonJS. Node >= 20.

## Why

- Hermes' default model (`opencode/deepseek-v4-flash-free`) and its config fallback
  chain (`fallback_providers`, which includes `opencode-zen`) can hang for 600s on a
  429. This tool always spawns with `--ignore-user-config`, so neither the default
  model nor the fallback chain ever enters the picture.
- Provider resolution is liveness-aware (FR-4 3-layer): dead credentials are skipped
  and rate-limited credentials are marked `exhausted` with a reset timestamp, so the
  next `auto` call skips them until the window passes.

## Usage

Register via `@andy-toolforge/mcp` auto-discovery (package-root `mcp-tools.js`) or embed
directly:

```js
const { createServer } = require('@andy-toolforge/hermes-task-server');
const server = createServer({
  cwdAllowlist: ['/absolute/path'], // default: [] -> cwd param denied
  // capabilityMap, tiebreakOrder, etc. — see lib/config.js
});
server.start(); // stdio JSON-RPC
```

Tool call:

```
hermes_task(prompt="Summarize this file", provider="auto", timeout_seconds=300)
```

Response (FR-5):

```json
{
  "ok": true,
  "provider": "gemini",
  "model": "gemini-3.1-flash-lite",
  "result": "<hermes final response, trimmed at 50KB>",
  "truncated": false,
  "exit_code": 0,
  "duration_ms": 4213,
  "session_id": null
}
```

Errors: `busy`, `no_credential`, `provider_not_found`, `cwd_not_allowed`,
`timeout`, `rate_limited`, `spawn_failed`, `unknown`.

### Timeouts

- `timeout_seconds` defaults to **300** (5 min) and is clamped to 10–1800. To override,
  name the timeout in the request (e.g. "timeout 600 giây" → 600, "15 phút" → 900).
  Without an explicit number, the AI uses the 300 default.
- ⚠ Ceiling: the MCP server itself (`mcp.andy-toolforge` in
  `~/.config/opencode/opencode.jsonc`) has `timeout: 600000` (10 min) — a *server-level*
  cutoff, separate from the tool timeout. A `timeout_seconds` above 600 is killed at
  10 min regardless of Hermes still running. For longer tasks, raise the MCP config
  (e.g. `1800000` = 30 min) and restart opencode.

## Configuration

Env overrides: `HERMES_AUTH_PATH` (default `~/.hermes/auth.json`), `HERMES_BIN`
(default `hermes`).

`lib/config.js` defaults: `resetWindowMs` 24h, `maxResultBytes` 50KB,
`maxErrorDetailBytes` 500, `tiebreakOrder` nvidia → huggingface → gemini → kimi-coding,
`capabilityMap` (L2 table: reasoning/reason/coding/vision/multimodal/planning/image-gen/voice/chat).

### Provider liveness semantics

A credential is **alive** unless `last_status` is `exhausted`/`429`/`402` AND its
`last_error_reset_at` is still in the future. A past reset timestamp revives the
credential automatically — free-tier quotas reset daily.

### Capability map notes

- Gemini free model IDs are bare (no provider prefix). gemini-3.1-flash-lite is the
  highest-budget free model (500 RPD / 15 RPM).
- OpenRouter (`:free` suffixed models) and OpenCode Zen (`opencode/*`) entries are
  liveness-gated — they only activate once the underlying provider credential revives.
- `opencode/deepseek-v4-flash-free` is listed **only** for explicit
  `provider="opencode"` use — it is never an implicit default (600s fallback hang risk).

## Tests

```sh
npm test -w @andy-toolforge/hermes-task-server
```

Mock-based; never spawns a real `hermes` process and never touches the real
`~/.hermes/auth.json`. To smoke-test argv against a stub:

```sh
HERMES_BIN=/path/to/echo-stub node -e "..."
```
