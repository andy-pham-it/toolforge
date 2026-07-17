'use strict';

const Pipeline = require('./pipeline');
const Stage = require('./stage');
const { Gateway, createGateway } = require('./gateway');
const LLMClient = require('./llm');
const ModelMap = require('./router/model-map');
const FallbackChain = require('./router/fallback-chain');
const MemoryStore = require('./cache/memory-store');

// Stage exports for custom pipeline composition
const AuthStage = require('./stages/auth');
const { RateLimitStage } = require('./stages/rate-limit');
const CacheStage = require('./stages/cache');
const RouterStage = require('./stages/router');
const KeyRotatorStage = require('./stages/key-rotator');
const ProviderStage = require('./stages/provider');
const { CircuitBreakerStage, CircuitBreakerState } = require('./stages/circuit-breaker');
const CostLoggerStage = require('./stages/cost-logger');

module.exports = {
  // High-level API
  Gateway,
  createGateway,
  LLMClient,

  // Pipeline primitives
  Pipeline,
  Stage,

  // Router
  ModelMap,
  FallbackChain,

  // Cache
  MemoryStore,

  // Individual stages (for custom assembly)
  AuthStage,
  RateLimitStage,
  CacheStage,
  RouterStage,
  KeyRotatorStage,
  ProviderStage,
  CircuitBreakerStage,
  CircuitBreakerState,
  CostLoggerStage,
};
