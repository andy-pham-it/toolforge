'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { aggregate, estimateCost, p95 } = require('./telemetry');

function fixture() {
  return [
    {
      task_id: 't1',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      created_at: '2026-08-10T10:00:00.000Z',
      exit_code: 0,
      duration_ms: 1000,
      digest: { tool_call_count: 2, api_call_count: 3, message_count: 5, tools_used: ['bash', 'read'] },
    },
    {
      task_id: 't2',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      created_at: '2026-08-11T10:00:00.000Z',
      exit_code: 1,
      duration_ms: 2000,
      digest: { tool_call_count: 1, api_call_count: 2, message_count: 4, tools_used: ['bash'] },
    },
    {
      task_id: 't3',
      provider: 'opencode',
      model: 'opencode/deepseek-v4-flash-free',
      created_at: '2026-08-12T10:00:00.000Z',
      exit_code: 0,
      duration_ms: 3000,
      digest: { tool_call_count: 4, api_call_count: 6, message_count: 9, tools_used: ['bash', 'grep', 'read'] },
    },
    {
      task_id: 't4',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      created_at: '2026-08-13T10:00:00.000Z',
      exit_code: null, // treated as success (no explicit failure)
      duration_ms: null,
      digest: null,
    },
    {
      task_id: 't5',
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      created_at: '2026-08-14T10:00:00.000Z',
      exit_code: 2,
      duration_ms: 4000,
      digest: null,
    },
  ];
}

test('aggregate: full window — counts, success rate, breakdowns', () => {
  const out = aggregate(fixture());
  assert.equal(out.runs, 5);
  assert.equal(out.success_rate, 0.6); // t1, t3, t4 (null exit counts as success)
  assert.deepEqual(out.exit_code_breakdown, { '0': 2, '1': 1, '2': 1, null: 1 });
  assert.deepEqual(out.provider_breakdown, { gemini: 4, opencode: 1 });
  assert.deepEqual(out.model_breakdown, {
    'gemini-3.1-flash-lite': 3,
    'gemini-2.5-pro': 1,
    'opencode/deepseek-v4-flash-free': 1,
  });
  assert.equal(out.estimate, true);
});

test('aggregate: tool_usage aggregates digests, tolerates missing digest', () => {
  const out = aggregate(fixture());
  assert.equal(out.tool_usage.tool_calls, 7); // 2+1+4
  assert.equal(out.tool_usage.api_calls, 11); // 3+2+6
  assert.equal(out.tool_usage.messages, 18); // 5+4+9
  assert.equal(out.tool_usage.with_digest, 3);
  assert.deepEqual(out.tool_usage.tools, { bash: 3, read: 2, grep: 1 });
});

test('aggregate: duration stats (total, avg, p95) skip null durations', () => {
  const out = aggregate(fixture());
  assert.equal(out.duration_ms.total, 10000); // 1000+2000+3000+4000
  assert.equal(out.duration_ms.avg, 2500);
  assert.equal(out.duration_ms.p95, 4000); // ceil(0.95*4)-1 = 3 → largest
});

test('aggregate: estimated cost sums per-record digest-based estimates', () => {
  const out = aggregate(fixture());
  // per-record round4 then sum: t1: 3/1k*0.05=0.00015→0.0002 ; t2: 2/1k*0.05=0.0001 ; t3: 6/1k*0.02=0.00012→0.0001 ; t4/t5: 0
  assert.equal(out.estimated_cost_usd, 0.0004);
});

test('aggregate: since/until window filters by created_at', () => {
  const out = aggregate(fixture(), { since: '2026-08-11T00:00:00.000Z', until: '2026-08-13T23:59:59.999Z' });
  assert.equal(out.runs, 3); // t2, t3, t4
  assert.equal(out.success_rate, 0.667); // t3 + t4 (null)
  assert.deepEqual(out.provider_breakdown, { gemini: 2, opencode: 1 });
  assert.equal(out.window.since, '2026-08-11T00:00:00.000Z');
  assert.equal(out.window.earliest, '2026-08-11T10:00:00.000Z');
  assert.equal(out.window.latest, '2026-08-13T10:00:00.000Z');
});

test('aggregate: empty input yields zeroed stats', () => {
  const out = aggregate([]);
  assert.equal(out.runs, 0);
  assert.equal(out.success_rate, 0);
  assert.deepEqual(out.duration_ms, { total: 0, avg: 0, p95: 0 });
  assert.equal(out.estimated_cost_usd, 0);
  assert.equal(out.window.earliest, null);
});

test('estimateCost: digest api_call_count × model rate; 0 without digest', () => {
  assert.equal(estimateCost({ model: 'gemini-3.1-flash-lite', digest: { api_call_count: 1000 } }), 0.05);
  assert.equal(estimateCost({ model: 'gemini-2.5-pro', digest: { api_call_count: 1000 } }), 0.6);
  assert.equal(estimateCost({ provider: 'opencode', model: 'opencode/deepseek-v4-flash-free', digest: { api_call_count: 1000 } }), 0.02);
  assert.equal(estimateCost({ model: 'gemini-3.1-flash-lite', digest: null }), 0);
  assert.equal(estimateCost({}), 0);
});

test('estimateCost: unknown model falls back to provider rate', () => {
  assert.equal(estimateCost({ provider: 'anthropic', model: 'some-new-model', digest: { api_call_count: 1000 } }), 0.6);
  assert.equal(estimateCost({ provider: 'weird', model: 'w', digest: { api_call_count: 1000 } }), 0.05);
});

test('p95: 95th percentile helper', () => {
  assert.equal(p95([1, 2, 3, 4]), 4);
  assert.equal(p95([5]), 5);
  assert.equal(p95([]), 0);
  assert.equal(p95([1, -5, null, 'x']), 1); // non-finite filtered out
});
