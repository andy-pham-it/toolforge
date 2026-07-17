'use strict';

const Stage = require('../stage');

class AuthStage extends Stage {
  /**
   * @param {object} opts
   * @param {object} [opts.keys] — { [apiKey]: { tenant, roles, rotationKeys[] } }
   * @param {string} [opts.defaultTenant='default']
   */
  constructor(opts = {}) {
    super('auth');
    this._keys = opts.keys || {};
    this._defaultTenant = opts.defaultTenant || 'default';
  }

  async execute(ctx, next) {
    const key = ctx.apiKey;
    if (!key) {
      ctx.error = new Error('API key required');
      ctx.error.code = 'AUTH_FAILED';
      ctx.error.statusCode = 401;
      return;
    }

    // Direct match
    if (this._keys[key]) {
      ctx.tenant = this._keys[key].tenant || this._defaultTenant;
      ctx.roles = this._keys[key].roles || [];
      ctx.responseHeaders = ctx.responseHeaders || {};
      ctx.responseHeaders['X-Tenant-Id'] = ctx.tenant;
      await next();
      return;
    }

    // Rotation match — key is part of a key pool
    const rotationEntry = Object.values(this._keys).find(
      e => e.rotationKeys && e.rotationKeys.includes(key)
    );
    if (rotationEntry) {
      ctx.tenant = rotationEntry.tenant || this._defaultTenant;
      ctx.roles = rotationEntry.roles || [];
      ctx.responseHeaders = ctx.responseHeaders || {};
      ctx.responseHeaders['X-Tenant-Id'] = ctx.tenant;
      await next();
      return;
    }

    ctx.error = new Error('Invalid API key');
    ctx.error.code = 'AUTH_FAILED';
    ctx.error.statusCode = 401;
  }
}

module.exports = AuthStage;
