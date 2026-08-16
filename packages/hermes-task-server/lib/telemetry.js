'use strict';

/**
 * telemetry.js — aggregate Hermes task-cache run records into operational stats.
 *
 * Zero-dependency. `aggregate(records, opts)` filters a window over
 * `created_at`, then computes success rate, exit-code/provider/model
 * breakdowns, tool/api call totals from digests, duration stats (incl. p95)
 * and a ROUGH cost estimate.
 *
 * Cost estimate caveat: the task cache stores no token counts, so costs are
 * order-of-magnitude blended estimates from a per-model USD/1k-calls rate
 * table. Every result is flagged `estimate: true` — never treat it as billing.
 */

// Rough USD per 1k API calls (input+output blended, ~1-2k tokens per call).
// Cache lacks token counts — these are directional, not billing-grade.
const MODEL_RATES = {
  'gemini-3.1-flash-lite': 0.05,
  'gemini-2.5-flash-lite': 0.05,
  'gemini-2.5-flash': 0.08,
  'gemini-2.5-pro': 0.6,
  'gemini-2.0-flash': 0.08,
};

// Provider-level fallbacks when the exact model is unknown to MODEL_RATES.
const PROVIDER_RATES = {
  gemini: 0.1,
  opencode: 0.02, // local/free-tier routing — near zero
  openai: 0.3,
  anthropic: 0.6,
  default: 0.05,
};

/** Rough USD cost for one run record, from digest.api_call_count. 0 when no digest. */
function estimateCost(record) {
  const calls = (record && record.digest && record.digest.api_call_count) || 0;
  if (!calls) return 0;
  const model = String(record.model || '').toLowerCase();
  const provider = String(record.provider || '').toLowerCase();
  const rate = MODEL_RATES[model] ?? PROVIDER_RATES[provider] ?? PROVIDER_RATES.default;
  return round4((calls / 1000) * rate);
}

/** 95th percentile of a numeric array; 0 when empty. */
function p95(values) {
  const nums = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const idx = Math.max(0, Math.ceil(0.95 * nums.length) - 1);
  return nums[idx];
}

function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function inWindow(record, opts) {
  if (!record.created_at) return true;
  const ts = new Date(record.created_at).getTime();
  if (Number.isNaN(ts)) return true;
  if (opts.since && ts < new Date(opts.since).getTime()) return false;
  if (opts.until && ts > new Date(opts.until).getTime()) return false;
  return true;
}

function sortedCounts(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/**
 * Aggregate run records into telemetry.
 *
 * @param {Array<object>} records  Raw run records from the task cache.
 * @param {object} [opts]          { since, until } ISO-8601 window filters.
 * @returns {object}  { window, runs, success_rate, exit_code_breakdown,
 *   provider_breakdown, model_breakdown, tool_usage,
 *   duration_ms: {total, avg, p95}, estimated_cost_usd, estimate }
 */
function aggregate(records, opts = {}) {
  const rows = (Array.isArray(records) ? records : []).filter((r) => inWindow(r, opts));
  const dur = [];
  let success = 0;
  let toolCalls = 0;
  let apiCalls = 0;
  let messages = 0;
  let withDigest = 0;
  let cost = 0;
  const byExit = {};
  const byProvider = {};
  const byModel = {};
  const tools = {};
  let earliest = null;
  let latest = null;

  for (const r of rows) {
    if (r.created_at) {
      if (!earliest || r.created_at < earliest) earliest = r.created_at;
      if (!latest || r.created_at > latest) latest = r.created_at;
    }
    if (r.exit_code === 0 || r.exit_code == null) success++;
    const exit = r.exit_code == null ? 'null' : String(r.exit_code);
    byExit[exit] = (byExit[exit] || 0) + 1;
    byProvider[r.provider || 'unknown'] = (byProvider[r.provider || 'unknown'] || 0) + 1;
    byModel[r.model || 'unknown'] = (byModel[r.model || 'unknown'] || 0) + 1;
    if (Number.isFinite(r.duration_ms) && r.duration_ms >= 0) dur.push(r.duration_ms);
    if (r.digest) {
      withDigest++;
      toolCalls += r.digest.tool_call_count || 0;
      apiCalls += r.digest.api_call_count || 0;
      messages += r.digest.message_count || 0;
      for (const t of r.digest.tools_used || []) {
        tools[String(t)] = (tools[String(t)] || 0) + 1;
      }
    }
    cost += estimateCost(r);
  }

  const totalDur = dur.reduce((a, b) => a + b, 0);
  const toolUsage = {
    tool_calls: toolCalls,
    api_calls: apiCalls,
    messages,
    with_digest: withDigest,
    tools: Object.fromEntries(sortedCounts(tools)),
  };

  return {
    window: { since: opts.since || null, until: opts.until || null, earliest, latest },
    runs: rows.length,
    success_rate: rows.length ? Math.round((success / rows.length) * 1000) / 1000 : 0,
    exit_code_breakdown: Object.fromEntries(sortedCounts(byExit)),
    provider_breakdown: Object.fromEntries(sortedCounts(byProvider)),
    model_breakdown: Object.fromEntries(sortedCounts(byModel)),
    tool_usage: toolUsage,
    duration_ms: {
      total: Math.round(totalDur * 10) / 10,
      avg: dur.length ? round1(totalDur / dur.length) : 0,
      p95: p95(dur),
    },
    estimated_cost_usd: round4(cost),
    estimate: true, // rough: cache has no token counts
  };
}

module.exports = { aggregate, estimateCost, p95 };
