# MCPErrorTracker — Centralized Error Tracking for MCP Servers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared, zero-dependency error tracking utility (`MCPErrorTracker`) to `@andy-toolforge/core` and wire it into the two existing MCP server implementations (`packages/sdlc-workflows/mcp-server.js` and `packages/mcp/lib/mcp-server.js`) to provide centralized error counting, structured JSONL logs, an in-memory ring buffer, and a critical-error alerting hook — without changing the JSON-RPC response shape produced by either server.

**Status:** Design approved. Scope is fixed. No design questions remain.

---

## Goal

Create a single shared error-tracking utility and use it in both MCP server implementations so that:

- Every tool call (success or failure) is counted and timestamped.
- Errors are bucketed by JSON-RPC code (`-32602` invalid input, `-32601` not found, `-32000` internal, etc.).
- An optional JSONL append-log captures every call for post-mortem analysis.
- An optional `onCritical` hook fires for internal errors (`-32000`), enabling alerting without coupling core to any alerting system.
- A `getStats()` / `reset()` pair supports dashboards and test isolation.

Reuse across all present and future MCP servers; production observability without per-server duplication.

---

## Constraints

- **CommonJS only** (`require` / `module.exports`). No ESM. No build step.
- **Zero new dependencies** in any package. Only `node:fs` and `node:path` from Node stdlib (plus `node:os` in tests).
- Domain packages must not depend on each other; this utility belongs in **core** as a shared foundation (`packages/core/AGENTS.md` rule: "No dependency on other @andy-toolforge packages — core is the root of the dependency tree").
- Do **NOT** change the JSON-RPC error response shape produced by either server. The tracker wraps handlers and re-throws; the server layer still owns the response envelope.
- Preserve existing typed errors in `packages/sdlc-workflows/lib/errors.js` (`ToolInputError -32602`, `ToolNotFoundError -32602`, `ToolInternalError -32000`). `err.code` must be forwarded unchanged through the wrap.
- Preserve existing `--debug` flag behavior in `packages/sdlc-workflows/mcp-server.js`.
- Tests co-located as `lib/*.test.js` using `node:test` + `node:assert` (no jest/mocha/vitest — see `packages/core/AGENTS.md`).
- Per monorepo policy: README update is required before version bump/publish, but that is a release concern, **out of scope** for this plan.

---

## Acceptance criteria

1. `packages/core/lib/mcp-error-tracker.js` exists and exports the `MCPErrorTracker` class with: `constructor`, `wrap`, `wrapHandle`, `getStats`, `reset`.
2. `packages/core/lib/index.js` re-exports `MCPErrorTracker` (as the 8th symbol alongside the existing 7).
3. `packages/core/lib/mcp-error-tracker.test.js` exists with 6 test cases, all passing:
   1. `wrap` success logs `ok` entry and returns the handler result.
   2. `wrap` failure increments `errorCounts[err.code]`, logs `error` entry, re-throws.
   3. Plain `Error` (no `code`) falls back to `-32000` and triggers `onCritical`.
   4. `wrapHandle` re-throws and logs `handle_error` (with `method: msg?.method` when available).
   5. `getStats` shape correct + `recentLogs` FIFO cap enforced with small `maxBuffer` (e.g. 5).
   6. `logPath` writes valid JSONL (each line independently `JSON.parse`-able; uses `os.tmpdir()` + `fs.mkdtemp`, cleanup in `after` hook).
4. `packages/sdlc-workflows/mcp-server.js`:
   - Creates a single `MCPErrorTracker` instance at module load.
   - `logPath` resolved from `--error-log <path>` CLI flag **or** `SDLC_MCP_ERROR_LOG` env var (default `null`).
   - Each tool handler wrapped via `tracker.wrap(name, tool.handler)` inside `handleToolCall` (lines 109–141).
   - The top-level `handle()` (line 61) wrapped via `tracker.wrapHandle`.
   - Existing DEBUG logging and typed errors preserved (tracker must not swallow or transform).
5. `packages/mcp/lib/mcp-server.js` `MCPServer`:
   - Constructor accepts `config.errorLogPath` and `config.onCritical`.
   - Creates `this._tracker = new MCPErrorTracker({ logPath: config.errorLogPath, onCritical: config.onCritical })`.
   - `_handleToolCall` (line 315) wraps `tool.handler` via `this._tracker.wrap(...)`.
   - `_handle` (line 267) wraps the message dispatch via `this._tracker.wrapHandle(...)`.
   - Existing JSON-RPC error envelope untouched; wrap re-throws.
6. `errorCounts` correctly accumulates across multiple failures (e.g., 3 calls fail with `-32602` → `getStats().errorCounts === { '-32602': 3 }`).
7. JSONL log file is valid: each line is independently `JSON.parse`-able. One line per event. `timestamp` is ISO 8601.
8. All existing tests continue to pass:
   - `npm test -w @andy-toolforge/core`
   - `npm test -w @andy-toolforge/sdlc-workflows` (34 tests, including new ones)
   - `npm test -w @andy-toolforge/mcp`

---

## File-level changes

### 1. `packages/core/lib/mcp-error-tracker.js` (NEW)

- **Change:** Create new file. Export `class MCPErrorTracker` with the four methods specified in the approved design.
- **Why:** Shared error tracking utility; single source of truth for all MCP servers.
- **Risk:** None (purely additive). Aligns with `packages/core/AGENTS.md` rule: "New core service → add class in `lib/` → export from `lib/index.js`."

**API surface (locked):**

```js
class MCPErrorTracker {
    constructor({ logPath, onCritical, maxBuffer = 1000 } = {}) { /* ... */ }
    wrap(toolName, handler)              // returns async (llm, args) => ...
    wrapHandle(handleFn)                // returns async (msg) => ...
    getStats()                          // { totalCalls, totalErrors, errorCounts, recentLogs }
    reset()                             // clears counters + buffer; does NOT touch log file
}
```

**Log entry shape (locked):**

```js
{ timestamp: '<ISO>', type: 'ok'|'error'|'handle_error', tool, code?, message?, duration? }
```

**Implementation notes:**

- `this._errorCounts` keyed by stringified numeric code (object key safety).
- `this._buffer` is an array; on overflow, `shift()` to enforce FIFO. Cap from `maxBuffer`.
- `this._totalCalls`, `this._totalErrors` plain integer counters.
- `this._logPath` if set → `fs.promises.appendFile(path, line + '\n')` fire-and-forget. Wrap in `.catch(() => {})` to never throw from the logger.
- `onCritical` invoked only when `code === -32000`. Wrapped in try/catch so a buggy hook never breaks the tool call path.

### 2. `packages/core/lib/mcp-error-tracker.test.js` (NEW)

- **Change:** Create new test file with 6 `node:test` cases as enumerated in acceptance criterion #3.
- **Why:** Lock the contract; prevent regressions.
- **Risk:** None.

**Test cases (each becomes a `test('...', async () => { ... })` block):**

1. `wrap` success: pass an async handler returning `'ok'`; assert return value is `'ok'`; assert buffer got `{ type: 'ok', tool: 't', duration: number }`.
2. `wrap` typed error: handler throws `Object.assign(new Error('bad input'), { code: -32602 })`; assert returned promise rejects with same error; assert `getStats().errorCounts['-32602'] === 1`; assert buffer has `error` entry.
3. Fallback to `-32000` + onCritical: handler throws `new Error('boom')`; assert `errorCounts['-32000'] === 1`; assert `onCritical` was called once with `{ tool, code: -32000, message: 'boom', stack }`.
4. `wrapHandle`: wrap a function that throws `new Error('parse fail')`; assert promise rejects; assert buffer has `{ type: 'handle_error', method: 'tools/call', message: 'parse fail' }`.
5. `getStats` shape + FIFO: construct with `maxBuffer: 5`; fire 7 calls; assert `recentLogs.length === 5` and the first one is event #3 (oldest two evicted).
6. `logPath` JSONL: `os.tmpdir() + fs.mkdtempSync('mcpet-')` → use `path.join(dir, 'errs.jsonl')`. After 2 wrapped calls (1 success, 1 fail with `code: -32602`), `fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean)` yields 2 lines, each `JSON.parse`-able, types `'ok'` and `'error'`. Cleanup via `fs.rmSync(dir, { recursive: true, force: true })` in `after`.

### 3. `packages/core/lib/index.js` (MODIFY)

- **Change:** Add `const { MCPErrorTracker } = require('./mcp-error-tracker');` and include it in `module.exports`.
- **Why:** Make the utility importable as `require('@andy-toolforge/core').MCPErrorTracker`.
- **Risk:** Low (additive export; existing 7 exports unchanged).

**Diff (additive only):**

```js
const { MCPErrorTracker } = require('./mcp-error-tracker');
// ...
module.exports = {
    LLMClient,
    ProviderAdapter,
    OpenAIAdapter,
    BrowserManager,
    Logger,
    JobQueue,
    installSkills,
    MCPErrorTracker,   // <-- new
};
```

Note: `packages/core/package.json` has **no** `files` array, so no change is needed there.

### 4. `packages/sdlc-workflows/mcp-server.js` (MODIFY)

- **Change:**
  - Add `const { MCPErrorTracker } = require('@andy-toolforge/core');` (workspace-linked at dev time, published dep at consumer time).
  - Parse `--error-log <path>` from `process.argv` and read `process.env.SDLC_MCP_ERROR_LOG`; resolve in that order. Default `null`.
  - Instantiate `const tracker = new MCPErrorTracker({ logPath });` at module load (after parsing).
  - In `handleToolCall` (lines 109–141): replace direct `tool.handler(null, args)` call with `await tracker.wrap(name, tool.handler)(null, args)`. Wrap with `try` so we can still build the JSON-RPC error envelope (the existing `catch (err)` is preserved unchanged). The tracker re-throws, so the catch block sees the same error it sees today.
  - Wrap the top-level `handle()` (line 61) via `const wrappedHandle = tracker.wrapHandle(handle);` and have stdio dispatch call `wrappedHandle` instead.
  - Keep `--debug` flag and its `console.error` logging behavior untouched.
- **Why:** Add error tracking without changing the wire protocol.
- **Risk:** Medium. Touches the hot path of every tool call. Mitigated by:
  - Wrap re-throws → existing `try/catch` sees the same error it sees today.
  - `err.code` is forwarded unchanged → typed errors (`ToolInputError -32602`, `ToolNotFoundError -32602`, `ToolInternalError -32000`) still surface with their codes.
  - `mcp-server.test.js` must still pass — wrap is transparent to caller's success path.
  - `tracker.wrap` returns a new function; we do **not** mutate `tool.handler` itself (important for tests that introspect `tool.handler`).

### 5. `packages/sdlc-workflows/mcp-server.test.js` (MODIFY — additive only)

- **Change:** Add tests verifying integration:
  - When a tool throws a `ToolInputError` (`-32602`), the tracker counts it and writes a JSONL line (when `logPath` is set in the test).
  - When `handle()` is called with a malformed message that throws, `handle_error` is recorded.
  - `getStats()` is reachable from a module-level reference (expose `tracker` via a small ref, or test through observable side effects only — prefer observable side effects to keep the public surface tight).
- **Why:** Lock the integration contract.
- **Risk:** Low (additive tests; existing 34 tests must continue to pass).

### 6. `packages/mcp/lib/mcp-server.js` (MODIFY)

- **Change:**
  - Add `const { MCPErrorTracker } = require('@andy-toolforge/core');` (this package already depends on core).
  - `MCPServer` constructor reads `config.errorLogPath` and `config.onCritical`. Create `this._tracker = new MCPErrorTracker({ logPath: config.errorLogPath, onCritical: config.onCritical });` once, in the constructor, before tool registration.
  - `_handleToolCall` (line 315): wrap `tool.handler` via `this._tracker.wrap(name, tool.handler)` and `await` the wrapped call inside the existing `try`. The existing `catch` builds the JSON-RPC error envelope unchanged.
  - `_handle` (line 267): wrap the dispatch with `this._tracker.wrapHandle(originalDispatch)` and call the wrapped version.
- **Why:** Same rationale as #4 for the second MCP server.
- **Risk:** Medium. Same mitigation: wrap re-throws; existing JSON-RPC error path unchanged.

### 7. `packages/mcp/lib/mcp-server.test.js` (MODIFY — additive only)

- **Change:** Add tests for the new config options and tracker integration, mirroring #5.
- **Why:** Lock integration contract for the second server.
- **Risk:** Low.

---

## Test plan

1. **Unit tests for `MCPErrorTracker`** (6 cases, `node:test`) — see file-level change #2.
2. **Integration tests — `sdlc-workflows`** (`mcp-server.test.js`):
   - Drive a tool that throws a `ToolInputError`; assert an error line is logged to the JSONL file.
   - Drive a top-level `handle()` that throws on a malformed message; assert a `handle_error` line is logged.
3. **Integration tests — `mcp` package** (`lib/mcp-server.test.js`):
   - Construct `MCPServer` with `errorLogPath: <tmp>` + `onCritical: spy`; trigger a failing tool; assert counts, JSONL, and `onCritical` invocation.
4. **Regression**: run full suite for all three workspaces. The 34 sdlc-workflows tests + existing mcp/core tests must still pass.
5. **Manual smoke (optional, post-impl)**:

   ```bash
   node packages/sdlc-workflows/mcp-server.js --error-log /tmp/errs.jsonl
   # in another shell, pipe a few malformed tools/call requests, then:
   cat /tmp/errs.jsonl | while read -r line; do echo "$line" | python3 -m json.tool; done
   # should produce one valid JSON object per line.
   ```

---

## Out of scope

- Distributed tracing, OpenTelemetry, or any external observability service.
- Per-tool rate limiting, circuit breakers, or retry logic.
- Changing the JSON-RPC error response shape in either server (explicit non-goal per the user).
- Adding the tracker to any other tool beyond the two existing MCP servers.
- New npm dependencies in any package.
- Bumping package versions or publishing (separate concern; needs README update per monorepo policy in `AGENTS.md`).
- Migration of the `mcp` package's CLI key-exit behavior or voice-assistant integration (separate in-flight work tracked elsewhere).
- Adding a "files" array to `packages/core/package.json` (it has none today; the "if one exists" guard evaluates to false).

---

## Open questions

None. Design is fixed and approved per the user framing. Any future expansion (per-tool error budgets, sampling, remote sink, Prometheus exporter, etc.) is explicitly out of scope and should be raised as a separate plan.
