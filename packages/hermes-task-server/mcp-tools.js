'use strict';

// mcp-tools.js — @andy-toolforge/mcp auto-discovery convention.
// Exports function(config) => [{definition, handler}].

const { runHermesTask, runHermesTaskDetail } = require('./lib/server');

const definition = {
  name: 'hermes_task',
  description:
    'Dispatch a one-shot agentic task to the local Hermes Agent CLI using an alive free-tier provider. ' +
    'Returns the final response JSON ({ok, provider, model, result, ...}). Never hangs on fallback retry.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Task prompt to send to Hermes (required)' },
      provider: { type: 'string', description: 'Provider: "auto" (default) or explicit name', default: 'auto' },
      model: { type: 'string', description: 'Explicit model id (defaults to capability map)', default: '' },
      timeout_seconds: { type: 'number', description: 'Timeout in seconds (10-1800)', default: 300 },
      cwd: { type: 'string', description: 'Working directory (must be in cwdAllowlist)', default: '' },
      toolsets: { type: 'string', description: 'Hermes toolsets to enable', default: '' },
      max_turns: { type: 'number', description: 'Max conversation turns', default: 500 },
      output_mode: { type: 'string', enum: ['digest', 'full'], description: 'digest (compact result + stats, default) or full (uncapped result + tool_calls)', default: 'digest' },
    },
    required: ['prompt'],
  },
};

async function handler(llm, args, context = {}) {
  // The mcp host passes tool args directly; config comes from the plugin config.
  const cfg = (module.exports._pluginConfig || {});
  const result = await runHermesTask(args || {}, cfg);
  return result;
}

const detailDefinition = {
  name: 'hermes_task_detail',
  description:
    'Fetch full detail (uncapped result, tool_calls) for a prior hermes_task run from disk cache. ' +
    'Pass task_id and/or session_id. Returns {ok, cached, task_id, session_id, provider, model, result, tool_calls, exit_code, duration_ms}.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Task id from a prior hermes_task response' },
      session_id: { type: 'string', description: 'Hermes session id (used when task_id is unknown or cache miss)' },
      max_bytes: { type: 'number', description: 'Optional cap on result bytes returned', default: 0 },
    },
  },
};

async function detailHandler(llm, args, context = {}) {
  const cfg = (module.exports._pluginConfig || {});
  const result = await runHermesTaskDetail(args || {}, cfg);
  return result;
}

// ---------------------------------------------------------------------------
// Exports — factory pattern for MCP auto-discovery
// ---------------------------------------------------------------------------
module.exports = function (config = {}) {
  module.exports._pluginConfig = config;
  return [
    { definition, handler },
    { definition: detailDefinition, handler: detailHandler },
  ];
};
