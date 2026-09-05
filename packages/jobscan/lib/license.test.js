'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SECRET = 'test-secret-xyz-123';

describe('license verify + grace', () => {
  let tmpDir;
  beforeEach(() => {
    process.env.JOBSCAN_LICENSE_PUBLIC_KEY = SECRET;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobscan-lic-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });
  afterEach(() => {
    delete process.env.XDG_CONFIG_HOME;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  });

  it('valid sig -> pro', () => {
    const license = require('./license');
    delete require.cache[require.resolve('./license')];
    const lic = { tier: 'pro', key: 'KEY-123', expiresAt: new Date(Date.now() + 86400000).toISOString() };
    lic.sig = license.sign(lic);
    assert.equal(license.verify(lic), true);
  });

  it('tampered tier from free->pro without valid sig -> verify fails', () => {
    const license = require('./license');
    const lic = { tier: 'pro', key: 'KEY-123', expiresAt: new Date(Date.now() + 86400000).toISOString(), sig: 'deadbeef' + '00'.repeat(28) };
    assert.equal(license.verify(lic), false);
  });

  it('tampered sig byte -> fails', () => {
    const license = require('./license');
    const lic = { tier: 'pro', key: 'KEY-123', expiresAt: new Date(Date.now() + 86400000).toISOString() };
    lic.sig = license.sign(lic);
    lic.sig = lic.sig.slice(0, -1) + (lic.sig.slice(-1) === 'a' ? 'b' : 'a');
    assert.equal(license.verify(lic), false);
  });

  it('expired within 7 days grace -> isGraceValid true', () => {
    const license = require('./license');
    const exp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const lic = { tier: 'pro', key: 'K', expiresAt: exp };
    lic.sig = license.sign(lic);
    assert.equal(license.isGraceValid(lic), true);
  });

  it('expired + 8 days -> isGraceValid false', () => {
    const license = require('./license');
    const exp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const lic = { tier: 'pro', key: 'K', expiresAt: exp };
    lic.sig = license.sign(lic);
    assert.equal(license.isGraceValid(lic), false);
  });

  it('missing key -> verify false', () => {
    const license = require('./license');
    assert.equal(license.verify(null), false);
    assert.equal(license.verify({ tier: 'pro' }), false);
  });

  it('save/load roundtrip preserves sig and mode 0600', () => {
    const license = require('./license');
    const lic = { tier: 'pro', key: 'K2', expiresAt: new Date(Date.now() + 86400000).toISOString() };
    lic.sig = license.sign(lic);
    const p = license.saveCache(lic);
    assert.ok(fs.existsSync(p));
    const loaded = license.loadCache();
    assert.equal(loaded.sig, lic.sig);
    // check mode is 0600 (owner read/write)
    const stat = fs.statSync(p);
    const mode = stat.mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it('loadCache missing file returns null', () => {
    const license = require('./license');
    fs.rmSync(license.getCachePath(), { force: true });
    // also ensure dir exists empty
    assert.equal(license.loadCache(), null);
  });
});
