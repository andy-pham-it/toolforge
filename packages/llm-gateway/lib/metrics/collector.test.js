'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const MetricsCollector = require('./collector');

describe('MetricsCollector', () => {
  it('starts empty', () => {
    const m = new MetricsCollector();
    assert.ok(m.isEmpty);
  });

  it('increments a counter', () => {
    const m = new MetricsCollector();
    m.increment('test_requests', { model: 'm1', status: 'ok' });
    m.increment('test_requests', { model: 'm1', status: 'ok' });
    m.increment('test_requests', { model: 'm2', status: 'ok' });
    assert.ok(!m.isEmpty);

    const out = m.formatPrometheus();
    assert.ok(out.includes('test_requests'));
    assert.ok(out.includes('model="m1",status="ok"'));
    assert.ok(out.includes('2'));
    assert.ok(out.includes('model="m2",status="ok"'));
    assert.ok(out.includes('1'));
  });

  it('records gauge', () => {
    const m = new MetricsCollector();
    m.setGauge('test_state', 1, { provider: 'gemini' });
    m.setGauge('test_state', 0, { provider: 'openai' });
    const out = m.formatPrometheus();
    assert.ok(out.includes('test_state{provider="gemini"} 1'));
    assert.ok(out.includes('test_state{provider="openai"} 0'));
  });

  it('records duration summary', () => {
    const m = new MetricsCollector();
    m.observeDuration('gpt-4', 'openai', 0.5);
    m.observeDuration('gpt-4', 'openai', 1.5);
    m.observeDuration('gemini-pro', 'gemini', 2.0);
    const out = m.formatPrometheus();
    assert.ok(out.includes('llm_request_duration_seconds_count 3'));
    assert.ok(out.includes('llm_request_duration_seconds_sum'));
    assert.ok(out.includes('_max'));
    assert.ok(out.includes('model="gpt-4",provider="openai"'));
    assert.ok(out.includes('model="gemini-pro",provider="gemini"'));
  });

  it('records tokens', () => {
    const m = new MetricsCollector();
    m.recordTokens('gpt-4', 100, 20);
    const out = m.formatPrometheus();
    assert.ok(out.includes('llm_tokens_total'));
    assert.ok(out.includes('type="prompt"'));
    assert.ok(out.includes('type="completion"'));
    assert.ok(out.includes('100') && out.includes('20'));
  });

  it('records cost', () => {
    const m = new MetricsCollector();
    m.recordCost('gpt-4', 0.005);
    m.recordCost('gpt-4', 0.003);
    const out = m.formatPrometheus();
    assert.ok(out.includes('llm_cost_usd_total'));
    assert.ok(out.includes('0.008'));
  });

  it('reset clears all', () => {
    const m = new MetricsCollector();
    m.increment('r');
    m.observeDuration('m', 'p', 1);
    m.reset();
    assert.ok(m.isEmpty);
  });
});
