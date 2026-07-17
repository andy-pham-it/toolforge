'use strict';

const crypto = require('crypto');
const Stage = require('../stage');

class CacheStage extends Stage {
  /**
   * @param {import('../cache/types').CacheStore} store
   */
  constructor(store) {
    super('cache');
    this._store = store;
  }

  /**
   * Generate cache key from context.
   * Includes tenant ID for tenant isolation.
   */
  _cacheKey(ctx) {
    const payload = `${ctx.tenant}|${ctx.model}|${JSON.stringify(ctx.messages)}`;
    return crypto.createHash('md5').update(payload).digest('hex');
  }

  async execute(ctx, next) {
    // Skip cache for streaming
    if (ctx.stream) {
      await next();
      return;
    }

    const key = this._cacheKey(ctx);
    const cached = this._store.get(key);
    if (cached) {
      ctx.response = cached;
      ctx.cached = true;
      // Short-circuit — skip downstream stages
      return;
    }

    // Cache miss — proceed downstream
    await next();

    // Store response if successful and non-streaming
    if (!ctx.error && ctx.response) {
      this._store.set(key, ctx.response);
    }
  }
}

module.exports = CacheStage;
