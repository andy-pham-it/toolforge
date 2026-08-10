'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readAuth, markExhausted, writeAuth, withLock } = require('./credential-store');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-'));
}

function sampleAuth() {
  return {
    active_provider: 'nous',
    providers: { nous: { last_status: null } },
    credential_pool: {
      gemini: [
        { id: 'g1', label: 'GOOGLE_API_KEY', last_status: null },
        { id: 'g2', label: 'GEMINI_API_KEY', last_status: null },
      ],
      nvidia: [{ id: 'n1', label: 'NVIDIA_API_KEY', last_status: null }],
      openrouter: [{ id: 'o1', label: 'OR_KEY', last_status: 'exhausted' }],
    },
  };
}

test('readAuth: parses valid file', () => {
  const dir = tmpDir();
  const p = path.join(dir, 'auth.json');
  writeAuth(p, sampleAuth());
  const auth = readAuth(p);
  assert.equal(auth.credential_pool.gemini.length, 2);
  assert.equal(auth.active_provider, 'nous');
});

test('readAuth: returns null on missing / corrupt file', () => {
  const dir = tmpDir();
  assert.equal(readAuth(path.join(dir, 'nope.json')), null);
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{not json');
  assert.equal(readAuth(bad), null);
});

test('markExhausted: sets fields + atomic rename + reset_at in future', () => {
  const dir = tmpDir();
  const p = path.join(dir, 'auth.json');
  writeAuth(p, sampleAuth());
  const before = Date.now();
  const ok = markExhausted(p, 'gemini', { code: '429', reason: 'RateLimitError', message: 'quota' }, { resetWindowMs: 1000 });
  assert.equal(ok, true);
  // tmp file cleaned up, only auth.json + no stray lock
  assert.equal(fs.existsSync(`${p}.tmp`), false);
  assert.equal(fs.existsSync(`${p}.lock`), false);
  const auth = readAuth(p);
  for (const cred of auth.credential_pool.gemini) {
    assert.equal(cred.last_status, 'exhausted');
    assert.equal(cred.last_error_code, '429');
    assert.equal(cred.last_error_reason, 'RateLimitError');
    assert.equal(cred.last_error_message, 'quota');
    assert.ok(cred.last_error_reset_at >= before + 1000);
  }
  // nvidia untouched
  assert.equal(auth.credential_pool.nvidia[0].last_status, null);
});

test('markExhausted: unknown provider -> false, no write', () => {
  const dir = tmpDir();
  const p = path.join(dir, 'auth.json');
  writeAuth(p, sampleAuth());
  assert.equal(markExhausted(p, 'ghost', { code: '429' }), false);
  assert.equal(readAuth(p).credential_pool.gemini[0].last_status, null);
});

test('markExhausted: single-dict credential_pool entry tolerated', () => {
  const dir = tmpDir();
  const p = path.join(dir, 'auth.json');
  writeAuth(p, { credential_pool: { kimi: { id: 'k1', last_status: null } } });
  assert.equal(markExhausted(p, 'kimi', { code: '429' }), true);
  assert.equal(readAuth(p).credential_pool.kimi.last_status, 'exhausted');
});

test('withLock: releases lock after fn', () => {
  const dir = tmpDir();
  const lock = path.join(dir, 'x.lock');
  let ran = false;
  withLock(lock, 50, () => { ran = true; });
  assert.equal(ran, true);
  assert.equal(fs.existsSync(lock), false);
});

test('writeAuth: creates file with trailing newline', () => {
  const dir = tmpDir();
  const p = path.join(dir, 'auth.json');
  writeAuth(p, { a: 1 });
  const raw = fs.readFileSync(p, 'utf8');
  assert.ok(raw.endsWith('\n'));
  assert.deepEqual(JSON.parse(raw), { a: 1 });
});
