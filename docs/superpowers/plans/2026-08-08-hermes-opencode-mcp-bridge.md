# Hermes ↔ OpenCode MCP Bridge Implementation Plan

## Implementation Status (2026-08-13)

**Package shipped:** `@andy-toolforge/hermes-opencode-mcp-bridge` v0.1.5 — all 5 tools live (opencode_run, opencode_read, opencode_status, opencode_task, opencode_set_models), session management, config file support, tests, README.

**Post-plan features added:**
- v0.1.3 — `isError` flag on tool results
- v0.1.4 — session persistence (conversation_id → opencode session map with idle-timeout cleanup)
- v0.1.5 — `tool_calls` surfaced in results

This document remains the design source of truth; the implementation follows it. Checkboxes below reflect the original plan and are superseded by the shipped package.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@andy-toolforge/hermes-opencode-mcp-bridge` — an MCP server (stdio) that lets Hermes Agent drive the opencode CLI through 5 tools, with session management, config file support, tests, and README.

**Architecture:** Hermes (MCP client) → bridge (this package, NodeJS/CommonJS, official `@modelcontextprotocol/sdk`, StdioServerTransport) → subprocess `opencode run --format json` → opencode CLI. Sessions tracked via a `conversation_id` → opencode session map with idle-timeout cleanup; follow-ups run `--session <id> --fork`.

**Tech Stack:** Node >= 18 (actual v22.23.2), CommonJS (`require`/`module.exports`), `@modelcontextprotocol/sdk` ^1.30.0, `node:test` co-located `lib/*.test.js`, no build step, no linter.

**Design doc:** `docs/superpowers/specs/2026-08-08-hermes-opencode-mcp-bridge-design.md` (approved by user, all sections).

## Global Constraints

- **CommonJS only** — `require()` / `module.exports`, no ESM, no build step (AGENTS.md).
- Package name `@andy-toolforge/hermes-opencode-mcp-bridge`, version `0.1.0`, `"main": "lib/index.js"`, bin `hermes-opencode-bridge: ./lib/index.js`, `engines.node >= 18`, `publishConfig.access: public`, author `Andy Pham`, license MIT (matches sdlc-workflows pattern).
- Root `package.json` workspaces array MUST gain `"packages/hermes-opencode-mcp-bridge"`.
- **Tests: `node:test`, co-located `lib/*.test.js`.** Run via `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge`.
- **NO real opencode CLI in tests** — all `child_process` mocked. Tool modules MUST call `childProcess.spawn(...)` / `childProcess.execFile(...)` via the module object (`const childProcess = require('node:child_process')`) so `mock.method` works — never destructure `{ spawn }` at module top.
- **opencode CLI facts (verified empirically):** run flag is `--dir <dir>` (NOT `--cwd`); `--format json` emits JSONL (one object per line); every event has top-level `sessionID`; file edits appear as `tool_use` events with `part.tool === 'edit'` and `part.state.metadata.filediff = {file, patch, additions, deletions}`; assistant text as `text` events (`part.text`); run ends with `step_finish` `part.reason === 'stop'`; CLI does NOT auto-commit. macOS has no `timeout` command — use Node timers.
- **Config defaults** (`~/.config/hermes-opencode/config.json`): `opencode_bin: '~/.opencode/bin/opencode'`, `default_project_dir: '~/projects'`, `default_agent: 'fixer'`, `default_model: 'opencode/deepseek-v4-flash-free'`, `models: []` (empty = all models allowed), `session_timeout: 300`, `auto_commit: false`, `verbose: false`.
- **Error shape:** every tool returns `{status:'error', error:{code, message}}` on failure. Codes: `CONFIG_ERROR`, `TIMEOUT`, `TASK_ERROR`, `PARSE_ERROR`, `NOT_FOUND`, `PATH_ESCAPE`, `INVALID_ARGS`, `MISSING_CONVERSATION`.
- **Test env isolation:** tests that write config MUST set `process.env.HERMES_OPENCODE_CONFIG` to a tmpdir path and clean up in `t.after`.
- Design doc (`docs/superpowers/specs/2026-08-08-hermes-opencode-mcp-bridge-design.md`) is the source of truth for behavior; this plan implements it fully.

---

### Task 1: Package scaffold + root workspace registration

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/package.json`
- Modify: `package.json` (root — add workspace entry)

**Interfaces:**
- Consumes: nothing.
- Produces: workspace member with `npm test` script usable from root via `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge`.

- [ ] **Step 1: Create the package directory and package.json**

Create `packages/hermes-opencode-mcp-bridge/package.json`:

```json
{
  "name": "@andy-toolforge/hermes-opencode-mcp-bridge",
  "version": "0.1.0",
  "description": "MCP bridge from Hermes Agent to the opencode CLI (code editing, terminal, git, multi-model)",
  "main": "lib/index.js",
  "bin": {
    "hermes-opencode-bridge": "./lib/index.js"
  },
  "files": [
    "lib/",
    "scripts/",
    "README.md"
  ],
  "scripts": {
    "test": "node --test"
  },
  "keywords": [
    "toolforge",
    "hermes",
    "opencode",
    "mcp",
    "bridge",
    "agent"
  ],
  "author": "Andy Pham",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0"
  },
  "engines": {
    "node": ">=18"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Register the workspace in root package.json**

In `/Users/admin/personal/toolforge/package.json`, add `"packages/hermes-opencode-mcp-bridge"` to the `workspaces` array (alphabetical position, after `"packages/genai-tools"`):

```json
  "workspaces": [
    "packages/core",
    "packages/footage-generation",
    "packages/genai-tools",
    "packages/hermes-opencode-mcp-bridge",
    "packages/seo-generation",
    "packages/book-writing",
    "packages/pm-support",
    "packages/ba-support",
    "packages/coding-support",
    "packages/mcp",
    "packages/content-operations",
    "packages/content-research",
    "packages/tts-generator",
    "packages/voice-assistant",
    "packages/vn-stock",
    "packages/llm-gateway",
    "packages/authoring",
    "packages/llm-gateway-core",
    "packages/sdlc-workflows"
  ]
```

- [ ] **Step 3: Install dependencies from root**

Run: `npm install`
Expected: `@modelcontextprotocol/sdk` installed into the workspace; `package-lock.json` updated at root; exit 0. Verify: `node -e "console.log(require('@modelcontextprotocol/sdk/package.json').version)"` prints `1.30.0` (or newer).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json packages/hermes-opencode-mcp-bridge/package.json
git commit -m "feat(hermes-opencode-mcp-bridge): scaffold npm workspace package"
```

---

### Task 2: `lib/config.js` — config load/merge/write

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/config.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/config.test.js`

**Interfaces:**
- Consumes: nothing (node built-ins only).
- Produces: `DEFAULTS` (object), `configPath()` → string, `expandHome(p)` → string, `loadConfig(file?)` → config object (throws `Error` with `.code === 'CONFIG_ERROR'` on bad JSON), `writeConfig(cfg, target?)` → file path written. Later tasks use `loadConfig()` (no arg = env override `HERMES_OPENCODE_CONFIG` or `~/.config/hermes-opencode/config.json`) and `writeConfig(cfg, target?)`.

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/config.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS, loadConfig, writeConfig, expandHome } = require('./config');

function tmpConfig(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-config-'));
  const file = path.join(dir, 'config.json');
  if (body !== null) fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  return file;
}

test('loadConfig returns defaults when file missing', () => {
  const file = tmpConfig(null);
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.default_agent, DEFAULTS.default_agent);
  assert.strictEqual(cfg.default_model, DEFAULTS.default_model);
  assert.deepStrictEqual(cfg.models, []);
  assert.strictEqual(cfg.opencode_bin, path.join(os.homedir(), '.opencode', 'bin', 'opencode'));
});

test('loadConfig merges user config over defaults', () => {
  const file = tmpConfig({ default_agent: 'implementer', session_timeout: 60 });
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.default_agent, 'implementer');
  assert.strictEqual(cfg.session_timeout, 60);
  assert.strictEqual(cfg.default_model, DEFAULTS.default_model);
});

test('loadConfig expands ~ in paths', () => {
  const file = tmpConfig({ opencode_bin: '~/bin/opencode', default_project_dir: '~' });
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.opencode_bin, path.join(os.homedir(), 'bin', 'opencode'));
  assert.strictEqual(cfg.default_project_dir, os.homedir());
});

test('loadConfig throws CONFIG_ERROR on bad JSON', () => {
  const file = tmpConfig('{ not json');
  assert.throws(() => loadConfig(file), (err) => err.code === 'CONFIG_ERROR');
});

test('writeConfig persists config and roundtrips', () => {
  const file = tmpConfig(null);
  const cfg = { ...DEFAULTS, default_agent: 'refactor', models: ['a', 'b'] };
  const written = writeConfig(cfg, file);
  assert.strictEqual(written, file);
  const roundtrip = loadConfig(file);
  assert.strictEqual(roundtrip.default_agent, 'refactor');
  assert.deepStrictEqual(roundtrip.models, ['a', 'b']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/config.test.js`
Expected: FAIL with `Cannot find module './config'` (module doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/config.js`:

```js
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = {
  opencode_bin: '~/.opencode/bin/opencode',
  default_project_dir: '~/projects',
  default_agent: 'fixer',
  default_model: 'opencode/deepseek-v4-flash-free',
  models: [],
  session_timeout: 300,
  auto_commit: false,
  verbose: false,
};

function expandHome(p) {
  if (typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function configPath() {
  return process.env.HERMES_OPENCODE_CONFIG ||
    path.join(os.homedir(), '.config', 'hermes-opencode', 'config.json');
}

function configError(message) {
  const err = new Error(message);
  err.code = 'CONFIG_ERROR';
  return err;
}

function loadConfig(file) {
  const target = file || configPath();
  const cfg = { ...DEFAULTS };
  let raw;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return cfg; // missing config → defaults
    throw configError(`Cannot read config ${target}: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw configError(`Config file ${target} is not valid JSON: ${err.message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw configError(`Config file ${target} must contain a JSON object`);
  }
  Object.assign(cfg, parsed);
  cfg.opencode_bin = expandHome(cfg.opencode_bin);
  cfg.default_project_dir = expandHome(cfg.default_project_dir);
  if (!Array.isArray(cfg.models)) cfg.models = [];
  return cfg;
}

function writeConfig(cfg, target) {
  const file = target || configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const serializable = {
    opencode_bin: cfg.opencode_bin,
    default_project_dir: cfg.default_project_dir,
    default_agent: cfg.default_agent,
    default_model: cfg.default_model,
    models: cfg.models,
    session_timeout: cfg.session_timeout,
    auto_commit: cfg.auto_commit,
    verbose: cfg.verbose,
  };
  fs.writeFileSync(file, JSON.stringify(serializable, null, 2) + '\n');
  return file;
}

module.exports = { DEFAULTS, configPath, expandHome, loadConfig, writeConfig, configError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/config.test.js`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/config.js packages/hermes-opencode-mcp-bridge/lib/config.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): config load/merge/write with defaults"
```

---

### Task 3: `lib/parser.js` — parse `opencode run --format json` output

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/parser.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/parser.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseOpenCodeOutput(stdout)` → `{session_id, files_changed: string[], summary, diff}` (throws `Error` with `.code === 'PARSE_ERROR'` and `.raw` = original stdout when nothing parseable); `MAX_DIFF_BYTES = 200 * 1024`.

**JSON event shape to handle (verified):** top-level `{type, timestamp, sessionID, part}`. `part.type`: `'step-start' | 'tool' | 'text' | 'step-finish'`. For `part.type === 'tool'`: `part.tool === 'edit'`, `part.state.metadata.filediff = {file, patch, additions, deletions}`. For `part.type === 'text'`: `part.text`. Skip non-JSON lines silently. session_id = first event's top-level `sessionID`. Dedupe files_changed preserving order. Cap diff at `MAX_DIFF_BYTES` with `\n... [diff truncated at 200KB]` suffix.

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/parser.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseOpenCodeOutput, MAX_DIFF_BYTES } = require('./parser');

function evt(type, extra = {}) {
  return JSON.stringify({ type, sessionID: 'ses_test123', timestamp: Date.now(), part: { type, ...extra } });
}

test('parses session_id from first event', () => {
  const out = [evt('step_start'), evt('text', { text: 'Done.' })].join('\n');
  const r = parseOpenCodeOutput(out);
  assert.strictEqual(r.session_id, 'ses_test123');
});

test('collects files_changed and diff from edit tool events', () => {
  const edit = evt('tool', {
    tool: 'edit',
    state: {
      status: 'completed',
      metadata: { filediff: { file: '/proj/a.txt', patch: 'Index: a.txt\n@@ -1 +1 @@\n-hello\n+world' } },
    },
  });
  const r = parseOpenCodeOutput(edit);
  assert.deepStrictEqual(r.files_changed, ['/proj/a.txt']);
  assert.match(r.diff, /Index: a.txt/);
});

test('dedupes files_changed', () => {
  const mk = () => evt('tool', {
    tool: 'edit',
    state: { status: 'completed', metadata: { filediff: { file: '/proj/a.txt', patch: 'p' } } },
  });
  const r = parseOpenCodeOutput([mk(), mk()].join('\n'));
  assert.deepStrictEqual(r.files_changed, ['/proj/a.txt']);
});

test('builds summary from text events in order', () => {
  const out = [evt('text', { text: 'First' }), evt('text', { text: 'Second' })].join('\n');
  const r = parseOpenCodeOutput(out);
  assert.strictEqual(r.summary, 'First\nSecond');
});

test('skips non-JSON lines', () => {
  const out = ['not json', evt('step_start'), 'more noise'].join('\n');
  const r = parseOpenCodeOutput(out);
  assert.strictEqual(r.session_id, 'ses_test123');
});

test('throws PARSE_ERROR with raw output when nothing parseable', () => {
  assert.throws(() => parseOpenCodeOutput(''), (err) => err.code === 'PARSE_ERROR' && err.raw === '');
  assert.throws(() => parseOpenCodeOutput('\n\n'), (err) => err.code === 'PARSE_ERROR');
});

test('caps diff at MAX_DIFF_BYTES with truncate marker', () => {
  const big = 'x'.repeat(MAX_DIFF_BYTES + 1000);
  const edit = evt('tool', {
    tool: 'edit',
    state: { status: 'completed', metadata: { filediff: { file: '/p/a', patch: big } } },
  });
  const r = parseOpenCodeOutput(edit);
  assert.ok(r.diff.length <= MAX_DIFF_BYTES + 100);
  assert.match(r.diff, /truncated at 200KB/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/parser.test.js`
Expected: FAIL with `Cannot find module './parser'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/parser.js`:

```js
'use strict';

const MAX_DIFF_BYTES = 200 * 1024; // 200KB

function parseOpenCodeOutput(stdout) {
  const result = {
    session_id: null,
    files_changed: [],
    summary: '',
    diff: '',
  };
  const edits = [];
  const texts = [];
  const lines = String(stdout || '').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let evt;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      continue; // skip non-JSON lines
    }
    if (!evt || typeof evt !== 'object') continue;
    if (!result.session_id && evt.sessionID) result.session_id = evt.sessionID;
    const part = evt.part;
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'tool' && part.tool === 'edit' && part.state) {
      const fd = part.state.metadata && part.state.metadata.filediff;
      if (fd && fd.file) result.files_changed.push(fd.file);
      if (fd && typeof fd.patch === 'string') edits.push(fd.patch);
    } else if (part.type === 'text' && typeof part.text === 'string') {
      texts.push(part.text);
    }
  }

  result.files_changed = [...new Set(result.files_changed)];
  result.summary = texts.join('\n').trim();
  result.diff = edits.join('\n');

  if (result.diff.length > MAX_DIFF_BYTES) {
    result.diff = result.diff.slice(0, MAX_DIFF_BYTES) + '\n... [diff truncated at 200KB]';
  }

  if (!result.session_id && result.summary === '' && result.files_changed.length === 0) {
    const err = new Error('Could not parse opencode output (no session id, text, or file edits found)');
    err.code = 'PARSE_ERROR';
    err.raw = String(stdout || '');
    throw err;
  }

  return result;
}

module.exports = { parseOpenCodeOutput, MAX_DIFF_BYTES };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/parser.test.js`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/parser.js packages/hermes-opencode-mcp-bridge/lib/parser.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): parse opencode --format json output"
```

---

### Task 4: `lib/session.js` — conversation_id ↔ opencode session map

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/session.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/session.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `generateConversationId()` → `'hob-' + 6 chars [a-z0-9]`; `SessionManager` class:
  - `constructor({sessionTimeout = 300, cleanupIntervalMs = 60000})`
  - `create(opencodeSessionId, projectDir)` → conversation_id (string); stores `{opencodeSessionId, projectDir, createdAt, lastUsedAt, activePid: null}`
  - `get(id)` → session object or `null`
  - `touch(id)` — updates `lastUsedAt`
  - `markActive(id, pid)` / `markDone(id)` — set/clear `activePid`
  - `remove(id)` → boolean
  - `sweep()` — delete entries idle > `sessionTimeout*1000` AND `activePid === null`
  - `startCleanup()` / `stopCleanup()` — unref'd interval running `sweep()`

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/session.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { SessionManager, generateConversationId } = require('./session');

test('generateConversationId has hob- prefix + 6 chars', () => {
  for (let i = 0; i < 20; i++) {
    assert.match(generateConversationId(), /^hob-[a-z0-9]{6}$/);
  }
  const ids = new Set(Array.from({ length: 200 }, generateConversationId));
  assert.strictEqual(ids.size, 200);
});

test('create/get roundtrip', () => {
  const sm = new SessionManager();
  const id = sm.create('ses_123', '/tmp/proj');
  const s = sm.get(id);
  assert.strictEqual(s.opencodeSessionId, 'ses_123');
  assert.strictEqual(s.projectDir, '/tmp/proj');
  assert.strictEqual(s.activePid, null);
  assert.strictEqual(sm.get('nope'), null);
});

test('touch updates lastUsedAt', () => {
  const sm = new SessionManager();
  const id = sm.create('ses_123', '/tmp/proj');
  const before = sm.get(id).lastUsedAt;
  sm.touch(id);
  assert.ok(sm.get(id).lastUsedAt >= before);
});

test('sweep removes idle sessions but keeps active ones', () => {
  const sm = new SessionManager({ sessionTimeout: 1 }); // 1s
  const idle = sm.create('ses_a', '/tmp/a');
  const active = sm.create('ses_b', '/tmp/b');
  sm.markActive(active, 9999);
  sm.get(idle).lastUsedAt = Date.now() - 5000;
  sm.sweep();
  assert.strictEqual(sm.get(idle), null);
  assert.ok(sm.get(active));
});

test('sweep keeps recently-used sessions', () => {
  const sm = new SessionManager({ sessionTimeout: 300 });
  const id = sm.create('ses_a', '/tmp/a');
  sm.sweep();
  assert.ok(sm.get(id));
});

test('markDone allows cleanup of previously-active session', () => {
  const sm = new SessionManager({ sessionTimeout: 1 });
  const id = sm.create('ses_a', '/tmp/a');
  sm.markActive(id, 9999);
  sm.markDone(id);
  sm.get(id).lastUsedAt = Date.now() - 5000;
  sm.sweep();
  assert.strictEqual(sm.get(id), null);
});

test('startCleanup installs unref timer, stopCleanup clears it', () => {
  const sm = new SessionManager({ cleanupIntervalMs: 1000 });
  sm.startCleanup();
  assert.ok(sm._timer);
  assert.strictEqual(typeof sm._timer.unref, 'function');
  sm.stopCleanup();
  assert.strictEqual(sm._timer, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/session.test.js`
Expected: FAIL with `Cannot find module './session'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/session.js`:

```js
'use strict';

const crypto = require('node:crypto');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateConversationId() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `hob-${out}`;
}

class SessionManager {
  constructor({ sessionTimeout = 300, cleanupIntervalMs = 60000 } = {}) {
    this.sessions = new Map(); // conversation_id -> session record
    this.sessionTimeout = sessionTimeout;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this._timer = null;
  }

  create(opencodeSessionId, projectDir) {
    const id = generateConversationId();
    const now = Date.now();
    this.sessions.set(id, {
      opencodeSessionId,
      projectDir,
      createdAt: now,
      lastUsedAt: now,
      activePid: null,
    });
    return id;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  touch(id) {
    const s = this.sessions.get(id);
    if (s) s.lastUsedAt = Date.now();
  }

  markActive(id, pid) {
    const s = this.sessions.get(id);
    if (s) s.activePid = pid;
  }

  markDone(id) {
    const s = this.sessions.get(id);
    if (s) s.activePid = null;
  }

  remove(id) {
    return this.sessions.delete(id);
  }

  sweep() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (s.activePid === null && now - s.lastUsedAt > this.sessionTimeout * 1000) {
        this.sessions.delete(id);
      }
    }
  }

  startCleanup() {
    if (this._timer) return;
    this._timer = setInterval(() => this.sweep(), this.cleanupIntervalMs);
    this._timer.unref();
  }

  stopCleanup() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = { SessionManager, generateConversationId };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/session.test.js`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/session.js packages/hermes-opencode-mcp-bridge/lib/session.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): session manager with idle cleanup"
```

---

### Task 5: `lib/tools/opencode-run.js` — run a task in opencode

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-run.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-run.test.js`

**Interfaces:**
- Consumes: `config.loadConfig`, `session.SessionManager`.
- Produces: `opencodeRun({config, sessions, args})` → `Promise<{status:'success', data:{conversation_id, session_id, task, project_dir, files_changed, diff, summary, completed_at}}>` or `{status:'error', error:{code, message}}`.

**Args schema:** `{task: string (required, >=1 char), project_dir: string (optional), model: string (optional), agent: string (optional), conversation_id: string (optional, resumes via `--session <id> --fork`)}`.

**Behavior:** resolve project_dir → config.default_project_dir → `~/projects`; validate model against config.models (if non-empty, model must be included, else `INVALID_ARGS`); determine model (arg > config.default_model); agent (arg > config.default_agent); build args `['run', '--format', 'json', '--dir', projectDir, '--agent', agent, '--model', model, task]`; if conversation_id: look up session, if missing → `MISSING_CONVERSATION` error, else push `--session <s.opencodeSessionId> --fork`. Spawn `opencode_bin` via `childProcess.spawn(bin, args, {cwd: projectDir, stdio: ['ignore','pipe','pipe'], env})`. Parse stdout lines; on spawn error → `TASK_ERROR`; if `--session` mode, `touch()` existing session else `sessions.create(opencodeSessionId, projectDir)` from parsed session_id. Enforce `timeoutMs` (config.session_timeout * 1000): on timeout kill process and return `TIMEOUT`. On success: `markDone`, `sessions.touch`, return parsed result. For `auto_commit` config true: run `git -C <projectDir> add -A && git -C <projectDir> commit -m "feat: auto-commit after opencode run"` via `childProcess.execFile` (best-effort, don't fail on no git repo). **Requires env override for tests:** `HERMES_OPENCODE_NO_RUN=1` skips real spawn (returns canned result) — useful for integration test.

**Mocking note for tests:** use `mock.method(childProcess, 'spawn', ...)`; the module must reference `childProcess.spawn` at call time (require the module object, never destructure).

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-run.test.js`:

```js
'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');
const childProcess = require('node:child_process');
const configMod = require('../config');
const sessionMod = require('../session');

function makeFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.pid = 12345;
  child.kill = () => true;
  return child;
}

function installFakeSpawn(stdoutLines) {
  return mock.method(childProcess, 'spawn', () => {
    const child = makeFakeChild();
    queueMicrotask(() => {
      for (const line of stdoutLines) child.stdout.emit('data', line + '\n');
      child.stdout.emit('end');
      child.emit('close', 0, null);
    });
    return child;
  });
}

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-run-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeEnv(configBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-env-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(configBody || {}));
  const old = process.env.HERMES_OPENCODE_CONFIG;
  process.env.HERMES_OPENCODE_CONFIG = path.join(dir, 'config.json');
  return () => { if (old === undefined) delete process.env.HERMES_OPENCODE_CONFIG; else process.env.HERMES_OPENCODE_CONFIG = old; };
}

test('opencodeRun succeeds and returns parsed output', async () => {
  const restore = fakeEnv({ default_agent: 'fixer' });
  const projectDir = tmpdir();
  const lines = [
    JSON.stringify({ type: 'step_start', sessionID: 'ses_new1', part: { type: 'step-start' } }),
    JSON.stringify({ type: 'tool_use', sessionID: 'ses_new1', part: { type: 'tool', tool: 'edit', state: { status: 'completed', metadata: { filediff: { file: '/a.txt', patch: 'Index: a.txt\n@@ -1 +1 @@\n-old\n+new' } } } } }),
    JSON.stringify({ type: 'text', sessionID: 'ses_new1', part: { type: 'text', text: 'Done' } }),
  ];
  const m = installFakeSpawn(lines);
  const cfg = configMod.loadConfig();
  const sessions = new sessionMod.SessionManager();
  const res = await require('./opencode-run').opencodeRun({ config: cfg, sessions, args: { task: 'hello', project_dir: projectDir } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.session_id, 'ses_new1');
  assert.ok(res.data.conversation_id);
  assert.deepStrictEqual(res.data.files_changed, ['/a.txt']);
  assert.match(res.data.summary, /Done/);
  assert.ok(sessions.get(res.data.conversation_id));
  m.mock.restore();
  restore();
});

test('opencodeRun resumes existing conversation with --session --fork', async () => {
  const restore = fakeEnv({});
  const projectDir = tmpdir();
  const sessions = new sessionMod.SessionManager();
  const cid = sessions.create('ses_old', projectDir);
  let spawnArgs = null;
  mock.method(childProcess, 'spawn', (bin, args) => {
    spawnArgs = args;
    const child = makeFakeChild();
    queueMicrotask(() => {
      child.stdout.emit('data', JSON.stringify({ type: 'step_start', sessionID: 'ses_old', part: { type: 'step-start' } }) + '\n');
      child.stdout.emit('end');
      child.emit('close', 0, null);
    });
    return child;
  });
  const cfg = configMod.loadConfig();
  const res = await require('./opencode-run').opencodeRun({ config: cfg, sessions, args: { task: 'continue', conversation_id: cid } });
  assert.strictEqual(res.status, 'success');
  assert.ok(spawnArgs.includes('--session') && spawnArgs.includes('ses_old') && spawnArgs.includes('--fork'));
});

test('opencodeRun returns MISSING_CONVERSATION for unknown conversation_id', async () => {
  const restore = fakeEnv({});
  const sessions = new sessionMod.SessionManager();
  const cfg = configMod.loadConfig();
  const res = await require('./opencode-run').opencodeRun({ config: cfg, sessions, args: { task: 'x', conversation_id: 'hob-nope' } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'MISSING_CONVERSATION');
  restore();
});

test('opencodeRun rejects model not in config.models', async () => {
  const restore = fakeEnv({ models: ['opencode/model-a'] });
  const cfg = configMod.loadConfig();
  const sessions = new sessionMod.SessionManager();
  const res = await require('./opencode-run').opencodeRun({ config: cfg, sessions, args: { task: 'x', model: 'opencode/model-b' } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'INVALID_ARGS');
  restore();
});

test('opencodeRun returns TIMEOUT when process overruns', async () => {
  const restore = fakeEnv({});
  mock.method(childProcess, 'spawn', () => {
    const child = makeFakeChild();
    child.kill = () => true;
    return child; // never emits close
  });
  const cfg = configMod.loadConfig();
  const sessions = new sessionMod.SessionManager();
  const res = await require('./opencode-run').opencodeRun({ config: cfg, sessions, args: { task: 'slow', project_dir: tmpdir(), timeoutMs: 50 } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'TIMEOUT');
  restore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-run.test.js`
Expected: FAIL with `Cannot find module './opencode-run'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-run.js`:

```js
'use strict';

const childProcess = require('node:child_process');
const { parseOpenCodeOutput } = require('../parser');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

async function opencodeRun({ config, sessions, args, timeoutMs }) {
  const task = typeof args.task === 'string' ? args.task.trim() : '';
  if (!task) return error('INVALID_ARGS', 'task is required');
  if (args.model && Array.isArray(config.models) && config.models.length > 0 && !config.models.includes(args.model)) {
    return error('INVALID_ARGS', `model ${args.model} is not in config.models`);
  }
  const projectDir = args.project_dir || config.default_project_dir || '~/projects';
  const model = args.model || config.default_model;
  const agent = args.agent || config.default_agent;

  let opencodeSessionId = null;
  let existingSession = null;
  if (args.conversation_id) {
    existingSession = sessions.get(args.conversation_id);
    if (!existingSession) return error('MISSING_CONVERSATION', `conversation ${args.conversation_id} not found`);
    opencodeSessionId = existingSession.opencodeSessionId;
  }

  const spawnArgs = ['run', '--format', 'json', '--dir', projectDir, '--agent', agent, '--model', model, task];
  if (opencodeSessionId) spawnArgs.push('--session', opencodeSessionId, '--fork');

  const limitMs = timeoutMs || args.timeoutMs || (config.session_timeout || 300) * 1000;

  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(config.opencode_bin, spawnArgs, { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return resolve(error('TASK_ERROR', `failed to spawn opencode: ${err.message}`));
    }
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch { /* noop */ }
      resolve(error('TIMEOUT', `opencode run exceeded ${limitMs}ms timeout`));
    }, limitMs);
    timer.unref();

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(error('TASK_ERROR', `opencode spawn error: ${err.message}`));
    });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const parsed = parseOpenCodeOutput(stdout);
        let conversation_id = args.conversation_id;
        if (existingSession) {
          existingSession.projectDir = projectDir;
          sessions.touch(conversation_id);
        } else {
          conversation_id = sessions.create(parsed.session_id, projectDir);
        }
        sessions.markDone(conversation_id);
        if (config.auto_commit) {
          try {
            childProcess.execFile('git', ['-C', projectDir, 'add', '-A']);
            childProcess.execFile('git', ['-C', projectDir, 'commit', '-m', 'feat: auto-commit after opencode run']);
          } catch { /* best-effort */ }
        }
        resolve({
          status: 'success',
          data: {
            conversation_id,
            session_id: parsed.session_id,
            task,
            project_dir: projectDir,
            files_changed: parsed.files_changed,
            diff: parsed.diff,
            summary: parsed.summary,
            completed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        resolve(error('PARSE_ERROR', `failed to parse opencode output: ${err.message}${stderr ? `\nstderr: ${stderr}` : ''}`));
      }
    });
  });
}

module.exports = { opencodeRun };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-run.test.js`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/tools/opencode-run.js packages/hermes-opencode-mcp-bridge/lib/tools/opencode-run.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): opencode_run tool with sessions and timeout"
```

---

### Task 6: `lib/tools/opencode-read.js` — read files and tree

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-read.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-read.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `opencodeRead({config, args})` → `{status:'success', data:{path, content?, entries?, depth, is_dir, size?}}` or error. Works on real FS (tests use real tmpdir files — no child_process needed).

**Args schema:** `{path: string (required), depth: number (optional, default 2, used only for dirs), max_lines: number (optional, default 500, only for files)}`.

**Behavior:** resolve `path` (absolute or `~`-expanded); if not absolute, join with `process.cwd()`. If isDirectory: readdir with `{withFileTypes:true}`, return `entries: [{name, type: 'file'|'dir'|'symlink'|'other'}]` up to depth levels (recursive, `depth-1` children); cap total entries at 1000. If isFile: read utf8, slice to `max_lines` lines, append `\n... [truncated at N lines]` if longer; include `size` bytes. Missing → `NOT_FOUND`. Non-existent parent → `NOT_FOUND`.

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-read.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { opencodeRead } = require('./opencode-read');

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-read-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('reads a file with content and size', async () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\n');
  const res = await opencodeRead({ args: { path: path.join(dir, 'a.txt') } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.content, 'line1\nline2');
  assert.strictEqual(res.data.size, 12);
  assert.strictEqual(res.data.is_dir, false);
});

test('truncates long files at max_lines', async () => {
  const dir = tmpdir();
  const content = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
  fs.writeFileSync(path.join(dir, 'long.txt'), content);
  const res = await opencodeRead({ args: { path: path.join(dir, 'long.txt'), max_lines: 5 } });
  assert.strictEqual(res.data.content.split('\n').filter(Boolean).length, 5);
  assert.match(res.data.content, /truncated at 5 lines/);
});

test('lists directory entries shallow by default', async () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
  const res = await opencodeRead({ args: { path: dir, depth: 1 } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.is_dir, true);
  const names = res.data.entries.map((e) => e.name).sort();
  assert.deepStrictEqual(names, ['f.txt', 'sub']);
});

test('lists nested entries up to depth', async () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'a', 'b', 'deep.txt'), 'x');
  const res = await opencodeRead({ args: { path: dir, depth: 2 } });
  const names = res.data.entries.map((e) => e.name);
  assert.ok(names.includes('deep.txt'));
});

test('expands ~ in path', async () => {
  const res = await opencodeRead({ args: { path: '~' } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.is_dir, true);
});

test('returns NOT_FOUND for missing path', async () => {
  const res = await opencodeRead({ args: { path: path.join(os.tmpdir(), 'definitely-missing-file-xyz') } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'NOT_FOUND');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-read.test.js`
Expected: FAIL with `Cannot find module './opencode-read'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-read.js`:

```js
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

function expandHome(p) {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function listRecursive(dir, depth, out, limit) {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= limit) return;
    const full = path.join(dir, e.name);
    let type = 'other';
    if (e.isFile()) type = 'file';
    else if (e.isDirectory()) type = 'dir';
    else if (e.isSymbolicLink()) type = 'symlink';
    out.push({ name: path.basename(full), type, path: full });
    if (type === 'dir' && depth > 1) listRecursive(full, depth - 1, out, limit);
  }
}

async function opencodeRead({ args }) {
  const target = typeof args.path === 'string' ? args.path.trim() : '';
  if (!target) return error('INVALID_ARGS', 'path is required');
  const expanded = expandHome(target);
  const resolved = path.isAbsolute(expanded) ? expanded : path.join(process.cwd(), expanded);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return error('NOT_FOUND', `path not found: ${resolved}`);
  }

  if (stat.isDirectory()) {
    const depth = Number.isInteger(args.depth) && args.depth > 0 ? args.depth : 2;
    const entries = [];
    listRecursive(resolved, depth, entries, 1000);
    return { status: 'success', data: { path: resolved, is_dir: true, depth, entries, entry_count: entries.length } };
  }

  if (stat.isFile()) {
    let content = fs.readFileSync(resolved, 'utf8');
    const maxLines = Number.isInteger(args.max_lines) && args.max_lines > 0 ? args.max_lines : 500;
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      content = lines.slice(0, maxLines).join('\n') + `\n... [truncated at ${maxLines} lines]`;
    }
    return { status: 'success', data: { path: resolved, is_dir: false, content, size: stat.size } };
  }

  return error('INVALID_ARGS', `path is neither a file nor a directory: ${resolved}`);
}

module.exports = { opencodeRead };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-read.test.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/tools/opencode-read.js packages/hermes-opencode-mcp-bridge/lib/tools/opencode-read.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): opencode_read tool (files and trees)"
```

---

### Task 7: `lib/tools/opencode-status.js` — current working state

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-status.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-status.test.js`

**Interfaces:**
- Consumes: `config.loadConfig`.
- Produces: `opencodeStatus({config, args})` → `{status:'success', data:{project_dir, status: 'clean'|'dirty'|'untracked', changed_files: [{path, status: 'M'|'A'|'D'|'?'|'R'|'C'}], tracked_changes: number, untracked_files: number, branch}}` or error. Uses `childProcess.execFile('git', ['-C', projectDir, 'status', '--porcelain=v1', '-b'], cb)`; then `git rev-parse --abbrev-ref HEAD` if needed.

**Args schema:** `{project_dir: string (optional, defaults config.default_project_dir)}`.

**Behavior:** projectDir = args.project_dir || config.default_project_dir. Run git status porcelain. Parse each line: first 2 chars status code (e.g. ` M`→M, `??`→untracked, `A `→A, ` D`→D), path after. `status` summary: if no lines → 'clean'; if any `??` → 'untracked'; else 'dirty'. branch from `## branch` header line (strip `...` suffix). Non-git dir → `TASK_ERROR` with message `not a git repository`.

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-status.test.js`:

```js
'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-status-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeGit(stdout, cbError = null) {
  mock.method(childProcess, 'execFile', (bin, args, opts, cb) => {
    if (args[0] === 'status') return cb(cbError, stdout, '');
    if (args[0] === 'rev-parse') return cb(null, 'main\n', '');
    return cb(new Error('unexpected git args'));
  });
}

test('returns clean status with branch', async () => {
  const dir = tmpdir();
  fakeGit('## main\n');
  const res = await require('./opencode-status').opencodeStatus({ args: { project_dir: dir } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.branch, 'main');
  assert.strictEqual(res.data.status, 'clean');
  assert.deepStrictEqual(res.data.changed_files, []);
});

test('parses modified and untracked files', async () => {
  const dir = tmpdir();
  fakeGit('## feature/x\n M src/a.js\n?? new.js\nA  added.js\n');
  const res = await require('./opencode-status').opencodeStatus({ args: { project_dir: dir } });
  assert.strictEqual(res.data.status, 'untracked');
  assert.strictEqual(res.data.branch, 'feature/x');
  assert.strictEqual(res.data.tracked_changes, 2);
  assert.strictEqual(res.data.untracked_files, 1);
  const byPath = Object.fromEntries(res.data.changed_files.map((f) => [f.path, f.status]));
  assert.strictEqual(byPath['src/a.js'], 'M');
  assert.strictEqual(byPath['new.js'], '?');
  assert.strictEqual(byPath['added.js'], 'A');
});

test('returns dirty when tracked changes but no untracked', async () => {
  const dir = tmpdir();
  fakeGit('## main\n M a.js\n');
  const res = await require('./opencode-status').opencodeStatus({ args: { project_dir: dir } });
  assert.strictEqual(res.data.status, 'dirty');
});

test('returns TASK_ERROR for non-git directory', async () => {
  const dir = tmpdir();
  fakeGit('', new Error('not a git repository'));
  const res = await require('./opencode-status').opencodeStatus({ args: { project_dir: dir } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'TASK_ERROR');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-status.test.js`
Expected: FAIL with `Cannot find module './opencode-status'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-status.js`:

```js
'use strict';

const childProcess = require('node:child_process');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

function runGit(projectDir, args) {
  return new Promise((resolve) => {
    childProcess.execFile('git', ['-C', projectDir, ...args], (err, stdout) => {
      resolve({ err, stdout: String(stdout) });
    });
  });
}

async function opencodeStatus({ config, args }) {
  const projectDir = (args && args.project_dir) || (config && config.default_project_dir) || process.cwd();
  const { err, stdout } = await runGit(projectDir, ['status', '--porcelain=v1', '-b']);
  if (err) return error('TASK_ERROR', `git status failed for ${projectDir}: ${err.message}`);

  const lines = stdout.split('\n').filter((l) => l.trim() !== '');
  const changed = [];
  let branch = null;
  for (const line of lines) {
    if (line.startsWith('##')) {
      branch = line.replace(/^##\s*/, '').split('...')[0].trim();
      continue;
    }
    const status = line.slice(0, 2);
    const filePath = line.slice(3).trim();
    let code;
    if (status.includes('?')) code = '?';
    else if (status.includes('M')) code = 'M';
    else if (status.includes('A')) code = 'A';
    else if (status.includes('D')) code = 'D';
    else if (status.includes('R')) code = 'R';
    else if (status.includes('C')) code = 'C';
    else code = status.trim() || 'M';
    changed.push({ path: filePath, status: code });
  }

  const untracked = changed.filter((f) => f.status === '?').length;
  const tracked = changed.length - untracked;
  let overall;
  if (changed.length === 0) overall = 'clean';
  else if (untracked > 0) overall = 'untracked';
  else overall = 'dirty';

  return {
    status: 'success',
    data: {
      project_dir: projectDir,
      status: overall,
      changed_files: changed,
      tracked_changes: tracked,
      untracked_files: untracked,
      branch,
    },
  };
}

module.exports = { opencodeStatus };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-status.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/tools/opencode-status.js packages/hermes-opencode-mcp-bridge/lib/tools/opencode-status.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): opencode_status tool (git working state)"
```

---

### Task 8: `lib/tools/opencode-set-models.js` — manage allowed models

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-set-models.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-set-models.test.js`

**Interfaces:**
- Consumes: `config.loadConfig`, `config.writeConfig`.
- Produces: `opencodeSetModels({config, args})` → `{status:'success', data:{models}}` or error. Persists via `writeConfig`.

**Args schema:** `{models: string[] (optional), action: 'set'|'add'|'remove'|'list' (optional, default 'set')}`.
- `set` → replace list with `models` (required).
- `add` → append unique entries from `models`.
- `remove` → drop entries in `models` from the list.
- `list` → return current config.models (no write).
Invalid action → `INVALID_ARGS`. `models` not array → `INVALID_ARGS`.

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-set-models.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const configMod = require('../config');
const { opencodeSetModels } = require('./opencode-set-models');

function fakeEnv(t, body = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-models-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(body));
  const old = process.env.HERMES_OPENCODE_CONFIG;
  process.env.HERMES_OPENCODE_CONFIG = file;
  t.after(() => {
    if (old === undefined) delete process.env.HERMES_OPENCODE_CONFIG;
    else process.env.HERMES_OPENCODE_CONFIG = old;
  });
  return file;
}

test('list returns current models', async (t) => {
  fakeEnv(t, { models: ['opencode/a', 'opencode/b'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'list' } });
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(res.data.models, ['opencode/a', 'opencode/b']);
});

test('set replaces models and persists', async (t) => {
  const file = fakeEnv(t, { models: ['opencode/a'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'set', models: ['opencode/c'] } });
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(res.data.models, ['opencode/c']);
  const reloaded = configMod.loadConfig(file);
  assert.deepStrictEqual(reloaded.models, ['opencode/c']);
});

test('add appends unique models', async (t) => {
  fakeEnv(t, { models: ['opencode/a'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'add', models: ['opencode/b', 'opencode/a'] } });
  assert.deepStrictEqual(res.data.models, ['opencode/a', 'opencode/b']);
});

test('remove drops models', async (t) => {
  fakeEnv(t, { models: ['opencode/a', 'opencode/b'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'remove', models: ['opencode/a'] } });
  assert.deepStrictEqual(res.data.models, ['opencode/b']);
});

test('set without models is INVALID_ARGS', async (t) => {
  fakeEnv(t, {});
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'set' } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'INVALID_ARGS');
});

test('unknown action is INVALID_ARGS', async (t) => {
  fakeEnv(t, {});
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'explode' } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'INVALID_ARGS');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-set-models.test.js`
Expected: FAIL with `Cannot find module './opencode-set-models'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/tools/opencode-set-models.js`:

```js
'use strict';

const { writeConfig } = require('../config');

function error(code, message) {
  return { status: 'error', error: { code, message } };
}

async function opencodeSetModels({ config, args }) {
  const action = args.action || 'set';
  const valid = ['set', 'add', 'remove', 'list'];
  if (!valid.includes(action)) return error('INVALID_ARGS', `action must be one of: ${valid.join(', ')}`);
  if (action !== 'list' && !Array.isArray(args.models)) {
    return error('INVALID_ARGS', 'models must be an array');
  }

  if (action === 'list') {
    return { status: 'success', data: { models: config.models } };
  }

  const incoming = (args.models || []).filter((m) => typeof m === 'string');
  let models;
  if (action === 'set') {
    models = incoming;
  } else if (action === 'add') {
    models = [...config.models];
    for (const m of incoming) if (!models.includes(m)) models.push(m);
  } else if (action === 'remove') {
    models = config.models.filter((m) => !incoming.includes(m));
  }

  writeConfig({ ...config, models }, undefined);
  return { status: 'success', data: { models } };
}

module.exports = { opencodeSetModels };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/tools/opencode-set-models.test.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/tools/opencode-set-models.js packages/hermes-opencode-mcp-bridge/lib/tools/opencode-set-models.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): opencode_set_models tool"
```

---

### Task 9: `lib/server.js` + `lib/index.js` — MCP server + entrypoint

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/server.js`
- Create: `packages/hermes-opencode-mcp-bridge/lib/index.js`
- Test: `packages/hermes-opencode-mcp-bridge/lib/server.test.js`

**Interfaces:**
- Consumes: `@modelcontextprotocol/sdk/server/mcp.js` (`McpServer`), `@modelcontextprotocol/sdk/server/stdio.js` (`StdioServerTransport`), `@modelcontextprotocol/sdk/server/index.js` (`Server` types as needed), `config`, `session`, all tool modules.
- Produces: `createServer({config?, sessions?})` → configured `McpServer` with 5 tools registered; `startServer({config?, sessions?})` → async, starts cleanup timer + connects stdio transport; `lib/index.js` entrypoint that calls `startServer()` and exposes `{createServer, startServer}`.

**Tool registrations (SDK v1.30):** `server.registerTool(name, {title, description, inputSchema}, handler)`:
- `opencode_run` — `{task: {type:'string'}, project_dir:{type:'string'}, model:{type:'string'}, agent:{type:'string'}, conversation_id:{type:'string'}}`, handler maps to `opencodeRun` with `{config, sessions, args}` and unwraps `{status, data}` / `{status, error}`.
- `opencode_read` — `{path:{type:'string'}, depth:{type:'number'}, max_lines:{type:'number'}}` → `opencodeRead`.
- `opencode_status` — `{project_dir:{type:'string'}}` → `opencodeStatus`.
- `opencode_set_models` — `{models:{type:'array', items:{type:'string'}}, action:{type:'string'}}` → `opencodeSetModels`.
- `opencode_task` — per design doc: `{task:{type:'string'}, project_dir, model, agent, conversation_id}` → `opencodeRun` with `auto_commit` forced true.

**Handler error policy:** each handler returns the tool's result object directly. The SDK serializes it. Any thrown error becomes `{status:'error', error:{code:'TASK_ERROR', message}}` via try/catch wrapper.

**`lib/index.js`:** `const { createServer, startServer } = require('./server'); const handlers = require('./tools'); module.exports = { createServer, startServer, ...handlers };` plus, when run directly (`require.main === module`), `startServer().then(...)`.

- [ ] **Step 1: Write the failing test**

Create `packages/hermes-opencode-mcp-bridge/lib/server.test.js`:

```js
'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { createServer, startServer } = require('./server');

test('createServer registers 5 tools', () => {
  const srv = createServer();
  const names = Object.keys(srv._tools);
  assert.deepStrictEqual(names.sort(), ['opencode_read', 'opencode_run', 'opencode_set_models', 'opencode_status', 'opencode_task']);
});

test('createServer throws on bad tool name', () => {
  assert.throws(() => createServer({ tools: ['opencode_bogus'] }), /unknown tool/i);
});

test('createServer registers only requested tools', () => {
  const srv = createServer({ tools: ['opencode_run'] });
  assert.deepStrictEqual(Object.keys(srv._tools), ['opencode_run']);
});
```

Note: the test asserts the internal `_tools` map keyed by tool name — this works because `McpServer.registerTool` stores tools on `this._tools[name]`. If the SDK internal changes, adjust the assertion to match (check `server._toolDefinitions` or similar).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/server.test.js`
Expected: FAIL with `Cannot find module './server'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/hermes-opencode-mcp-bridge/lib/server.js`:

```js
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { loadConfig } = require('./config');
const { SessionManager } = require('./session');
const { opencodeRun } = require('./tools/opencode-run');
const { opencodeRead } = require('./tools/opencode-read');
const { opencodeStatus } = require('./tools/opencode-status');
const { opencodeSetModels } = require('./tools/opencode-set-models');

function wrap(toolFn) {
  return async (args) => {
    try {
      return await toolFn(args);
    } catch (err) {
      return { status: 'error', error: { code: 'TASK_ERROR', message: err.message } };
    }
  };
}

function createServer({ config, sessions, tools } = {}) {
  const cfg = config || loadConfig();
  const sms = sessions || new SessionManager();
  const KNOWN_TOOLS = ['opencode_run', 'opencode_read', 'opencode_status', 'opencode_set_models', 'opencode_task'];
  if (tools) {
    for (const name of tools) {
      if (!KNOWN_TOOLS.includes(name)) throw new Error(`unknown tool: ${name}`);
    }
  }
  const enabled = tools ? new Set(tools) : null;
  const server = new McpServer({ name: 'hermes-opencode-bridge', version: '0.1.0' });

  if (!enabled || enabled.has('opencode_run')) {
    server.registerTool(
      'opencode_run',
      {
        title: 'Run task in opencode',
        description: 'Run a task in an opencode session. Use conversation_id to continue a previous session.',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The task to run' },
            project_dir: { type: 'string', description: 'Project directory' },
            model: { type: 'string', description: 'Model id' },
            agent: { type: 'string', description: 'Agent name' },
            conversation_id: { type: 'string', description: 'Conversation to continue' },
          },
          required: ['task'],
        },
      },
      wrap((args) => opencodeRun({ config: cfg, sessions: sms, args }))
    );
  }

  if (!enabled || enabled.has('opencode_read')) {
    server.registerTool(
      'opencode_read',
      {
        title: 'Read files or tree',
        description: 'Read a file or list a directory tree.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to file or directory' },
            depth: { type: 'number', description: 'Directory recursion depth (default 2)' },
            max_lines: { type: 'number', description: 'Max lines for files (default 500)' },
          },
          required: ['path'],
        },
      },
      wrap((args) => opencodeRead({ config: cfg, args }))
    );
  }

  if (!enabled || enabled.has('opencode_status')) {
    server.registerTool(
      'opencode_status',
      {
        title: 'Git working state',
        description: 'Get git status of a project directory.',
        inputSchema: {
          type: 'object',
          properties: {
            project_dir: { type: 'string', description: 'Project directory' },
          },
        },
      },
      wrap((args) => opencodeStatus({ config: cfg, args }))
    );
  }

  if (!enabled || enabled.has('opencode_set_models')) {
    server.registerTool(
      'opencode_set_models',
      {
        title: 'Manage allowed models',
        description: 'Set, add, remove, or list allowed models.',
        inputSchema: {
          type: 'object',
          properties: {
            models: { type: 'array', items: { type: 'string' }, description: 'Model ids' },
            action: { type: 'string', enum: ['set', 'add', 'remove', 'list'], description: 'Action' },
          },
        },
      },
      wrap((args) => opencodeSetModels({ config: cfg, args }))
    );
  }

  if (!enabled || enabled.has('opencode_task')) {
    server.registerTool(
      'opencode_task',
      {
        title: 'Run task with auto-commit',
        description: 'Run a task and auto-commit changes afterward.',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The task to run' },
            project_dir: { type: 'string', description: 'Project directory' },
            model: { type: 'string', description: 'Model id' },
            agent: { type: 'string', description: 'Agent name' },
            conversation_id: { type: 'string', description: 'Conversation to continue' },
          },
          required: ['task'],
        },
      },
      wrap((args) => opencodeRun({ config: { ...cfg, auto_commit: true }, sessions: sms, args }))
    );
  }

  return server;
}

async function startServer(opts = {}) {
  const cfg = opts.config || loadConfig();
  const sms = opts.sessions || new SessionManager();
  const server = createServer({ config: cfg, sessions: sms, tools: opts.tools });
  sms.startCleanup();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

module.exports = { createServer, startServer };
```

Create `packages/hermes-opencode-mcp-bridge/lib/index.js`:

```js
'use strict';

const { createServer, startServer } = require('./server');

module.exports = { createServer, startServer };

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[hermes-opencode-bridge] fatal:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/server.test.js`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Manual smoke check (optional but recommended)**

Run: `node -e "const {createServer}=require('./lib/index'); const s=createServer(); console.log(Object.keys(s._tools))"`
Expected: prints the 5 tool names.

- [ ] **Step 6: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/server.js packages/hermes-opencode-mcp-bridge/lib/index.js packages/hermes-opencode-mcp-bridge/lib/server.test.js
git commit -m "feat(hermes-opencode-mcp-bridge): MCP server with 5 tools and stdio entrypoint"
```

---

### Task 10: Integration test — `lib/integration.test.js` (mocked CLI, real server)

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/lib/integration.test.js`

**Interfaces:**
- Consumes: `createServer` from `./server`, `config`, `session`, mocked `child_process`.
- Produces: end-to-end proof that the 5 tools are callable through the registered handlers with realistic mock opencode CLI output, without spawning a real CLI.

- [ ] **Step 1: Write the integration test**

Create `packages/hermes-opencode-mcp-bridge/lib/integration.test.js`:

```js
'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');
const childProcess = require('node:child_process');
const { createServer } = require('./server');
const { loadConfig } = require('./config');
const { SessionManager } = require('./session');

function makeFakeChild(stdoutLines, delay = 0) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.pid = 4242;
  child.kill = () => true;
  queueMicrotask(() => {
    setTimeout(() => {
      for (const line of stdoutLines) child.stdout.emit('data', line + '\n');
      child.stdout.emit('end');
      child.emit('close', 0, null);
    }, delay);
  });
  return child;
}

function realOpenCodeStdout(sessionId) {
  return [
    JSON.stringify({ type: 'step-start', sessionID: sessionId, part: { type: 'step-start' } }),
    JSON.stringify({ type: 'tool_use', sessionID: sessionId, part: { type: 'tool', tool: 'edit', state: { status: 'completed', metadata: { filediff: { file: '/tmp/proj/hello.js', patch: 'Index: hello.js\n@@ -1 +1 @@\n-console.log(\"a\")\n+console.log(\"b\")' } } } } }),
    JSON.stringify({ type: 'text', sessionID: sessionId, part: { type: 'text', text: 'Edited hello.js' } }),
  ];
}

function fakeEnv(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-int-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    default_project_dir: '/tmp/proj',
    default_agent: 'fixer',
    default_model: 'opencode/deepseek-v4-flash-free',
    session_timeout: 60,
  }));
  const old = process.env.HERMES_OPENCODE_CONFIG;
  process.env.HERMES_OPENCODE_CONFIG = path.join(dir, 'config.json');
  t.after(() => {
    if (old === undefined) delete process.env.HERMES_OPENCODE_CONFIG;
    else process.env.HERMES_OPENCODE_CONFIG = old;
  });
}

test('integration: opencode_run handler returns success shape', async (t) => {
  fakeEnv(t);
  mock.method(childProcess, 'spawn', (bin, args) => {
    assert.ok(args.includes('--dir'));
    assert.ok(args.includes('--agent'));
    assert.ok(args.includes('--model'));
    return makeFakeChild(realOpenCodeStdout('ses_int1'));
  });
  const cfg = loadConfig();
  const sessions = new SessionManager();
  const server = createServer({ config: cfg, sessions });
  const handler = server._tools.opencode_run;
  const res = await handler.call(server, { task: 'do the thing', project_dir: '/tmp/proj' });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.session_id, 'ses_int1');
  assert.deepStrictEqual(res.data.files_changed, ['/tmp/proj/hello.js']);
  assert.match(res.data.diff, /Index: hello.js/);
  assert.match(res.data.summary, /Edited hello.js/);
  assert.ok(res.data.conversation_id);
  assert.ok(sessions.get(res.data.conversation_id));
});

test('integration: opencode_run resume via conversation_id', async (t) => {
  fakeEnv(t);
  const sessions = new SessionManager();
  const cid = sessions.create('ses_int2', '/tmp/proj');
  mock.method(childProcess, 'spawn', (bin, args) => {
    assert.ok(args.includes('--session'));
    assert.ok(args.includes('ses_int2'));
    assert.ok(args.includes('--fork'));
    return makeFakeChild(realOpenCodeStdout('ses_int2'));
  });
  const cfg = loadConfig();
  const server = createServer({ config: cfg, sessions });
  const res = await server._tools.opencode_run.call(server, { task: 'continue', conversation_id: cid });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.conversation_id, cid);
});

test('integration: opencode_read works without child_process', async (t) => {
  fakeEnv(t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-int-read-'));
  fs.writeFileSync(path.join(dir, 'x.txt'), 'hi\n');
  const server = createServer({});
  const res = await server._tools.opencode_read.call(server, { path: path.join(dir, 'x.txt') });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.content, 'hi');
});

test('integration: opencode_status uses mocked git', async (t) => {
  fakeEnv(t);
  mock.method(childProcess, 'execFile', (bin, args, opts, cb) => {
    if (args[0] === 'status') return cb(null, '## main\n M a.js\n', '');
    if (args[0] === 'rev-parse') return cb(null, 'main\n', '');
    return cb(new Error('unexpected'));
  });
  const server = createServer({});
  const res = await server._tools.opencode_status.call(server, { project_dir: '/tmp/proj' });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.status, 'dirty');
});

test('integration: opencode_set_models set persists', async (t) => {
  fakeEnv(t);
  const server = createServer({});
  const res = await server._tools.opencode_set_models.call(server, { action: 'set', models: ['opencode/z'] });
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(res.data.models, ['opencode/z']);
});

test('integration: opencode_task forces auto_commit', async (t) => {
  fakeEnv(t);
  mock.method(childProcess, 'spawn', (bin, args) => makeFakeChild(realOpenCodeStdout('ses_int3')));
  const server = createServer({});
  const res = await server._tools.opencode_task.call(server, { task: 'edit', project_dir: '/tmp/proj' });
  assert.strictEqual(res.status, 'success');
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge -- lib/integration.test.js`
Expected: PASS — all 6 integration tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/lib/integration.test.js
git commit -m "test(hermes-opencode-mcp-bridge): integration tests over the MCP server"
```

---

### Task 11: README, package AGENTS.md, and smoke test

**Files:**
- Create: `packages/hermes-opencode-mcp-bridge/README.md`
- Create: `packages/hermes-opencode-mcp-bridge/AGENTS.md`
- Create: `packages/hermes-opencode-mcp-bridge/scripts/smoke.mjs` (optional manual smoke; ESM OK for a standalone script)

**Interfaces:**
- Consumes: nothing beyond the package itself.
- Produces: usage documentation for Hermes Agent (config file location, tools, examples), domain AGENTS.md context, and a smoke script that boots the server and calls `opencode_run` against a real local project if the user opts in.

- [ ] **Step 1: Write README.md**

Create `packages/hermes-opencode-mcp-bridge/README.md`:

```markdown
# @andy-toolforge/hermes-opencode-mcp-bridge

MCP bridge from Hermes Agent to the [opencode](https://opencode.ai) CLI.

Lets Hermes run coding tasks in a local opencode session, read files, check git
status, and manage the allowed-model list — through standard MCP tools.

## Requirements

- Node.js >= 18 (CommonJS)
- The `opencode` CLI installed (default `~/.opencode/bin/opencode`)

## Install

```bash
npm install @andy-toolforge/hermes-opencode-mcp-bridge
```

Run the stdio server (this is what your MCP client spawns):

```bash
npx hermes-opencode-bridge
```

## Configuration

Config file: `~/.config/hermes-opencode/config.json` (override with env var
`HERMES_OPENCODE_CONFIG`). All keys optional:

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

- `models`: if non-empty, `opencode_run` only allows models in this list.
- `session_timeout`: seconds of idle before a conversation is forgotten.
- `auto_commit`: run `git add -A && git commit` after each successful run.

## Tools

| Tool | Purpose |
|------|---------|
| `opencode_run` | Run a task in opencode; pass `conversation_id` to continue a session |
| `opencode_task` | Like `opencode_run` but always auto-commits |
| `opencode_read` | Read a file or list a directory tree |
| `opencode_status` | Git status of a project directory |
| `opencode_set_models` | Set/add/remove/list allowed models |

## Example

1. Hermes asks opencode to fix a bug:

   `opencode_run({task: "fix the login bug in src/auth.js", project_dir: "~/projects/app"})`

2. Hermes checks the result and reads the changed file:

   `opencode_read({path: "~/projects/app/src/auth.js"})`

3. Hermes continues the same session:

   `opencode_run({task: "also add tests for the fix", conversation_id: "hob-abc123"})`

## Sessions

Each `opencode_run` returns a `conversation_id`. Passing it back continues that
opencode session via `--session <id> --fork`. Idle sessions are swept after
`session_timeout` seconds.

## License

MIT
```

- [ ] **Step 2: Write package AGENTS.md**

Create `packages/hermes-opencode-mcp-bridge/AGENTS.md`:

```markdown
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
```

- [ ] **Step 3: Write smoke script (manual, optional)**

Create `packages/hermes-opencode-mcp-bridge/scripts/smoke.mjs`:

```js
// Manual smoke test: boots the bridge and calls opencode_run against a real
// local project. Opt-in — requires the opencode CLI on PATH.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createServer } = require('../lib/index.js');

const projectDir = process.argv[2] || process.cwd();
const server = createServer();
const res = await server._tools.opencode_run.call(server, {
  task: 'Run `node -e "console.log(1+1)"` and report the result.',
  project_dir: projectDir,
});
console.log(JSON.stringify(res, null, 2));
```

- [ ] **Step 4: Commit**

```bash
git add packages/hermes-opencode-mcp-bridge/README.md packages/hermes-opencode-mcp-bridge/AGENTS.md packages/hermes-opencode-mcp-bridge/scripts/smoke.mjs
git commit -m "docs(hermes-opencode-mcp-bridge): README, AGENTS, and smoke script"
```

---

### Task 12: Final verification pass

**Files:** read-only — no new code.

- [ ] **Step 1: Full test run**

Run: `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge`
Expected: ALL tests green (config 5, parser 7, session 7, opencode-run 5, opencode-read 6, opencode-status 4, set-models 6, server 3, integration 6 = 49 tests).

- [ ] **Step 2: Whole-workspace test run (regression check)**

Run: `npm test --workspaces`
Expected: no failures introduced in other packages by the workspace change. If another package fails, it must be pre-existing — confirm with `git stash` before/after if ambiguous.

- [ ] **Step 3: Verify no domain/code leakage**

Check `packages/hermes-opencode-mcp-bridge/` contains ONLY: `package.json`, `lib/` (config, session, parser, server, index, tools/, *.test.js), `scripts/smoke.mjs`, `README.md`, `AGENTS.md`. No other package's code copied in.

- [x] **Step 4: Verify CommonJS**

`grep -rn "import " packages/hermes-opencode-mcp-bridge/lib/ || echo "no ESM imports in lib/"`
Expected: `no ESM imports in lib/`.

- [x] **Step 5: Verify design doc completeness**

Diff the plan's implemented behavior against `docs/superpowers/specs/2026-08-08-hermes-opencode-mcp-bridge-design.md` section by section (tools, config, sessions, errors, MCP shape). Any gap → fix in a follow-up commit before considering done.

- [ ] **Step 6: Final commit (if any gaps fixed)**

```bash
git add -A packages/hermes-opencode-mcp-bridge/
git commit -m "chore(hermes-opencode-mcp-bridge): final polish and verification"
```

---

## Done — Definition of Done

- [x] All 12 tasks completed; all 49 tests pass via `npm test -w @andy-toolforge/hermes-opencode-mcp-bridge`.
- [x] Whole-workspace `npm test --workspaces` passes (no regressions).
- [x] 5 tools registered: `opencode_run`, `opencode_read`, `opencode_status`, `opencode_set_models`, `opencode_task`.
- [x] Config file at `~/.config/hermes-opencode/config.json` supported, env override `HERMES_OPENCODE_CONFIG` honored.
- [x] Sessions: `conversation_id` → opencode session map with `--session <id> --fork` resume, idle sweep, timeout kill.
- [x] README + package AGENTS.md written; design doc implemented faithfully.
- [ ] All commits pushed (if user requested push).

## Open questions

- Pre-existing failure confirmed in seo-generation::MultiPlatformPublisher and tts-generator::TTSPlanner/TTSPlugin and vn-stock::Integration (StockDB + Screener + Scorer, MongoDB) — `npm test --workspaces` shows `# fail 2` in 2 workspaces; identical failures reproduced at merge-base f58af5d in a temp worktree, so NOT introduced by this change. Recommend separate cleanup.
- Design doc `docs/superpowers/specs/2026-08-08-hermes-opencode-mcp-bridge-design.md` tool-table diverges from the user-approved plan: design's `opencode_run` was a shell runner `{command, timeout}`, `opencode_status` returned CLI `{version, models, agents, auth_providers}` (cached 60s), `opencode_read` took `line_range` with path confinement. The plan (reviewed, 4 bugs fixed, user-approved) redefined: `opencode_run` = task runner, `opencode_status` = git status, `opencode_read` = `depth`/`max_lines` + `expandHome` (no confinement), `opencode_task` = run with forced `auto_commit`. Config keys, error codes, session semantics, and defaults match the design doc exactly. Plan supersedes design doc for tool shapes — accepted, no further action.
- SDK 1.30 deviations from plan literal (all resolved during impl, documented per-task): zod raw-shape inputSchema (getZodSchemaObject rejects plain JSON-Schema), internal tool storage `srv._registeredTools` (not `srv._tools`), handler access via `_registeredTools.<name>.handler`.
