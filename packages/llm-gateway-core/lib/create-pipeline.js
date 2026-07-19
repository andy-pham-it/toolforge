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
 * Create a Pipeline-of-Stages LLM gateway.
 *
 * Returns an object with `chat(req)`, `chatStream(req)`, and `health()` methods.
 * All pipeline stages are assembled from config — no hard dependencies.
 *
 * @param {object} config
 * @param {object} [config.models] — model mapping config
 * @param {object} [config.fallbacks] — fallback chain config
 * @param {object} [config.keys] — API key -> tenant mapping
 * @param {object} [config.rateLimits] — per-tenant rate limit config
 * @param {object} [config.keyPools] — { [provider]: [key1, key2] }
 * @param {object} [config.pricing] — override pricing table
 * @param {object} [config.circuitBreaker] — { threshold, cooldownMs, halfOpenMaxRequests }
 * @param {object} [config.cache] — { store: MemoryStore }
 * @param {Function} config.createAdapter — REQUIRED factory: (provider, apiKey) => adapter instance
 * @param {string[]} [config.stages] — ordered stage names (default: full pipeline)
 * @param {boolean} [config.logPrompts] — log message content (PII risk)
 * @returns {{ chat: Function, chatStream: Function, health: Function }}
 */
function createPipeline(config = {}) {
  if (!config.createAdapter) {
    throw new Error(
      'createPipeline requires a createAdapter factory. ' +
      'Pass createAdapter(provider, apiKey) => adapter instance with chat() [and optionally chatStream()].'
    );
  }

  const pipeline = new Pipeline();
  const modelMap = config.models ? new ModelMap(config) : new ModelMap();
  const fallbackChain = new FallbackChain(config);
  const circuitBreakerState = new CircuitBreakerState(config.circuitBreaker);
  const cacheStore = config.cache?.store || new MemoryStore();

  registerStages(pipeline, config, { modelMap, fallbackChain, circuitBreakerState, cacheStore });

  function registerStages(pipeline, config, deps) {
    const builders = {
      auth: () => new AuthStage({ keys: config.keys }),
      'rate-limit': () => new RateLimitStage({ buckets: config.rateLimits }),
      cache: () => new CacheStage(deps.cacheStore),
      router: () => {
        const rs = new RouterStage({
          modelMap: deps.modelMap,
          fallbackChain: deps.fallbackChain,
          createAdapter: config.createAdapter,
        });
        rs.setCircuitBreaker(deps.circuitBreakerState);
        return rs;
      },
      'key-rotator': () => new KeyRotatorStage({ keyPools: config.keyPools }),
      provider: () => new ProviderStage(),
      'circuit-breaker': () => new CircuitBreakerStage(deps.circuitBreakerState),
      'cost-logger': () => new CostLoggerStage({ logPrompts: config.logPrompts, pricing: config.pricing }),
    };

    const order = config.stages || ['auth', 'rate-limit', 'cache', 'router', 'key-rotator', 'circuit-breaker', 'provider', 'cost-logger'];
    for (const name of order) {
      if (builders[name]) {
        pipeline.use(builders[name]());
      }
    }
  }

  /**
   * Execute a chat request through the pipeline.
   * @param {import('./types').ChatRequest} req
   * @returns {Promise<import('./types').ChatResponse|AsyncIterable>}
   */
  async function chat(req) {
    const ctx = createContext(req, config);
    try {
      return await pipeline.execute(ctx);
    } finally {
      // no-op; context is ephemeral
    }
  }

  /**
   * Execute a streaming chat request through the pipeline.
   * @param {import('./types').ChatRequest} req
   * @returns {AsyncIterable<import('./types').ChatResponse>}
   */
  async function chatStream(req) {
    return chat({ ...req, stream: true });
  }

  /**
   * Create a pipeline context from a request.
   */
  function createContext(req) {
    return {
      model: req.model,
      messages: req.messages,
      stream: req.stream || false,
      dryRun: req.dryRun || false,
      tenant: req.tenant || 'default',
      apiKey: req.apiKey || config.apiKey,
      temperature: req.temperature,
      signal: req.signal,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      responseHeaders: {},
      _startTime: Date.now(),
    };
  }

  /**
   * Health check info.
   */
  function health() {
    return {
      status: 'ok',
      inflight: pipeline.inflightCount,
      models: modelMap.availableModels,
      stages: pipeline._stages.map(s => s.constructor.name),
    };
  }

  return { chat, chatStream, health };
}

module.exports = createPipeline;
