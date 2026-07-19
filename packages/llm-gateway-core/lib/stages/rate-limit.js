'use strict';

const Stage = require('../stage');

class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  tryConsume(count = 1) {
    this._refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  get remaining() {
    this._refill();
    return Math.floor(this.tokens);
  }

  get resetTimeMs() {
    this._refill();
    if (this.tokens >= this.capacity) return 0;
    return Math.ceil((this.capacity - this.tokens) / this.refillRate) * 1000;
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

class RateLimitStage extends Stage {
  /**
   * @param {object} opts
   * @param {object} [opts.buckets] — { [tenant]: { capacity, refillRate } }
   * @param {number} [opts.defaultCapacity=60]
   * @param {number} [opts.defaultRefillRate=1]
   */
  constructor(opts = {}) {
    super('rate-limit');
    /** @type {Object<string, TokenBucket>} */
    this._buckets = {};
    this._defaultCapacity = opts.defaultCapacity || 60;
    this._defaultRefillRate = opts.defaultRefillRate || 1;
    if (opts.buckets) {
      for (const [tenant, cfg] of Object.entries(opts.buckets)) {
        this._buckets[tenant] = new TokenBucket(cfg.capacity, cfg.refillRate);
      }
    }
  }

  async execute(ctx, next) {
    const tenant = ctx.tenant || 'default';
    if (!this._buckets[tenant]) {
      this._buckets[tenant] = new TokenBucket(this._defaultCapacity, this._defaultRefillRate);
    }
    const bucket = this._buckets[tenant];

    ctx.responseHeaders = ctx.responseHeaders || {};
    ctx.responseHeaders['X-RateLimit-Limit'] = String(bucket.capacity);
    ctx.responseHeaders['X-RateLimit-Remaining'] = String(bucket.remaining);
    const resetMs = bucket.resetTimeMs;
    ctx.responseHeaders['X-RateLimit-Reset'] = String(Math.ceil(resetMs / 1000));

    if (!bucket.tryConsume()) {
      ctx.error = new Error('Rate limit exceeded');
      ctx.error.code = 'RATE_LIMITED';
      ctx.error.statusCode = 429;
      ctx.error.retryAfterMs = resetMs;
      ctx.responseHeaders['Retry-After'] = String(Math.ceil(resetMs / 1000));
      return;
    }

    await next();
  }
}

module.exports = { RateLimitStage, TokenBucket };
