'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const CostLoggerStage = require('./cost-logger');

describe('CostLoggerStage', () => {
  it('computes cost from usage', async () => {
    const stage = new CostLoggerStage();
    const ctx = {
      model: 'gpt-4o',
      response: { content: 'hello', usage: { promptTokens: 100, completionTokens: 50, costUsd: 0 } },
      cost: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
    };
    await stage.execute(ctx, async () => {});
    assert.ok(ctx.cost.costUsd > 0);
    assert.strictEqual(ctx.cost.promptTokens, 100);
    assert.strictEqual(ctx.cost.completionTokens, 50);
  });

  it('skips cost for cached responses', async () => {
    const stage = new CostLoggerStage();
    const ctx = {
      model: 'test',
      cached: true,
      response: { content: 'cached' },
      cost: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
    };
    await stage.execute(ctx, async () => {});
    assert.strictEqual(ctx.cost.costUsd, 0);
  });

  it('wraps stream for cost logging', async () => {
    const stage = new CostLoggerStage();
    const ctx = {
      stream: true,
      model: 'gpt-4o',
      responseStream: (async function* () {
        yield { content: 'hello ', finish_reason: null };
        yield { content: 'world', finish_reason: 'stop' };
      })(),
      cost: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
    };
    await stage.execute(ctx, async () => {});

    // Consume the wrapped stream
    const chunks = [];
    for await (const chunk of ctx.responseStream) {
      chunks.push(chunk);
    }
    assert.strictEqual(chunks.length, 2);
    // Cost should be set after stream consumption
    assert.ok(ctx.cost.completionTokens > 0);
    assert.ok(ctx.cost.costUsd > 0);
  });
});
