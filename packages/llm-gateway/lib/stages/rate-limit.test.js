'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { RateLimitStage, TokenBucket } = require('./rate-limit');

describe('TokenBucket', () => {
  it('allows consuming within capacity', () => {
    const bucket = new TokenBucket(10, 100);
    assert.ok(bucket.tryConsume(5));
    assert.strictEqual(bucket.remaining, 5);
  });

  it('blocks when empty', () => {
    const bucket = new TokenBucket(1, 100);
    assert.ok(bucket.tryConsume(1));
    assert.strictEqual(bucket.tryConsume(1), false);
    assert.strictEqual(bucket.remaining, 0);
  });
});

describe('RateLimitStage', () => {
  it('allows request within quota', async () => {
    const stage = new RateLimitStage({ buckets: { default: { capacity: 5, refillRate: 10 } } });
    const ctx = { tenant: 'default' };
    let called = false;
    await stage.execute(ctx, async () => { called = true; });
    assert.ok(called);
    assert.ok(ctx.responseHeaders['X-RateLimit-Remaining']);
  });

  it('blocks request when quota exhausted', async () => {
    const stage = new RateLimitStage({ buckets: { test: { capacity: 1, refillRate: 100 } } });
    const ctx1 = { tenant: 'test' };
    await stage.execute(ctx1, async () => {});
    assert.ok(!ctx1.error);
    const ctx2 = { tenant: 'test' };
    await stage.execute(ctx2, async () => {});
    assert.strictEqual(ctx2.error.code, 'RATE_LIMITED');
    assert.strictEqual(ctx2.error.statusCode, 429);
    assert.strictEqual(ctx2.responseHeaders['Retry-After'], '1');
  });
});
