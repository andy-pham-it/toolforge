'use strict';

const Pipeline = require('./pipeline');
const AuthStage = require('./stages/auth');
const { RateLimitStage } = require('./stages/rate-limit');
const CacheStage = require('./stages/cache');
const RouterStage = require('./stages/router');
const KeyRotatorStage = require('./stages/key-rotator');
const ProviderStage = require('./stages/provider');
const { CircuitBreakerStage, CircuitBreakerState } = require('./stages/circuit-breaker');
const CostLoggerStage = require('./stages/cost-logger');
const ModelMap = require('./router/model-map');
const FallbackChain = require('./router/fallback-chain');
const MemoryStore = require('./cache/memory-store');

/**
 * @typedef {import('./types').ChatRequest} ChatRequest
 * @typedef {import('./types').ChatResponse} ChatResponse
 */

class Gateway {
  /**
   * @param {object} config
   * @param {object} [config.models] — model mapping config
   * @param {object} [config.fallbacks] — fallback chain config
   * @param {object} [config.keys] — API key -> tenant mapping
   * @param {object} [config.rateLimits] — per-tenant rate limit config
   * @param {object} [config.keyPools] — { [provider]: [key1, key2] }
   * @param {object} [config.pricing] — override pricing table
   * @param {object} [config.circuitBreaker] — { threshold, cooldownMs, halfOpenMaxRequests }
   * @param {object} [config.cache] — { store: MemoryStore }
   * @param {Function} [config.createAdapter] — custom adapter factory
   * @param {string[]} [config.stages] — ordered stage names (default: full pipeline)
   * @param {boolean} [config.logPrompts] — log message content (PII risk)
   * @param {string} [config.apiKey] — default API key
   */
  constructor(config = {}) {
    this._config = config;
    this._pipeline = new Pipeline();
    this._modelMap = config.models ? new ModelMap(config) : new ModelMap();
    this._fallbackChain = new FallbackChain(config);
    this._circuitBreakerState = new CircuitBreakerState(config.circuitBreaker);
    this._adapterFactory = config.createAdapter || this._defaultAdapterFactory;

    this._registerStages(config.stages);
  }

  _defaultAdapterFactory(provider, apiKey) {
    // Lazy-require adapters to avoid forcing core dependency at load time
    const core = require('@andy-toolforge/core');
    if (provider === 'gemini') return new core.GenAIAdapter(apiKey);
    return new core.OpenAIAdapter({ provider, apiKey });
  }

  _registerStages(stageNames) {
    const builders = {
      auth: () => new AuthStage({ keys: this._config.keys }),
      'rate-limit': () => new RateLimitStage({ buckets: this._config.rateLimits }),
      cache: () => new CacheStage(this._config.cache?.store || new MemoryStore()),
      router: () => {
        const rs = new RouterStage({
          modelMap: this._modelMap,
          fallbackChain: this._fallbackChain,
          createAdapter: this._adapterFactory,
        });
        rs.setCircuitBreaker(this._circuitBreakerState);
        return rs;
      },
      'key-rotator': () => new KeyRotatorStage({ keyPools: this._config.keyPools }),
      provider: () => new ProviderStage(),
      'circuit-breaker': () => new CircuitBreakerStage(this._circuitBreakerState),
      'cost-logger': () => new CostLoggerStage({ logPrompts: this._config.logPrompts, pricing: this._config.pricing }),
    };

    const order = stageNames || ['auth', 'rate-limit', 'cache', 'router', 'key-rotator', 'circuit-breaker', 'provider', 'cost-logger'];
    for (const name of order) {
      if (builders[name]) {
        this._pipeline.use(builders[name]());
      }
    }
  }

  /**
   * Execute a chat request through the pipeline.
   * @param {ChatRequest} req
   * @returns {Promise<ChatResponse|AsyncIterable>}
   */
  async chat(req) {
    const ctx = {
      model: req.model,
      messages: req.messages,
      stream: req.stream || false,
      dryRun: req.dryRun || false,
      tenant: req.tenant || 'default',
      apiKey: req.apiKey || this._config.apiKey,
      temperature: req.temperature,
      signal: req.signal,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      responseHeaders: {},
      _startTime: Date.now(),
    };

    try {
      const result = await this._pipeline.execute(ctx);
      ctx._durationMs = Date.now() - ctx._startTime;
      return result;
    } catch (err) {
      ctx._durationMs = Date.now() - ctx._startTime;
      throw err;
    }
  }

  /** Health check info */
  get health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      inflight: this._pipeline.inflightCount,
      models: this._modelMap.availableModels,
      stages: this._pipeline._stages.map(s => s.constructor.name),
    };
  }

  /** Wait for in-flight requests to drain */
  async drain(timeoutMs) {
    await this._pipeline.drain(timeoutMs);
  }

  /** Access to the model map for HTTP /v1/models endpoint */
  get modelMap() {
    return this._modelMap;
  }
}

/**
 * Create a Gateway instance from config.
 * @param {object} config
 * @returns {Gateway}
 */
function createGateway(config) {
  return new Gateway(config);
}

module.exports = { Gateway, createGateway };
