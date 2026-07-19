'use strict';

class Pipeline {
  constructor(stages = []) {
    /** @type {Array<import('./stage')>} */
    this._stages = stages;
    /** @type {Set<string>} request IDs currently executing */
    this._inflight = new Set();
  }

  use(stage) {
    this._stages.push(stage);
    return this;
  }

  /**
   * Execute the pipeline for a given context.
   * Handles sync, streaming, and dryRun modes.
   *
   * @param {import('./types').PipelineContext} ctx
   * @returns {Promise<import('./types').ChatResponse|AsyncIterable>}
   */
  async execute(ctx) {
    this._inflight.add(ctx.requestId);
    try {
      let i = 0;
      const next = async () => {
        if (ctx.error) return;
        if (i >= this._stages.length) return;
        const stage = this._stages[i++];
        if (ctx.cancelled) return;
        await stage.execute(ctx, next);
      };

      if (ctx.dryRun) {
        await next();
        return { ...ctx.cost, model: ctx.model, provider: ctx.provider, cacheStatus: ctx.cached ? 'hit' : 'miss' };
      }

      if (ctx.stream) {
        await next();
        // ProviderStage sets ctx.responseStream — wrap with cost logging on completion
        return ctx.responseStream;
      }

      // Sync path
      await next();
      if (ctx.error) throw ctx.error;
      if (ctx.cached) return ctx.response;
      return ctx.response;
    } finally {
      this._inflight.delete(ctx.requestId);
    }
  }

  /** Number of requests currently executing */
  get inflightCount() {
    return this._inflight.size;
  }

  /** Wait until in-flight count reaches 0, with timeout */
  async drain(timeoutMs = 30000) {
    const start = Date.now();
    while (this._inflight.size > 0) {
      if (Date.now() - start > timeoutMs) break;
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

module.exports = Pipeline;
