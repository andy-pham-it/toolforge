'use strict';

const Stage = require('../stage');

class CacheStage extends Stage {
  /** @param {object} store */
  constructor(store) {
    super('cache');
    this._store = store;
  }

  /**
   * Generate cache key from context using Web Crypto API.
   * Includes tenant ID for tenant isolation. Browser-safe.
   */
  async _cacheKey(ctx) {
    const encoder = new TextEncoder();
    const payload = `${ctx.tenant}|${ctx.model}|${JSON.stringify(ctx.messages)}`;
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async execute(ctx, next) {
    // Skip cache for streaming
    if (ctx.stream) {
      await next();
      return;
    }

    const key = await this._cacheKey(ctx);
    const cached = this._store.get(key);
    if (cached) {
      ctx.response = cached;
      ctx.cached = true;
      return;
    }

    await next();

    if (!ctx.error && ctx.response) {
      this._store.set(key, ctx.response);
    }
  }
}

module.exports = CacheStage;
