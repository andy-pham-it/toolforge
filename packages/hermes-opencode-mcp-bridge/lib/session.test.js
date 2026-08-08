'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('sessionFile: sessions persist across manager restarts', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hob-ses-')), 'sessions.json');
  const sm1 = new SessionManager({ sessionFile: file });
  const id = sm1.create('ses_p1', '/tmp/proj');
  sm1.touch(id);
  sm1.markActive(id, 1234);
  sm1.markDone(id);

  const sm2 = new SessionManager({ sessionFile: file });
  const s = sm2.get(id);
  assert.ok(s);
  assert.strictEqual(s.opencodeSessionId, 'ses_p1');
  assert.strictEqual(s.projectDir, '/tmp/proj');
});

test('sessionFile: activePid is zeroed on load after restart', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hob-ses-')), 'sessions.json');
  const sm1 = new SessionManager({ sessionFile: file });
  const id = sm1.create('ses_p2', '/tmp/proj');
  sm1.markActive(id, 9999);
  const sm2 = new SessionManager({ sessionFile: file });
  assert.strictEqual(sm2.get(id).activePid, null);
});

test('sessionFile: sweep and remove are persisted', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hob-ses-')), 'sessions.json');
  const sm1 = new SessionManager({ sessionFile: file, sessionTimeout: 1 });
  const id = sm1.create('ses_p3', '/tmp/proj');
  sm1.get(id).lastUsedAt = Date.now() - 5000;
  sm1.sweep();
  let sm2 = new SessionManager({ sessionFile: file });
  assert.strictEqual(sm2.get(id), null);

  const id2 = sm1.create('ses_p4', '/tmp/proj');
  sm1.remove(id2);
  sm2 = new SessionManager({ sessionFile: file });
  assert.strictEqual(sm2.get(id2), null);
});

test('sessionFile: missing or corrupt file starts empty without throwing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-ses-'));
  const missing = new SessionManager({ sessionFile: path.join(dir, 'nope.json') });
  assert.strictEqual(missing.sessions.size, 0);
  fs.writeFileSync(path.join(dir, 'bad.json'), '{ not json');
  const corrupt = new SessionManager({ sessionFile: path.join(dir, 'bad.json') });
  assert.strictEqual(corrupt.sessions.size, 0);
});
