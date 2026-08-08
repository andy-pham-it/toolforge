'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

function tmpdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-status-'));
  return dir;
}

function fakeGit(stdout, cbError = null) {
  mock.method(childProcess, 'execFile', (bin, args, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    if (args.includes('status')) return callback(cbError, stdout, '');
    if (args.includes('rev-parse')) return callback(null, 'main\n', '');
    return callback(new Error('unexpected git args'));
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
