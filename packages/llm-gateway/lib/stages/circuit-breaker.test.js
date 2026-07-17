'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { CircuitBreakerStage, CircuitBreakerState } = require('./circuit-breaker');

describe('CircuitBreakerState', () => {
  it('starts closed', () => {
    const cb = new CircuitBreakerState({ threshold: 2, cooldownMs: 5000 });
    assert.strictEqual(cb.getState('gemini'), 'closed');
  });

  it('opens after threshold failures', () => {
    const cb = new CircuitBreakerState({ threshold: 2, cooldownMs: 5000 });
    cb.onFailure('gemini');
    cb.onFailure('gemini');
    assert.ok(cb.isOpen('gemini'));
    assert.strictEqual(cb.getState('gemini'), 'open');
  });

  it('allows probe after cooldown', async () => {
    const cb = new CircuitBreakerState({ threshold: 1, cooldownMs: 10 });
    cb.onFailure('gemini');
    assert.ok(cb.isOpen('gemini')); // still open
    await new Promise(r => setTimeout(r, 15));
    assert.strictEqual(cb.isOpen('gemini'), false); // half-open, probe allowed
    cb.onSuccess('gemini');
    assert.strictEqual(cb.getState('gemini'), 'closed');
  });
});

describe('CircuitBreakerStage', () => {
  it('records provider failure', async () => {
    const state = new CircuitBreakerState({ threshold: 1, cooldownMs: 50000 });
    const stage = new CircuitBreakerStage(state);
    const ctx = { provider: 'gemini', error: new Error('fail') };
    await stage.execute(ctx, async () => {});
    assert.ok(state.isOpen('gemini'));
  });

  it('records provider success', async () => {
    const state = new CircuitBreakerState({ threshold: 1, cooldownMs: 50000 });
    const stage = new CircuitBreakerStage(state);
    const ctx = { provider: 'gemini' };
    await stage.execute(ctx, async () => {});
    assert.strictEqual(state.isOpen('gemini'), false);
  });
});
