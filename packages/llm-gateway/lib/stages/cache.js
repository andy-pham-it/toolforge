'use strict';

const Stage = require('../stage');

class CacheStage extends Stage {
  /**
   * @param {import('../cache/types').CacheStore} store
   * @param {object} [opts]
   * @param {import('../metrics/collector')} [opts.metrics]
   */
  constructor(store, opts = {}) {
    super('cache');
    this._store = store;
    this._metrics = opts.metrics || null;
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
      this._metrics?.increment('llm_cache_requests_total', { status: 'hit' });
      return;
    }

    this._metrics?.increment('llm_cache_requests_total', { status: 'miss' });
    await next();

    if (!ctx.error && ctx.response) {
      this._store.set(key, ctx.response);
    }
  }
}

module.exports = CacheStage;
