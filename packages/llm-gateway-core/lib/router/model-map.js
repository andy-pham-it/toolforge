'use strict';

class ModelMap {
  /**
   * @param {object} [config={}] — optional initial model mappings
   * @param {string} [config.tiebreaker='cost'] — 'cost' | 'latency'
   */
  constructor(config = {}) {
    /** @type {Object<string, {provider:string, adapter:string, timeoutMs:number}>} */
    this._models = {};
    /** @type {Object<string, string>} */
    this._aliases = {};
    this._tiebreaker = config.tiebreaker || 'cost';
    // Load initial models from config
    if (config.models) {
      for (const [name, opts] of Object.entries(config.models)) {
        this.add(name, opts);
      }
    }
  }

  /**
   * Register a model mapping.
   * @param {string} model
   * @param {{provider:string, adapter:string, timeoutMs?:number} | Array} opts
   */
  add(model, opts) {
    if (Array.isArray(opts)) {
      this._models[model] = this._resolveCollision(model, opts);
    } else {
      this._models[model] = { ...opts };
      if (!this._models[model].timeoutMs) this._models[model].timeoutMs = 30000;
    }
  }

  /**
   * Register an alias (e.g. gpt-4-turbo -> gpt-4o).
   */
  alias(name, canonical) {
    this._aliases[name] = canonical;
  }

  /**
   * Resolve a model name to provider config.
   * @returns {{provider:string, adapter:string, timeoutMs:number}}
   */
  resolve(model) {
    const canonical = this._aliases[model] || model;
    const entry = this._models[canonical];
    if (!entry) {
      const err = new Error(`Unknown model: ${model}`);
      err.code = 'MODEL_NOT_FOUND';
      err.availableModels = Object.keys(this._models);
      throw err;
    }
    return entry;
  }

  get availableModels() {
    return Object.keys(this._models);
  }

  /**
   * Resolve collision when multiple providers serve the same model name.
   */
  _resolveCollision(model, options) {
    if (options.length === 0) throw new Error(`No providers for model: ${model}`);
    if (options.length === 1) return { ...options[0], timeoutMs: options[0].timeoutMs || 30000 };

    if (this._tiebreaker === 'latency') {
      return { ...options.sort((a, b) => (a.timeoutMs || 30000) - (b.timeoutMs || 30000))[0], timeoutMs: undefined };
    }
    // Default: cost — pick first (assumed cheapest)
    return { ...options[0], timeoutMs: options[0].timeoutMs || 30000 };
  }
}

module.exports = ModelMap;
