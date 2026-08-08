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

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hob-run-'));
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
  restore();
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
  // The impl's timeout timer is unref'd; the fake child never emits, so the
  // event loop would drain before the timer fires. Keep the loop alive.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const res = await require('./opencode-run').opencodeRun({ config: cfg, sessions, args: { task: 'slow', project_dir: tmpdir(), timeoutMs: 50 } });
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.error.code, 'TIMEOUT');
  } finally {
    clearInterval(keepAlive);
    restore();
  }
});
