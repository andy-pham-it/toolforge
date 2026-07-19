'use strict';

const Stage = require('../stage');

class CircuitBreakerState {
  /**
   * @param {object} [opts]
   * @param {number} [opts.threshold=5]
   * @param {number} [opts.cooldownMs=30000]
   * @param {number} [opts.halfOpenMaxRequests=1]
   */
  constructor(opts = {}) {
    this.threshold = opts.threshold || 5;
    this.cooldownMs = opts.cooldownMs || 30000;
    this.halfOpenMax = opts.halfOpenMaxRequests || 1;

    /** @type {Object<string, {failures: number, lastFailure: number, state: string, halfOpenSent: number}>} */
    this._providers = {};
  }

  onSuccess(provider) {
    const p = this._providers[provider];
    if (p) {
      if (p.state === 'half-open') p.state = 'closed';
      p.failures = 0;
    }
  }

  onFailure(provider) {
    let p = this._providers[provider];
    if (!p) {
      p = { failures: 0, lastFailure: 0, state: 'closed', halfOpenSent: 0 };
      this._providers[provider] = p;
    }
    p.failures++;
    p.lastFailure = Date.now();
    if (p.failures >= this.threshold) {
      p.state = 'open';
    }
  }

  isOpen(provider) {
    const p = this._providers[provider];
    if (!p) return false;
    if (p.state === 'closed') return false;
    if (p.state === 'open') {
      if (Date.now() - p.lastFailure >= this.cooldownMs) {
        p.state = 'half-open';
        p.halfOpenSent = 0;
        return false;
      }
      return true;
    }
    // half-open: allow limited probes
    if (p.halfOpenSent < this.halfOpenMax) {
      p.halfOpenSent++;
      return false;
    }
    return true;
  }

  getState(provider) {
    return this._providers[provider]?.state || 'closed';
  }

  getAllStates() {
    const result = {};
    for (const [provider, p] of Object.entries(this._providers)) {
      result[provider] = p.state;
    }
    return result;
  }
}

class CircuitBreakerStage extends Stage {
  /**
   * @param {CircuitBreakerState} state
   */
  constructor(state) {
    super('circuit-breaker');
    this._state = state;
  }

  async execute(ctx, next) {
    // Runs AFTER provider — record success/failure based on outcome
    await next();

    if (ctx.provider && ctx.error) {
      this._state.onFailure(ctx.provider);
    } else if (ctx.provider && !ctx.error) {
      this._state.onSuccess(ctx.provider);
    }
  }
}

module.exports = { CircuitBreakerStage, CircuitBreakerState };
