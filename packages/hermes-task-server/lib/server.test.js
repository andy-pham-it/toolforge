'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runHermesTask, runHermesTaskDetail, runHermesModels } = require('./server');
const { cacheRun, readRun } = require('./task-cache');

function tmpAuth(credentialPool, providers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-srv-'));
  const p = path.join(dir, 'auth.json');
  fs.writeFileSync(p, JSON.stringify({ credential_pool: credentialPool, providers: providers || {} }, null, 2));
  return p;
}

function aliveGeminiAuth() {
  return tmpAuth({ gemini: [{ id: 'g1', last_status: null }] }, {});
}

function spawnMock(handler) {
  const mock = test.mock.method(childProcess, 'spawn', handler);
  return mock;
}

function fakeChild({ stdoutData = '', stderrData = '', exitCode = 0 } = {}) {
  const child = new EventEmitter();
  child.pid = 99;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  setImmediate(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) child.stderr.emit('data', Buffer.from(stderrData));
    child.emit('exit', exitCode, null);
  });
  return child;
}

test('runHermesTask: happy path JSON shape (FR-5) + tool_calls (FR-5b)', async () => {
  const mock = spawnMock((bin, args) => {
    if (args[0] === 'sessions') {
      // post-run export call: fetch session JSONL for tool_calls extraction
      assert.equal(args[1], 'export');
      assert.equal(args[2], '--format');
      assert.equal(args[args.indexOf('--format') + 1], 'jsonl');
      assert.equal(args[args.indexOf('--session-id') + 1], 'ses_abc123');
      const exportObj = {
        id: 'ses_abc123',
        message_count: 3,
        messages: [
          { id: 'u1', role: 'user', content: 'hello world', tool_calls: null, tool_call_id: null },
          {
            id: 'a1', role: 'assistant', content: '',
            tool_calls: [{ id: 'call_1', call_id: 'call_1', type: 'function', function: { name: 'bash', arguments: '{"command":"echo hi"}' } }],
          },
          { id: 't1', role: 'tool', content: '{"stdout":"hi"}', tool_call_id: 'call_1', tool_name: 'bash', tool_calls: null },
        ],
      };
      return fakeChild({ stdoutData: JSON.stringify(exportObj), exitCode: 0 });
    }
    assert.ok(args.includes('--ignore-user-config'));
    assert.ok(args.includes('-Q'));
    return fakeChild({ stdoutData: 'answer here', stderrData: '\nsession_id: ses_abc123\n', exitCode: 0 });
  });
  const stderr = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (s) => { stderr.push(s); return true; };
  try {
    const res = await runHermesTask(
      { prompt: 'hello world', provider: 'gemini', model: 'gemini-3.1-flash-lite', output_mode: 'full' },
      { authPath: aliveGeminiAuth() }
    );
    assert.equal(res.ok, true);
    assert.equal(res.provider, 'gemini');
    assert.equal(res.model, 'gemini-3.1-flash-lite');
    assert.equal(res.result, 'answer here');
    assert.equal(res.truncated, false);
    assert.equal(res.exit_code, 0);
    assert.equal(res.session_id, 'ses_abc123');
    assert.equal(res.output_mode, 'full');
    assert.ok(typeof res.task_id === 'string' && res.task_id.length > 0);
    assert.ok(res.duration_ms >= 0);
    assert.deepEqual(res.tool_calls, [
      { id: 'call_1', name: 'bash', arguments: { command: 'echo hi' }, result: '{"stdout":"hi"}' },
    ]);
    assert.ok(stderr.some((l) => /\[hermes_task\] provider=gemini model=gemini-3\.1-flash-lite prompt_len=11 timeout=300s -> ok/.test(l)));
  } finally {
    mock.mock.restore();
    process.stderr.write = origWrite;
  }
});

test('runHermesTask: export failure -> task still ok, tool_calls omitted, stderr logged', async () => {
  const mock = spawnMock((bin, args) => {
    if (args[0] === 'sessions') {
      return fakeChild({ stdoutData: '', exitCode: 1 });
    }
    return fakeChild({ stdoutData: 'answer here', stderrData: '\nsession_id: ses_abc123\n', exitCode: 0 });
  });
  const stderr = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (s) => { stderr.push(s); return true; };
  try {
    const res = await runHermesTask(
      { prompt: 'hello world', provider: 'gemini', model: 'gemini-3.1-flash-lite' },
      { authPath: aliveGeminiAuth() }
    );
    assert.equal(res.ok, true);
    assert.equal(res.result, 'answer here');
    assert.equal(res.tool_calls, undefined);
    assert.ok(stderr.some((l) => /\[hermes_task\] tool_calls extraction failed/.test(l)));
  } finally {
    mock.mock.restore();
    process.stderr.write = origWrite;
  }
});

test('runHermesTask: auto picks alive provider', async () => {
  const mock = spawnMock((bin, args) => {
    assert.ok(args.includes('--provider'));
    assert.equal(args[args.indexOf('--provider') + 1], 'gemini');
    assert.ok(args.includes('-m'));
    return fakeChild({ stdoutData: 'ok', exitCode: 0 });
  });
  try {
    const res = await runHermesTask({ prompt: 'hello' }, { authPath: aliveGeminiAuth() });
    assert.equal(res.ok, true);
    assert.equal(res.provider, 'gemini');
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: all exhausted -> no_credential fast, never falls back to default model', async () => {
  const authPath = tmpAuth({ gemini: [{ id: 'g1', last_status: 'exhausted' }] }, {});
  const mock = spawnMock(() => { throw new Error('must not spawn'); });
  try {
    const res = await runHermesTask({ prompt: 'hello' }, { authPath });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'no_credential');
    assert.ok(mock.mock.callCount() === 0);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: missing auth -> no_credential', async () => {
  const mock = spawnMock(() => { throw new Error('must not spawn'); });
  try {
    const res = await runHermesTask({ prompt: 'hello' }, { authPath: '/nonexistent/nope.json' });
    assert.equal(res.error, 'no_credential');
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: unknown explicit provider -> provider_not_found < 5s', async () => {
  const mock = spawnMock(() => { throw new Error('must not spawn'); });
  try {
    const res = await runHermesTask({ prompt: 'hello', provider: 'ghost' }, { authPath: aliveGeminiAuth() });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'provider_not_found');
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: explicit provider honored, model defaulted', async () => {
  const mock = spawnMock((bin, args) => {
    assert.equal(args[args.indexOf('--provider') + 1], 'gemini');
    assert.equal(args[args.indexOf('-m') + 1], 'gemini-3.1-flash-lite');
    return fakeChild({ stdoutData: 'ok', exitCode: 0 });
  });
  try {
    const res = await runHermesTask({ prompt: 'hello', provider: 'gemini' }, { authPath: aliveGeminiAuth() });
    assert.equal(res.ok, true);
    assert.equal(res.provider, 'gemini');
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: busy on concurrent call', async () => {
  const authPath = aliveGeminiAuth();
  let release;
  const gate = new Promise((r) => { release = r; });
  const child = new EventEmitter();
  child.pid = 5;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  const mock = spawnMock(() => {
    gate.then(() => {
      child.emit('exit', 0, null);
    });
    return child;
  });
  try {
    const p1 = runHermesTask({ prompt: 'long task' }, { authPath });
    // second call while first is in flight
    const p2 = runHermesTask({ prompt: 'second' }, { authPath });
    const second = await p2;
    assert.equal(second.error, 'busy');
    release();
    const first = await p1;
    assert.equal(first.ok, true);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: cwd not in allowlist -> cwd_not_allowed', async () => {
  const mock = spawnMock(() => { throw new Error('must not spawn'); });
  try {
    const res = await runHermesTask(
      { prompt: 'hello', cwd: '/tmp/secret' },
      { authPath: aliveGeminiAuth(), cwdAllowlist: ['/tmp/ok'] }
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, 'cwd_not_allowed');
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: cwd in allowlist passed via --in', async () => {
  const mock = spawnMock((bin, args) => {
    assert.equal(args[args.indexOf('--in') + 1], '/tmp/ok');
    return fakeChild({ stdoutData: 'ok', exitCode: 0 });
  });
  try {
    const res = await runHermesTask(
      { prompt: 'hello', cwd: '/tmp/ok' },
      { authPath: aliveGeminiAuth(), cwdAllowlist: ['/tmp/ok'] }
    );
    assert.equal(res.ok, true);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: full mode result trimmed at 200KB with truncated flag', async () => {
  const big = 'x'.repeat(240 * 1024);
  const mock = spawnMock(() => fakeChild({ stdoutData: big, exitCode: 0 }));
  try {
    const res = await runHermesTask(
      { prompt: 'hello', provider: 'gemini', model: 'gemini-3.1-flash-lite', output_mode: 'full' },
      { authPath: aliveGeminiAuth() }
    );
    assert.equal(res.ok, true);
    assert.equal(res.truncated, true);
    assert.ok(Buffer.byteLength(res.result, 'utf8') <= 200 * 1024);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: 429 -> rate_limited + credential marked exhausted (FR-7)', async () => {
  const authPath = aliveGeminiAuth();
  const mock = spawnMock(() => fakeChild({ stderrData: '429 RateLimitError: quota', exitCode: 1 }));
  try {
    const res = await runHermesTask({ prompt: 'hello', provider: 'gemini', model: 'gemini-3.1-flash-lite' }, { authPath });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'rate_limited');
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    assert.equal(auth.credential_pool.gemini[0].last_status, 'exhausted');
    assert.equal(auth.credential_pool.gemini[0].last_error_code, '429');
    assert.ok(auth.credential_pool.gemini[0].last_error_reset_at > Date.now());
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: timeout -> error timeout with exit_code 124', async () => {
  const child = new EventEmitter();
  child.pid = 7;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = (sig) => { setImmediate(() => child.emit('exit', null, sig)); return true; };
  const mock = spawnMock(() => child);
  const origKill = process.kill;
  process.kill = (pid, sig) => {
    if (pid === -child.pid) child.kill(sig);
    return true;
  };
  const keepAlive = setInterval(() => {}, 1000); // keep loop alive until unref'd timeout fires
  try {
    const res = await runHermesTask(
      { prompt: 'hello', provider: 'gemini', model: 'gemini-3.1-flash-lite', timeout_seconds: 10 },
      { authPath: aliveGeminiAuth(), killGraceMs: 10 }
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, 'timeout');
    assert.equal(res.exit_code, 124);
  } finally {
    clearInterval(keepAlive);
    mock.mock.restore();
    process.kill = origKill;
  }
});

test('runHermesTask: error_detail capped at 500 bytes', async () => {
  const mock = spawnMock(() => fakeChild({ stderrData: 'e'.repeat(2000), exitCode: 2 }));
  try {
    const res = await runHermesTask({ prompt: 'hello', provider: 'gemini', model: 'gemini-3.1-flash-lite' }, { authPath: aliveGeminiAuth() });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'unknown');
    assert.ok(Buffer.byteLength(res.error_detail, 'utf8') <= 500);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: missing prompt -> invalid_args', async () => {
  const res = await runHermesTask({}, { authPath: aliveGeminiAuth() });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'invalid_args');
});

function exportObjFor(sessionId, withToolCallCount) {
  return {
    id: sessionId,
    message_count: 3,
    api_call_count: 1,
    tool_call_count: withToolCallCount ? 1 : undefined,
    messages: [
      { id: 'u1', role: 'user', content: 'hello world', tool_calls: null, tool_call_id: null },
      {
        id: 'a1', role: 'assistant', content: '',
        tool_calls: [{ id: 'call_1', call_id: 'call_1', type: 'function', function: { name: 'bash', arguments: '{"command":"echo hi"}' } }],
      },
      { id: 't1', role: 'tool', content: '{"stdout":"hi"}', tool_call_id: 'call_1', tool_name: 'bash', tool_calls: null },
    ],
  };
}

test('runHermesTask: digest mode default -> compact result + stats, no tool_calls', async () => {
  const mock = spawnMock((bin, args) => {
    if (args[0] === 'sessions') {
      return fakeChild({ stdoutData: JSON.stringify(exportObjFor('ses_abc123', true)), exitCode: 0 });
    }
    return fakeChild({ stdoutData: 'answer here', stderrData: '\nsession_id: ses_abc123\n', exitCode: 0 });
  });
  try {
    const res = await runHermesTask(
      { prompt: 'hello world', provider: 'gemini', model: 'gemini-3.1-flash-lite' },
      { authPath: aliveGeminiAuth() }
    );
    assert.equal(res.ok, true);
    assert.equal(res.output_mode, 'digest');
    assert.equal(res.result, 'answer here');
    assert.equal(res.tool_calls, undefined);
    assert.ok(typeof res.task_id === 'string' && res.task_id.length > 0);
    assert.deepEqual(res.digest, { tool_call_count: 1, api_call_count: 1, message_count: 3, tools_used: ['bash'] });
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTask: successful run cached to disk (FR-5c)', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-cache-srv-'));
  const mock = spawnMock((bin, args) => {
    if (args[0] === 'sessions') {
      return fakeChild({ stdoutData: JSON.stringify(exportObjFor('ses_abc123', true)), exitCode: 0 });
    }
    return fakeChild({ stdoutData: 'answer here', stderrData: '\nsession_id: ses_abc123\n', exitCode: 0 });
  });
  try {
    const res = await runHermesTask(
      { prompt: 'hello world', provider: 'gemini', model: 'gemini-3.1-flash-lite' },
      { authPath: aliveGeminiAuth(), cacheDir }
    );
    assert.equal(res.ok, true);
    const rec = readRun({ cacheDir }, res.task_id);
    assert.ok(rec);
    assert.equal(rec.result, 'answer here');
    assert.equal(rec.session_id, 'ses_abc123');
    assert.equal(rec.provider, 'gemini');
    assert.ok(rec.created_at);
    assert.equal(rec.tool_calls.length, 1);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTaskDetail: cached hit by task_id', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-detail-'));
  cacheRun({ cacheDir }, {
    task_id: 't1', session_id: 'ses_1', provider: 'gemini', model: 'm1', output_mode: 'full',
    result: 'cached full result', tool_calls: [{ id: 'c1', name: 'bash', arguments: null, result: null }],
    digest: null, exit_code: 0, duration_ms: 123, created_at: new Date().toISOString(),
  });
  const res = await runHermesTaskDetail({ task_id: 't1' }, { cacheDir });
  assert.equal(res.ok, true);
  assert.equal(res.cached, true);
  assert.equal(res.task_id, 't1');
  assert.equal(res.session_id, 'ses_1');
  assert.equal(res.provider, 'gemini');
  assert.equal(res.result, 'cached full result');
  assert.deepEqual(res.tool_calls, [{ id: 'c1', name: 'bash', arguments: null, result: null }]);
  assert.equal(res.exit_code, 0);
  assert.equal(res.duration_ms, 123);
});

test('runHermesTaskDetail: cache miss + session_id -> live export', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-detail-'));
  const mock = spawnMock((bin, args) => {
    if (args[0] === 'sessions') {
      return fakeChild({ stdoutData: JSON.stringify(exportObjFor('ses_live', true)), exitCode: 0 });
    }
    throw new Error('must not spawn chat for detail');
  });
  try {
    const res = await runHermesTaskDetail({ session_id: 'ses_live' }, { cacheDir });
    assert.equal(res.ok, true);
    assert.equal(res.cached, false);
    assert.equal(res.session_id, 'ses_live');
    assert.equal(res.task_id, 'ses_ses_live');
    assert.equal(res.result, null);
    assert.deepEqual(res.tool_calls, [
      { id: 'call_1', name: 'bash', arguments: { command: 'echo hi' }, result: '{"stdout":"hi"}' },
    ]);
    // live export also cached for next hit
    assert.ok(readRun({ cacheDir }, 'ses_ses_live'));
  } finally {
    mock.mock.restore();
  }
});

test('runHermesTaskDetail: not_found when no cache and no session_id', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-detail-'));
  const res = await runHermesTaskDetail({ task_id: 'nope' }, { cacheDir });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'not_found');
});

test('runHermesTaskDetail: invalid_args when neither task_id nor session_id', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-detail-'));
  const res = await runHermesTaskDetail({}, { cacheDir });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'invalid_args');
});

test('runHermesTaskDetail: max_bytes truncates result', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-detail-'));
  cacheRun({ cacheDir }, {
    task_id: 't2', session_id: 'ses_2', provider: 'gemini', model: 'm1', output_mode: 'full',
    result: 'x'.repeat(500), tool_calls: [], digest: null, exit_code: 0, duration_ms: 1, created_at: new Date().toISOString(),
  });
  const res = await runHermesTaskDetail({ task_id: 't2', max_bytes: 100 }, { cacheDir });
  assert.equal(res.ok, true);
  assert.equal(res.cached, true);
  assert.ok(Buffer.byteLength(res.result, 'utf8') <= 100);
});

test('runHermesModels: happy path merges cache + auth liveness (FR-5d)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-models-'));
  const cacheFile = path.join(dir, 'models-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ gemini: { at: 1234, models: ['gemini-3.1-flash-lite'] } }));
  const res = await runHermesModels({}, { authPath: aliveGeminiAuth(), modelsCachePath: cacheFile });
  assert.equal(res.ok, true);
  assert.equal(res.source, 'mixed'); // gemini from cache + capability-map providers
  assert.equal(res.count, 3);
  assert.equal(res.providers[0].provider, 'gemini');
  assert.equal(res.providers[0].status, 'alive');
  assert.equal(res.providers[0].model_count, 1);
  assert.equal(res.providers[0].default_model, 'gemini-3.1-flash-lite');
  assert.equal(res.providers[0].models[0].is_default, true);
  assert.ok(res.providers[0].models[0].capabilities.includes('reasoning'));
  assert.ok(res.providers[0].models[0].input_types.includes('text'));
});

test('runHermesModels: provider filter + provider_not_found', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-models-'));
  const cacheFile = path.join(dir, 'models-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ gemini: { at: 1234, models: ['gemini-3.1-flash-lite'] } }));
  const ok = await runHermesModels({ provider: 'gemini' }, { authPath: aliveGeminiAuth(), modelsCachePath: cacheFile });
  assert.equal(ok.ok, true);
  assert.equal(ok.providers[0].provider, 'gemini');
  const bad = await runHermesModels({ provider: 'nope' }, { authPath: aliveGeminiAuth(), modelsCachePath: cacheFile });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'provider_not_found');
});

test('runHermesModels: input_type filter', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-models-'));
  const cacheFile = path.join(dir, 'models-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ gemini: { at: 1234, models: ['gemini-3.1-flash-lite', 'gemini-3-flash'] } }));
  const res = await runHermesModels({ input_type: 'video' }, { authPath: aliveGeminiAuth(), modelsCachePath: cacheFile });
  assert.equal(res.ok, true);
  assert.equal(res.providers[0].models.length, 1);
  assert.equal(res.providers[0].models[0].id, 'gemini-3.1-flash-lite');
  assert.equal(res.providers[0].model_count, 1);
});

test('runHermesModels: missing cache falls back to capability-map', async () => {
  const res = await runHermesModels({}, { authPath: aliveGeminiAuth(), modelsCachePath: '/nonexistent/models-cache.json' });
  assert.equal(res.ok, true);
  assert.equal(res.source, 'capability-map');
  const gemini = res.providers.find((p) => p.provider === 'gemini');
  assert.ok(gemini);
  assert.ok(gemini.model_count > 0);
});

test('runHermesTask: stale-exhausted provider auto-picked when forgive TTL set', async () => {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const staleAt = (now - 7 * HOUR) / 1000;
  const authPath = tmpAuth({ 'opencode-zen': [{ id: 'z1', last_status: 'exhausted', last_status_at: staleAt }] }, {});
  const mock = spawnMock((bin, args) => {
    assert.equal(args[args.indexOf('--provider') + 1], 'opencode-zen');
    assert.equal(args[args.indexOf('-m') + 1], 'deepseek-v4-flash-free');
    return fakeChild({ stdoutData: 'ok', exitCode: 0 });
  });
  try {
    const res = await runHermesTask({ prompt: 'hello' }, { authPath, exhaustedForgiveTtlMs: 6 * HOUR });
    assert.equal(res.ok, true);
    assert.equal(res.provider, 'opencode-zen');
    assert.equal(res.model, 'deepseek-v4-flash-free');
  } finally {
    mock.mock.restore();
  }
});
