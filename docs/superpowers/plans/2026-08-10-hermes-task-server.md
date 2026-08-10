# Implementation Plan: `@andy-toolforge/hermes-task-server` — `hermes_task` MCP tool

- **Date:** 2026-08-10
- **Spec:** `/Users/admin/personal/hermes-opencode-mcp-bridge/HERMES_TASK_MCP_SPEC.md` (v-updated: FR-4 3-layer, 12 edits applied, all verified)
- **Decision (spec §9 Q5):** standalone toolforge wrapper package, **not** an upstream Python patch.
- **Status:** Plan only — no code written yet.

## Goal

Ship a Node.js MCP package inside the toolforge monorepo that registers one tool, `hermes_task`, which dispatches a one-shot agentic task to the locally-installed Hermes Agent CLI (`~/.hermes/hermes-agent`, v0.20.0) using only Hermes' _alive_ free-tier providers. The tool must never hang on Hermes' fallback-chain 600s retry, must never leak the default `opencode/deepseek-v4-flash-free` model, and must mark rate-limited credentials exhausted so subsequent calls skip them.

The package is consumed two ways:

1. Auto-discovered by `@andy-toolforge/mcp` via the package-root `mcp-tools.js` convention.
2. Standalone `createServer(config)` for direct embedding.

## Constraints

- CommonJS only (`require` / `module.exports`); no build step; Node >= 20.
- **Zero new npm dependencies** (toolforge rule: no convenience deps; locking + atomic write done with `fs` + a `wx`-flag lockfile, not `proper-lockfile`).
- Tests: `node:test` co-located in `lib/*.test.js`; **mock-based only — never spawn a real `hermes` process** and never touch real `~/.hermes/auth.json` in tests.
- `child_process.spawn` with list argv (never `shell: true`); timeout must leave **no orphan process** (kill the whole process group).
- Spawn args MUST include `--ignore-user-config` always (verified root-cause fix: config.yaml `fallback_providers` seeds opencode-zen into the fallback chain at agent init, `agent_init.py:1421-1431`, causing the 429 → "Retrying API call in 600s" hang).
- Max concurrency = 1 (spec FR-8/Q3). Second concurrent call fails fast with `busy`.
- All output via the standard MCP JSON-RPC result; package logs to stderr only.
- Do not touch the toolforge repo state beyond this package + root `package.json` workspaces entry.

## Acceptance criteria (mapped from spec §6)

- [ ] AC-1: `tools/list` (via `@andy-toolforge/mcp` discovery) shows `hermes_task` with the FR-2 input schema.
- [ ] AC-2: `provider="auto"` picks an alive provider and returns `{ok: true, provider, model, result, ...}`; selection completes < 120s.
- [ ] AC-3: all credentials exhausted → `{ok: false, error: "no_credential"}` returned < 5s; never falls back to the default model.
- [ ] AC-4: explicit `provider` honored — spawned argv contains `--provider <P>` and `-m <M>` paired; stderr never contains `opencode-zen`.
- [ ] AC-5: unknown explicit provider → `{ok: false, error: "provider_not_found"}` < 5s.
- [ ] AC-6: timeout kills the process group at `timeout_seconds + 5s`; no orphan survives; exit reported as `timeout`.
- [ ] AC-7: 429 in stderr → credential marked `last_status="exhausted"`, `last_error_code="429"`, `last_error_reset_at` written back atomically; next `auto` call skips it.
- [ ] AC-8: concurrent second call returns `busy` immediately; first call unaffected.
- [ ] AC-9: `cwd` param validated against allowlist; disallowed path → `cwd_not_allowed` error.
- [ ] AC-10: result trimmed at 50KB with `truncated: true`.
- [ ] AC-11: full node:test suite passes offline (`npm test -w @andy-toolforge/hermes-task-server`).

## File-level changes (all new under `packages/hermes-task-server/`)

### `package.json` (new)

- `name: "@andy-toolforge/hermes-task-server"`, `version: 0.1.0`, `private: false`.
- `main: lib/index.js`, `engines.node >= 20`, `publishConfig.access: public`.
- `files: ["lib/", "mcp-tools.js"]` (whitelist, matching mcp/sdlc-workflows convention).
- `scripts.test: "node --test lib/*.test.js"`.
- **No dependencies** (peer-less; stdlib only).

### `mcp-tools.js` (new — root, auto-discovery convention)

- `module.exports = function (config) => [{ definition: {name: "hermes_task", description, inputSchema (FR-2 params camelCase)}, handler }]`.
- `handler(config, args)` → calls `lib/server.js` `runHermesTask(args, config)`; returns the FR-5 JSON.

### `lib/index.js` (new)

- Exports `createServer(config)` (MCP server factory — thin wrapper around `@andy-toolforge/mcp`'s `MCPServer` if available, else a minimal JSON-RPC shim; decide at implementation), `runHermesTask`, `pickAliveProvider`.

### `lib/config.js` (new)

- Defaults + env overrides:
  - `authPath`: `~/.hermes/auth.json` (override `HERMES_AUTH_PATH`).
  - `hermesBin`: `"hermes"` (override `HERMES_BIN`).
  - `cwdAllowlist`: `[]` by default (no `cwd` allowed unless configured; e.g. `[process.cwd()]` in consumer config).
  - `resetWindowMs`: 24h (how far past `last_error_reset_at` must be to consider a credential revived).
  - `maxResultBytes`: 50 \* 1024.
  - `maxErrorDetailBytes`: 500.
  - `tiebreakOrder`: `["nvidia", "huggingface", "gemini", "kimi-coding"]` (L3; nous excluded — dead 404).
  - `capabilityMap`: L2 table, see below.
- All fields mergeable from consumer `config`.

### `lib/provider-selector.js` (new — L1/L2/L3)

- `pickAliveProvider(capability, auth, cfg) -> {provider, model} | null`:
  - **L1 (mandatory):** build alive-set from `auth.credential_pool` (dict provider → list of dicts; normalize defensively if a single dict is present). ALIVE iff `last_status` NOT IN `{exhausted, "429", 402}` OR (`last_error_reset_at` exists AND `< now` — revived). Also merge top-level `auth.providers` OAuth keys (e.g. `nous`) as candidate providers.
  - **L2:** classify prompt → capability (default `reasoning`; keyword buckets: reasoning/reason/coding/vision/multimodal/planning/image-gen/voice/chat). Look up `capabilityMap[capability]` → ordered `[(provider, model), ...]`; pick first whose provider is in the alive-set.
  - **L3:** among equally-suitable alive providers, order by `tiebreakOrder`.
  - All dead → return `null` → caller emits `no_credential`.
- `classifyCapability(prompt) -> string` (pure keyword matching; light-LLM out of scope v1).
- `validateProvider(provider, auth) -> bool` (credential_pool keys ∪ top-level providers keys).
- `defaultModelFor(provider, cfg) -> string` (from capabilityMap fallback reasoning entry).

### `lib/capability-map.js` (new — static defaults, configurable)

```js
// capability -> ordered [(provider, model)]
// Model IDs from nx-with-angular/docs/model-aliases-cheatsheet.md (2026-08-09).
// ALIVE providers (auth.json 2026-08-10): nvidia, huggingface, gemini, kimi-coding.
// NOTE: cheatsheet's nvidia/hf free models route via OpenRouter (dead 402) or
// OpenCode Zen (dead 429) — so gemini is the only alive provider with confirmed
// free model IDs. Gemini models use BARE IDs (no provider prefix), matching the
// cheatsheet Gemini table and hermes _normalize_model_for_provider (prefixes
// stripped only for opencode-zen/opencode-go/copilot).
module.exports = {
  // gemini-3.5-flash-lite replaces gemini-2.5-flash (user change 2026-08-10)
  reasoning: [
    ["gemini", "gemini-3.1-flash-lite"],
    ["gemini", "gemini-3-flash"],
    ["gemini", "gemini-3.5-flash-lite"],
    ["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"],
    ["openrouter", "nvidia/nemotron-3-super-120b-a12b:free"],
    ["gemini", "gemini-3.1-flash-lite"],
  ],
  coding: [
    ["gemini", "gemini-3.1-flash-lite"],
    ["gemini", "gemini-3-flash"],
    ["opencode", "mimo-v2.5-free"],
    ["opencode", "cohere/north-mini-code:free"], // North Mini Code (Free) via OpenCode Zen
    ["opencode", "deepseek-v4-flash-free"], // NEVER implicit default — explicit provider=opencode only
    ["openrouter", "cohere/north-mini-code:free"],
  ],
  vision: [
    ["gemini", "gemini-3.5-flash-lite"],
    ["gemini", "gemini-3.1-flash-lite"],
    ["openrouter", "google/gemma-4-31b-it:free"],
  ], // gemma-4-31b (free-vision)
  multimodal: [
    ["gemini", "gemini-3.1-flash-lite"],
    ["openrouter", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
  ],
  planning: [["gemini", "gemini-3.1-flash-lite"]],
  "image-gen": [
    ["gemini", "imagen-4.0-fast-generate"],
    ["gemini", "imagen-4.0-generate"],
  ], // Imagen 4 Generate; execution out of scope v1
  voice: [["gemini", "gemini-3.1-flash-tts"]], // execution out of scope v1
  chat: [
    ["gemini", "gemini-3.1-flash-lite"],
    ["openrouter", "nvidia/nemotron-nano-9b-v2:free"],
    ["opencode", "mimo-v2.5-free"],
    ["openrouter", "poolside/laguna-s-2.1:free"],
    ["openrouter", "poolside/laguna-xs-2.1:free"],
    ["opencode", "deepseek-v4-flash-free"],
  ], // deepseek NEVER implicit default — explicit provider=opencode only
};
```

> RPD context (cheatsheet): gemini-3.1-flash-lite 500 RPD / 15 RPM (best free budget), gemini-3-flash 20 RPD, gemini-3.5-flash-lite 20 RPD (replaces gemini-2.5-flash), gemma-4-31b 14,400 RPD (cheatsheet free-gemma31-local). OpenRouter entries (nemotron-_, laguna-_, north-mini-code, gemma-4-31b-it) are liveness-gated — OpenRouter currently dead 402; revives via last_error_reset_at. opencode/deepseek-v4-flash-free + opencode/mimo-v2.5-free + opencode/cohere/north-mini-code:free (North Mini Code via OpenCode Zen) gated on opencode-zen revival (reset_at 2026-08-11 07:00); deepseek-v4-flash-free must NEVER be an implicit default — explicit provider=opencode only (600s fallback-chain hang risk otherwise). kimi-coding has no confirmed free model IDs → omitted from defaults (config can add).

### `lib/credential-store.js` (new — FR-7)

- `readAuth(path) -> auth` (parse JSON; tolerate missing keys; `credential_pool` may be absent).
- `markExhausted(path, provider, {code, reason, message}, cfg)`:
  - Read → mutate the matching credential(s) for `provider` (set `last_status="exhausted"`, `last_error_code`, `last_error_reason`, `last_error_message`, `last_error_reset_at=Date.now()+resetWindowMs`) → **atomic write** (write `path + ".tmp"` then `fs.renameSync`) → best-effort advisory lock via lockfile `path + ".lock"` opened with `wx` flag (retry a few ms; on contention, proceed unlocked — last-writer-wins acceptable, matches daemon behavior).
- `writeAuth(path, auth)` (shared by both paths above).

### `lib/runner.js` (new — FR-3, FR-6, FR-8)

- `runHermesChat({prompt, provider, model, toolsets, maxTurns, timeoutMs, cwd}, cfg) -> {stdout, stderr, exitCode, durationMs}`:
  - Build argv: `[bin, "chat", "-q", prompt, "--provider", P, "-m", M, "-t", toolsets, "--max-turns", N, "-Q", "--accept-hooks", "--ignore-user-config"]` + `["--in", cwd]` when allowed + `["--pass-session-id"]` (v1: to populate `session_id`).
  - `spawn(bin, argv, {cwd: cfg.spawnCwd, detached: true})`; on timeout at `timeoutMs + 5000`: `process.kill(-child.pid, "SIGKILL")` (whole group → no orphan); map to exit code 124.
  - Capture stdout/stderr via buffers.
- `classifyError({exitCode, stderr, timedOut}) -> code`:
  - timedOut → `timeout`; stderr matches `/429|RateLimitError|FreeUsageLimitError/` → `rate_limited`; ENOENT at spawn → `spawn_failed`; exit != 0 → `unknown` (with stderr snippet).

### `lib/server.js` (new — tool logic, FR-1/FR-2/FR-5/FR-9)

- `runHermesTask(args, cfg)`:
  1. Validate params (prompt required; `timeout_seconds` clamp 10–1800; `max_turns` default 500).
  2. Concurrency lock: if busy → `{ok:false, error:"busy"}`.
  3. Read auth (fail → `no_credential` if unreadable/absent credential_pool? → `no_credential` with detail).
  4. Resolve provider/model: explicit provider → validate (else `provider_not_found`) + pair with explicit `model` or `defaultModelFor`; `auto` → `pickAliveProvider` (null → `no_credential`).
  5. Validate `cwd` against allowlist (else `cwd_not_allowed`).
  6. `runHermesChat` → on `rate_limited` → `markExhausted` write-back, return error JSON.
  7. Build FR-5 result: `{ok, provider, model, result (trimmed ≤50KB, truncated flag), exit_code, duration_ms, session_id (parsed from --pass-session-id output else null + v2 note)}`.
  8. On failure: `{ok:false, error:<code>, error_detail:≤500 chars}`.
  9. stderr log: `[hermes_task] provider=X model=Y prompt_len=N timeout=S -> ok/error_code duration_ms=D` (FR-9).

### `lib/*.test.js` (new, mock-based, offline)

- `provider-selector.test.js` — fixtures: all-alive, all-exhausted, mixed with `last_error_reset_at` past/future (revive logic), missing `credential_pool`, single-dict normalization, top-level `providers` merge, tiebreak order, capability classification keywords.
- `credential-store.test.js` — read tolerance; `markExhausted` sets fields + atomic rename (mock `fs`); lockfile contention path.
- `runner.test.js` — mock `child_process.spawn` (EventEmitter fake child): success; timeout (assert `kill(-pid)` called, exit 124); 429 stderr → `rate_limited`; ENOENT → `spawn_failed`; argv shape assertions (contains `--ignore-user-config`, `-Q`, `--accept-hooks`, paired `--provider`/`-m`).
- `server.test.js` — full `runHermesTask`: happy path JSON shape; no_credential < fast; provider_not_found; busy on concurrent; cwd_not_allowed; 50KB trim + truncated; error_detail cap; FR-9 stderr log line.
- `mcp-tools.test.js` — `mcp-tools.js` returns `[{definition, handler}]` with correct name/schema.

### `README.md` (new, brief)

- Usage: register in consumer config (`cwdAllowlist`, `capabilityMap` overrides), discovery via `@andy-toolforge/mcp`, env overrides, example call + response, notes on provider liveness/reset semantics.

### Root change

- `package.json` (toolforge root): add `"packages/hermes-task-server"` to the `workspaces` array (explicit enumeration convention).

## Test plan

1. `npm install` at toolforge root (links the new workspace).
2. `npm test -w @andy-toolforge/hermes-task-server` — all suites pass offline (no network, no real hermes).
3. Manual smoke (user-invoked, not in CI): `node -e` script calling `runHermesTask` with a real-but-harmless prompt and `provider="nvidia"`, verifying argv via a wrapper `HERMES_BIN` stub that echoes argv (proves no shell, flags present) — **no real provider spend during verification**.
4. Optional user manual test (spec §7): live call with `timeout_seconds=120` against nvidia free tier; then a simulated all-exhausted run against a **copy** of auth.json (never the real file).

## Out of scope (v1, from spec §8 + decisions)

- Upstream Python patch to `mcp_serve.py` (Q5: wrapper instead).
- Real `hermes` process spawning inside tests.
- Voice / image-gen execution, refilling providers, multi-client auth, OpenCode-side changes.
- Attachment parameter (vision only via prompt text referencing files in cwd, per approved FR-4).
- Editing the spec repo's HERMES_TASK_MCP_SPEC.md further (its own repo; commit there is user-initiated).

## Open questions

- **OQ-1:** ✅ RESOLVED via `/Users/admin/personal/nx-with-angular/docs/model-aliases-cheatsheet.md` (2026-08-09): gemini is the only alive provider with confirmed free model IDs — see `capabilityMap` above. nvidia/huggingface free models route via OpenRouter/OpenCode Zen (both dead); kimi-coding has no confirmed free IDs. Add entries when providers revive.
- **OQ-2:** Confirm `--pass-session-id` output format is parseable for `session_id`; otherwise emit `null` + v2 note (spec FR-5 allows).
- **OQ-3:** `cwdAllowlist` default policy — `[]` (deny-all unless configured) is the safe default; confirm consumer wants a specific base dir preconfigured.
- **OQ-4:** Error taxonomy additions `busy` and `cwd_not_allowed` (beyond spec FR-6's six codes) — flag for spec §6 consistency on next spec pass.

## Suggested commit (when implementation lands)

```
feat(hermes-task-server): add hermes_task MCP tool — provider liveness/capability selection, timeout-safe spawn, credential write-back
```
