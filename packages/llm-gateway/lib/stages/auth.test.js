'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const AuthStage = require('./auth');

describe('AuthStage', () => {
  it('passes with valid key', async () => {
    const stage = new AuthStage({ keys: { 'sk-valid': { tenant: 'acme' } } });
    const ctx = { apiKey: 'sk-valid' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.strictEqual(ctx.tenant, 'acme');
  });

  it('rejects with invalid key', async () => {
    const stage = new AuthStage({ keys: { 'sk-valid': { tenant: 'acme' } } });
    const ctx = { apiKey: 'sk-invalid' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.strictEqual(called, false);
    assert.strictEqual(ctx.error.code, 'AUTH_FAILED');
    assert.strictEqual(ctx.error.statusCode, 401);
  });

  it('rejects missing key', async () => {
    const stage = new AuthStage();
    const ctx = {};
    await stage.execute(ctx, async () => {});
    assert.strictEqual(ctx.error.code, 'AUTH_FAILED');
    assert.strictEqual(ctx.error.statusCode, 401);
  });

  it('accepts rotationKeys as valid', async () => {
    const stage = new AuthStage({
      keys: { 'sk-primary': { tenant: 'acme', rotationKeys: ['sk-backup'] } },
    });
    const ctx = { apiKey: 'sk-backup' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.strictEqual(ctx.tenant, 'acme');
  });
});
