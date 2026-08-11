'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cacheDirFor, cacheRun, readRun, findBySession, listRuns } = require('./task-cache');

function tmpCfg() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-cache-test-'));
  return { cacheDir: dir };
}

test('cacheDirFor: config wins, else default home dir', () => {
  assert.equal(cacheDirFor({ cacheDir: '/tmp/x' }), '/tmp/x');
  assert.equal(cacheDirFor({}), path.join(os.homedir(), '.hermes', 'hermes-task-cache'));
  assert.equal(cacheDirFor({ cacheDir: '  ' }), path.join(os.homedir(), '.hermes', 'hermes-task-cache'));
});

test('cacheRun/readRun: roundtrip persists and returns same record', () => {
  const cfg = tmpCfg();
  const rec = { task_id: 't1', session_id: 's1', provider: 'gemini', result: 'hello', tool_calls: [], created_at: '2026-08-11T00:00:00.000Z' };
  cacheRun(cfg, rec);
  assert.deepEqual(readRun(cfg, 't1'), rec);
  assert.equal(readRun(cfg, 'missing'), null);
  assert.equal(readRun(cfg, ''), null);
});

test('cacheRun: noop without task_id', () => {
  const cfg = tmpCfg();
  cacheRun(cfg, { session_id: 's1' });
  assert.equal(readRun(cfg, 'undefined'), null);
});

test('findBySession: matches by session_id, null on miss', () => {
  const cfg = tmpCfg();
  cacheRun(cfg, { task_id: 't1', session_id: 's1', provider: 'gemini' });
  cacheRun(cfg, { task_id: 't2', session_id: 's2', provider: 'nvidia' });
  const found = findBySession(cfg, 's2');
  assert.ok(found);
  assert.equal(found.task_id, 't2');
  assert.equal(findBySession(cfg, 'nope'), null);
  assert.equal(findBySession(cfg, ''), null);
});

test('listRuns: returns metadata sorted by created_at desc, skips corrupt', () => {
  const cfg = tmpCfg();
  cacheRun(cfg, { task_id: 't1', session_id: 's1', provider: 'gemini', model: 'g', created_at: '2026-08-11T01:00:00.000Z', duration_ms: 100, exit_code: 0 });
  cacheRun(cfg, { task_id: 't2', session_id: 's2', provider: 'nvidia', model: 'n', created_at: '2026-08-11T02:00:00.000Z', duration_ms: 200, exit_code: 0 });
  fs.writeFileSync(path.join(cfg.cacheDir, 'corrupt.json'), '{not json');
  const runs = listRuns(cfg);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].task_id, 't2'); // newest first
  assert.equal(runs[1].task_id, 't1');
  assert.equal(runs[0].provider, 'nvidia');
  assert.equal(runs[0].created_at, '2026-08-11T02:00:00.000Z');
});

test('listRuns: [] when dir missing', () => {
  assert.deepEqual(listRuns({ cacheDir: path.join(os.tmpdir(), 'hermes-task-cache-nonexistent-xyz') }), []);
});
