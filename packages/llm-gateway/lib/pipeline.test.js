'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const Pipeline = require('./pipeline');
const Stage = require('./stage');

describe('Pipeline', () => {
  it('executes stages in order', async () => {
    const order = [];
    const stage1 = new (class extends Stage {
      async execute(ctx, next) { order.push(1); await next(); }
    })('one');
    const stage2 = new (class extends Stage {
      async execute(ctx, next) { order.push(2); await next(); }
    })('two');
    const pipe = new Pipeline([stage1, stage2]);
    await pipe.execute({ model: 'test', messages: [], requestId: 'r1' });
    assert.deepStrictEqual(order, [1, 2]);
  });

  it('short-circuits when stage does not call next()', async () => {
    let stage2called = false;
    const stage1 = new (class extends Stage {
      async execute(ctx, next) { ctx.response = { content: 'cached' }; ctx.cached = true; }
    })('cache');
    const stage2 = new (class extends Stage {
      async execute(ctx, next) { stage2called = true; await next(); }
    })('provider');
    const pipe = new Pipeline([stage1, stage2]);
    const result = await pipe.execute({ model: 'test', messages: [], requestId: 'r2', cached: true, response: { content: 'cached' } });
    assert.strictEqual(stage2called, false);
  });

  it('propagates error from stage', async () => {
    const stage1 = new (class extends Stage {
      async execute(ctx, next) { ctx.error = new Error('fail'); }
    })('error');
    const pipe = new Pipeline([stage1]);
    await assert.rejects(
      () => pipe.execute({ model: 'test', messages: [], requestId: 'r3' }),
      { message: 'fail' }
    );
  });

  it('tracks in-flight requests', async () => {
    const stage = new (class extends Stage {
      async execute(ctx, next) { await new Promise(r => setTimeout(r, 10)); await next(); }
    })('slow');
    const pipe = new Pipeline([stage]);
    const p1 = pipe.execute({ model: 'test', messages: [], requestId: 'r4', response: { content: 'ok' } });
    assert.strictEqual(pipe.inflightCount, 1);
    await p1;
    assert.strictEqual(pipe.inflightCount, 0);
  });

  it('drain waits for in-flight to complete', async () => {
    const stage = new (class extends Stage {
      async execute(ctx, next) { await new Promise(r => setTimeout(r, 5)); await next(); }
    })('slow');
    const pipe = new Pipeline([stage]);
    const p1 = pipe.execute({ model: 'test', messages: [], requestId: 'r5', response: { content: 'ok' } });
    const drainPromise = pipe.drain(100);
    await p1;
    await drainPromise;
    assert.strictEqual(pipe.inflightCount, 0);
  });

  it('cancelled ctx stops execution', async () => {
    let stage2called = false;
    const stage1 = new (class extends Stage {
      async execute(ctx, next) { ctx.cancelled = true; }
    })('cancel');
    const stage2 = new (class extends Stage {
      async execute(ctx, next) { stage2called = true; await next(); }
    })('after');
    const pipe = new Pipeline([stage1, stage2]);
    const result = { content: 'partial', usage: { promptTokens: 1, completionTokens: 1, costUsd: 0.001 } };
    await pipe.execute({ model: 'test', messages: [], requestId: 'r6', response: result, cached: false });
    assert.strictEqual(stage2called, false);
  });
});

describe('Stage', () => {
  it('requires a name', () => {
    assert.throws(() => new Stage(''), /Stage requires a name/);
  });

  it('passes through by default', async () => {
    const stage = new Stage('passthrough');
    let called = false;
    await stage.execute({}, async () => { called = true; });
    assert.ok(called);
  });
});
