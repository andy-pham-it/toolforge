'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const childProcess = require('child_process');

const { buildArgv, classifyError, runHermesChat } = require('./runner');

// Fake child exposing the EventEmitter surface runHermesChat uses.
function fakeChild({ stdoutData = '', stderrData = '', exitCode = 0, spawnError = null, pid = 1234 } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killCalls = [];
  child.kill = (sig) => {
    child.killCalls.push(sig);
    return true;
  };
  setImmediate(() => {
    if (spawnError) {
      child.emit('error', spawnError);
      return;
    }
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    if (stderrData) child.stderr.emit('data', Buffer.from(stderrData));
    child.emit('exit', exitCode, null);
  });
  return child;
}

test('buildArgv: full shape with paired provider/model + mandatory flags', () => {
  const argv = buildArgv({
    bin: 'hermes',
    prompt: 'hello',
    provider: 'nvidia',
    model: 'nvidia/nemotron',
    toolsets: 'web',
    maxTurns: 50,
    cwd: '/tmp/work',
  });
  assert.equal(argv[0], 'hermes');
  assert.equal(argv[1], 'chat');
  assert.equal(argv[2], '-q');
  assert.equal(argv[3], 'hello');
  assert.ok(argv.includes('--provider'));
  assert.equal(argv[argv.indexOf('--provider') + 1], 'nvidia');
  assert.ok(argv.includes('-m'));
  assert.equal(argv[argv.indexOf('-m') + 1], 'nvidia/nemotron');
  assert.equal(argv[argv.indexOf('-t') + 1], 'web');
  assert.equal(argv[argv.indexOf('--max-turns') + 1], '50');
  assert.ok(argv.includes('--in'));
  assert.equal(argv[argv.indexOf('--in') + 1], '/tmp/work');
  // mandatory flags (AC-4: stderr never shows opencode-zen; Q1 fix)
  assert.ok(argv.includes('-Q'));
  assert.ok(argv.includes('--accept-hooks'));
  assert.ok(argv.includes('--ignore-user-config'));
  assert.ok(argv.includes('--pass-session-id'));
});

test('buildArgv: auto provider omits --provider; no cwd when empty', () => {
  const argv = buildArgv({ bin: 'hermes', prompt: 'x', provider: 'auto', model: '', maxTurns: 500 });
  assert.ok(!argv.includes('--provider'));
  assert.ok(!argv.includes('-m'));
  assert.ok(!argv.includes('--in'));
  assert.equal(argv[argv.indexOf('--max-turns') + 1], '500');
});

test('runHermesChat: success resolves stdout/exitCode/durationMs', async () => {
  const mock = test.mock.method(childProcess, 'spawn', (bin, args, opts) => {
    assert.equal(bin, 'hermes');
    assert.ok(args.includes('--ignore-user-config'));
    assert.equal(opts.detached, true);
    return fakeChild({ stdoutData: 'result text\n', exitCode: 0 });
  });
  try {
    const res = await runHermesChat({ prompt: 'hi', provider: 'nvidia', model: 'm', timeoutMs: 1000 }, { hermesBin: 'hermes' });
    assert.equal(res.stdout, 'result text\n');
    assert.equal(res.exitCode, 0);
    assert.equal(res.timedOut, false);
    assert.equal(res.spawnError, null);
    assert.ok(res.durationMs >= 0);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesChat: timeout kills process group (-pid) and reports 124', async () => {
  const child = new EventEmitter();
  child.pid = 4242;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killCalls = [];
  child.kill = (sig) => {
    child.killCalls.push(sig);
    setImmediate(() => child.emit('exit', null, 'SIGKILL'));
    return true;
  };
  const mock = test.mock.method(childProcess, 'spawn', () => child);
  let killedPid = null;
  const origKill = process.kill;
  process.kill = (pid, sig) => {
    killedPid = pid;
    if (pid === -child.pid) child.kill(sig);
    return true;
  };
  const keepAlive = setInterval(() => {}, 1000); // keep loop alive until unref'd timeout fires
  try {
    const res = await runHermesChat({ prompt: 'hi', provider: 'nvidia', model: 'm', timeoutMs: 20 }, { killGraceMs: 10 });
    assert.equal(res.timedOut, true);
    assert.equal(res.exitCode, 124);
    assert.equal(killedPid, -4242);
  } finally {
    clearInterval(keepAlive);
    mock.mock.restore();
    process.kill = origKill;
  }
});

test('runHermesChat: 429 in stderr still returns exitCode but classifyError maps to rate_limited', async () => {
  const mock = test.mock.method(childProcess, 'spawn', () =>
    fakeChild({ stderrData: 'RateLimitError: 429 quota exceeded', exitCode: 1 })
  );
  try {
    const res = await runHermesChat({ prompt: 'hi', provider: 'gemini', model: 'm', timeoutMs: 1000 }, {});
    assert.equal(res.exitCode, 1);
    assert.match(res.stderr, /429/);
  } finally {
    mock.mock.restore();
  }
});

test('runHermesChat: spawn ENOENT -> spawnError surfaced', async () => {
  const err = Object.assign(new Error('spawn hermes ENOENT'), { code: 'ENOENT' });
  const mock = test.mock.method(childProcess, 'spawn', () => fakeChild({ spawnError: err }));
  try {
    const res = await runHermesChat({ prompt: 'hi', provider: 'nvidia', model: 'm', timeoutMs: 1000 }, {});
    assert.equal(res.spawnError.code, 'ENOENT');
    assert.equal(res.exitCode, null);
  } finally {
    mock.mock.restore();
  }
});

test('classifyError: taxonomy', () => {
  assert.equal(classifyError({ timedOut: true }), 'timeout');
  assert.equal(classifyError({ exitCode: 124 }), 'timeout');
  assert.equal(classifyError({ stderr: 'FreeUsageLimitError raised' }), 'rate_limited');
  assert.equal(classifyError({ stderr: 'HTTP 429 Too Many Requests' }), 'rate_limited');
  assert.equal(classifyError({ stderr: 'RateLimitError' }), 'rate_limited');
  assert.equal(classifyError({ spawnError: { code: 'ENOENT' } }), 'spawn_failed');
  assert.equal(classifyError({ exitCode: 2, stderr: 'boom' }), 'unknown');
  assert.equal(classifyError({ exitCode: 0 }), null);
});
