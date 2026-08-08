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
    JSON.stringify({ type: 'tool_use', sessionID: sessionId, part: { type: 'tool', tool: 'edit', state: { status: 'completed', metadata: { filediff: { file: '/tmp/proj/hello.js', patch: 'Index: hello.js\n@@ -1 +1 @@\n-console.log("a")\n+console.log("b")' } } } } }),
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

// SDK 1.30 stores tools in srv._registeredTools; each entry exposes the
// handler at .handler (RichTool). Invoke via .call(server, args) so
// `this` binds to the server like the SDK would.
function toolHandler(server, name) {
  return server._registeredTools[name].handler;
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
  const res = await toolHandler(server, 'opencode_run').call(server, { task: 'do the thing', project_dir: '/tmp/proj' });
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
  const res = await toolHandler(server, 'opencode_run').call(server, { task: 'continue', conversation_id: cid });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.conversation_id, cid);
});

test('integration: opencode_read works without child_process', async (t) => {
  fakeEnv(t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-int-read-'));
  fs.writeFileSync(path.join(dir, 'x.txt'), 'hi\n');
  const server = createServer({});
  const res = await toolHandler(server, 'opencode_read').call(server, { path: path.join(dir, 'x.txt') });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.content, 'hi');
});

test('integration: opencode_status uses mocked git', async (t) => {
  fakeEnv(t);
  mock.method(childProcess, 'execFile', (bin, args, cb) => {
    if (args.includes('status')) return cb(null, '## main\n M a.js\n', '');
    return cb(new Error('unexpected'));
  });
  const server = createServer({});
  const res = await toolHandler(server, 'opencode_status').call(server, { project_dir: '/tmp/proj' });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.status, 'dirty');
});

test('integration: opencode_set_models set persists', async (t) => {
  fakeEnv(t);
  const server = createServer({});
  const res = await toolHandler(server, 'opencode_set_models').call(server, { action: 'set', models: ['opencode/z'] });
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(res.data.models, ['opencode/z']);
});

test('integration: opencode_task forces auto_commit', async (t) => {
  fakeEnv(t);
  mock.method(childProcess, 'spawn', (bin, args) => makeFakeChild(realOpenCodeStdout('ses_int3')));
  // auto_commit triggers best-effort git add/commit via execFile — mock it
  // so the test never touches a real git repo.
  mock.method(childProcess, 'execFile', (bin, args, cb) => cb(null, '', ''));
  const server = createServer({});
  const res = await toolHandler(server, 'opencode_task').call(server, { task: 'edit', project_dir: '/tmp/proj' });
  assert.strictEqual(res.status, 'success');
});
