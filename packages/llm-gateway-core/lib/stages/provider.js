'use strict';

const Stage = require('../stage');

class ProviderStage extends Stage {
  constructor() {
    super('provider');
  }

  async execute(ctx, next) {
    if (!ctx._adapterFactory) {
      ctx.error = new Error('No adapter factory — RouterStage must run before ProviderStage');
      ctx.error.code = 'NO_ADAPTER';
      return;
    }

    // Resolve adapter lazily using current apiKey (handles key rotation transparently)
    const adapter = ctx._adapterFactory(ctx.apiKey);

    const opts = {
      model: ctx.model,
      messages: ctx.messages,
      temperature: ctx.temperature,
      signal: ctx.signal,
    };

    if (ctx.stream) {
      // Streaming: adapter returns AsyncIterable chunks
      ctx.responseStream = adapter.chatStream
        ? adapter.chatStream(opts)
        : this._adaptSyncToStream(adapter, opts, ctx.signal);
      await next();
      return;
    }

    // Sync path
    try {
      const result = await adapter.chat(opts);
      ctx.response = result;
      ctx.cost = result.usage || { promptTokens: 0, completionTokens: 0, costUsd: 0 };
    } catch (err) {
      ctx.error = err;
      ctx.error._fallbackTried = false;
    }
    await next();
  }

  /**
   * Fallback: convert sync adapter to streaming-compatible async iterable.
   */
  async *_adaptSyncToStream(adapter, opts, signal) {
    const result = await adapter.chat(opts);
    if (signal?.aborted) return;
    yield { content: result.content, finish_reason: 'stop' };
  }
}

module.exports = ProviderStage;
