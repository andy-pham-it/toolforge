export = createPipeline;
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
declare function createPipeline(config?: {
    models?: object;
    fallbacks?: object;
    keys?: object;
    rateLimits?: object;
    keyPools?: object;
    pricing?: object;
    circuitBreaker?: object;
    cache?: object;
    createAdapter: Function;
    stages?: string[];
    logPrompts?: boolean;
}): {
    chat: Function;
    chatStream: Function;
    health: Function;
};
