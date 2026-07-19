'use strict';

const Stage = require('../stage');

class KeyRotatorStage extends Stage {
  /**
   * @param {object} opts
   * @param {Object<string, string[]>} [opts.keyPools] — { [provider]: [key1, key2, ...] }
   */
  constructor(opts = {}) {
    super('key-rotator');
    /** @type {Object<string, string[]>} */
    this._keyPools = opts.keyPools || {};
    /** @type {Object<string, number>} */
    this._currentIndex = {};
  }

  async execute(ctx, next) {
    const pool = this._keyPools[ctx.provider];
    if (!pool || pool.length <= 1) {
      if (pool && pool.length === 1) {
        ctx.apiKey = pool[0];
        ctx._keyIndex = 0;
      }
      await next();
      return;
    }

    // Use current key from pool
    const idx = this._currentIndex[ctx.provider] || 0;
    ctx.apiKey = pool[idx];
    ctx._keyIndex = idx;

    await next();

    // If 401 and more keys available, retry with next key
    if (ctx.error && ctx.error.statusCode === 401 && pool.length > 1) {
      const nextIdx = (idx + 1) % pool.length;
      if (nextIdx !== idx) {
        ctx.apiKey = pool[nextIdx];
        this._currentIndex[ctx.provider] = nextIdx;
        ctx._keyIndex = nextIdx;
        ctx.error = null;
        await next();
      }
    }
  }
}

module.exports = KeyRotatorStage;
