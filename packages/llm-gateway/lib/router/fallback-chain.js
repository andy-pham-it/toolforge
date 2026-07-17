'use strict';

class FallbackChain {
  /**
   * @param {object} [config={}]
   * @param {Object<string, string[]>} [config.fallbacks] — model -> [fallback model names]
   */
  constructor(config = {}) {
    this._chains = config.fallbacks || {};
  }

  /**
   * Get fallback models for a given model name.
   * @param {string} model
   * @returns {string[]}
   */
  getFallbacks(model) {
    return this._chains[model] || [];
  }

  /**
   * Register a fallback chain for a model.
   * @param {string} model
   * @param {string[]} fallbacks
   */
  set(model, fallbacks) {
    this._chains[model] = fallbacks;
  }
}

module.exports = FallbackChain;
