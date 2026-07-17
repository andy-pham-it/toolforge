'use strict';

const Stage = require('../stage');
const ModelMap = require('../router/model-map');
const FallbackChain = require('../router/fallback-chain');

class RouterStage extends Stage {
  /**
   * @param {object} opts
   * @param {ModelMap} opts.modelMap
   * @param {FallbackChain} [opts.fallbackChain]
   * @param {Function} [opts.createAdapter] — factory: (provider, apiKey) => adapter instance
   */
  constructor(opts = {}) {
    super('router');
    this._modelMap = opts.modelMap || new ModelMap();
    this._fallbackChain = opts.fallbackChain || new FallbackChain();
    this._createAdapter = opts.createAdapter || ((p, k) => null);
    /** @type {import('./circuit-breaker').CircuitBreakerState|null} */
    this._circuitBreaker = null;
  }

  /** Let Gateway inject circuit breaker reference */
  setCircuitBreaker(cb) {
    this._circuitBreaker = cb;
  }

  async execute(ctx, next) {
    // Resolve primary model
    let entry;
    try {
      entry = this._modelMap.resolve(ctx.model);
    } catch (err) {
      ctx.error = err;
      return;
    }

    ctx.provider = entry.provider;
    ctx._route = entry;

    // Circuit breaker check — route to fallback if primary is broken
    if (this._circuitBreaker && this._circuitBreaker.isOpen(entry.provider)) {
      const fallbacks = this._fallbackChain.getFallbacks(ctx.model);
      for (const fbModel of fallbacks) {
        try {
          const fbEntry = this._modelMap.resolve(fbModel);
          if (!this._circuitBreaker.isOpen(fbEntry.provider)) {
            ctx.model = fbModel;
            ctx.provider = fbEntry.provider;
            ctx._route = fbEntry;
            ctx._fallbackReason = `primary ${entry.provider} circuit broken`;
            ctx._fallbackIndex = 0;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!ctx._route || this._circuitBreaker.isOpen(ctx._route.provider)) {
        ctx.error = new Error(`All providers circuit-broken for ${ctx.model}`);
        ctx.error.code = 'ALL_CIRCUITS_OPEN';
        return;
      }
    }

    // Defer adapter creation to ProviderStage (handles key rotation transparently)
    ctx._adapterFactory = (apiKey) => this._createAdapter(ctx._route.provider, apiKey);

    await next();

    // If primary failed and fallback chain exists, try fallbacks
    if (ctx.error && !ctx.error._fallbackTried) {
      ctx.error._fallbackTried = true;
      const fallbacks = this._fallbackChain.getFallbacks(ctx.model);
      for (let i = 0; i < fallbacks.length; i++) {
        const fbModel = fallbacks[i];
        try {
          const fbEntry = this._modelMap.resolve(fbModel);
          // Reset adapter factory and re-run
          ctx._route = fbEntry;
          ctx.provider = fbEntry.provider;
          ctx.model = fbModel;
          ctx._adapterFactory = (apiKey) => this._createAdapter(fbEntry.provider, apiKey);
          ctx.error = null;
          ctx._fallbackIndex = i + 1;
          await next();
          if (!ctx.error) return;
        } catch (fbErr) {
          ctx.error = fbErr;
        }
      }
    }
  }
}

module.exports = RouterStage;
