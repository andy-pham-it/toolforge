'use strict';

const Stage = require('../stage');

// Approximate pricing per model (USD per 1K tokens)
const DEFAULT_PRICING = {
  'gemini-3.1-flash-lite': { input: 0.0001, output: 0.0004 },
  'gemini-3.1-flash':      { input: 0.0003, output: 0.0015 },
  'gpt-4o-mini':           { input: 0.00015, output: 0.0006 },
  'gpt-4o':                { input: 0.0025, output: 0.01 },
  'llama-3.3-70b':         { input: 0.0001, output: 0.0002 },
};

class CostLoggerStage extends Stage {
  /**
   * @param {object} opts
   * @param {boolean} [opts.logPrompts=false]
   * @param {object} [opts.pricing] — override pricing table
   */
  constructor(opts = {}) {
    super('cost-logger');
    this._logPrompts = opts.logPrompts || false;
    this._pricing = { ...DEFAULT_PRICING, ...opts.pricing };
  }

  async execute(ctx, next) {
    await next();

    if (ctx.stream && ctx.responseStream) {
      // Wrap responseStream to compute cost on stream completion
      ctx.responseStream = this._wrapStream(ctx.responseStream, ctx);
      ctx.cost = { promptTokens: 0, completionTokens: 0, costUsd: 0, pending: true };
      return;
    }

    if (!ctx.cached && ctx.response?.usage) {
      ctx.cost = {
        promptTokens: ctx.response.usage.promptTokens || 0,
        completionTokens: ctx.response.usage.completionTokens || 0,
        costUsd: this._computeCost(ctx.model, ctx.response.usage.promptTokens || 0, ctx.response.usage.completionTokens || 0),
      };
    }

    this._log(ctx);
  }

  _computeCost(model, inputTokens, outputTokens) {
    const pricing = this._pricing[model] || { input: 0.001, output: 0.002 };
    return ((inputTokens || 0) / 1000) * pricing.input + ((outputTokens || 0) / 1000) * pricing.output;
  }

  async *_wrapStream(stream, ctx) {
    let outputTokens = 0;
    for await (const chunk of stream) {
      if (chunk.content && !chunk.finish_reason) {
        outputTokens += Math.ceil(chunk.content.length / 4);
      }
      yield chunk;
    }
    // After stream ends, compute and log cost
    ctx.cost = {
      promptTokens: ctx.response?.usage?.promptTokens || 0,
      completionTokens: outputTokens,
      costUsd: this._computeCost(ctx.model, ctx.response?.usage?.promptTokens || 0, outputTokens),
    };
    ctx.finalUsage = { promptTokens: ctx.cost.promptTokens, completionTokens: outputTokens };
    this._log(ctx);
  }

  _log(ctx) {
    const entry = {
      requestId: ctx.requestId,
      tenant: ctx.tenant,
      model: ctx.model,
      provider: ctx.provider,
      promptTokens: ctx.cost?.promptTokens,
      completionTokens: ctx.cost?.completionTokens,
      costUsd: ctx.cost?.costUsd,
      cached: !!ctx.cached,
      durationMs: ctx._durationMs,
      timestamp: new Date().toISOString(),
    };
    if (this._logPrompts) {
      entry.messages = ctx.messages;
      entry.response = ctx.response?.content;
    }
    console.log('[llm-gateway:cost]', JSON.stringify(entry));
  }
}

module.exports = CostLoggerStage;
