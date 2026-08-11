'use strict';

const { loadConfig } = require('./config');
const { pickAliveProvider, classifyCapability, validateProvider, defaultModelFor } = require('./provider-selector');
const { readAuth, markExhausted } = require('./credential-store');
const { runHermesChat, classifyError, buildArgv } = require('./runner');
const { runHermesTask, runHermesTaskDetail } = require('./server');

/**
 * Minimal JSON-RPC 2.0 stdio MCP server shim (zero deps).
 * Handles initialize, tools/list, tools/call for `hermes_task`.
 * createServer(config) -> { start(), handleMessage(line) }.
 * For full MCP client interop use @andy-toolforge/mcp discovery (mcp-tools.js).
 */
function createServer(config = {}) {
  const cfg = loadConfig(config);
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

  const detailHandler = async (args) => {
    try {
      const result = await runHermesTaskDetail(args, cfg);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: result.ok === false,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'unknown', error_detail: String(err && err.message || err) }) }],
        isError: true,
      };
    }
  };

  const handler = async (args) => {
    try {
      const result = await runHermesTask(args, cfg);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: result.ok === false,
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'unknown', error_detail: String(err && err.message || err) }) }],
        isError: true,
      };
    }
  };

  let started = false;

  async function handleMessage(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return null;
    }
    if (!msg || typeof msg.id === 'undefined') return null;
    const respond = (result) => JSON.stringify({ jsonrpc: '2.0', id: msg.id, result });
    const respondError = (code, message) => JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code, message } });

    switch (msg.method) {
      case 'initialize':
        return respond({ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'hermes-task-server', version: '0.1.0' } });
      case 'notifications/initialized':
        return null; // no response expected
      case 'tools/list':
        return respond({ tools: [definition, detailDefinition] });
      case 'tools/call': {
        const params = msg.params || {};
        if (params.name === 'hermes_task') {
          const result = await handler(params.arguments || {});
          return respond(result);
        }
        if (params.name === 'hermes_task_detail') {
          const result = await detailHandler(params.arguments || {});
          return respond(result);
        }
        return respondError(-32602, `unknown tool: ${params.name}`);
      }
      default:
        return respondError(-32601, `method not found: ${msg.method}`);
    }
  }

  function start() {
    if (started) return;
    started = true;
    process.stdin.setEncoding('utf8');
    let buf = '';
    process.stdin.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        handleMessage(line).then((resp) => {
          if (resp) process.stdout.write(resp + '\n');
        });
      }
    });
    process.stdin.on('end', () => process.exit(0));
  }

  return { start, handleMessage, definition, detailDefinition, handler, detailHandler };
}

module.exports = {
  createServer,
  runHermesTask,
  runHermesTaskDetail,
  pickAliveProvider,
  classifyCapability,
  validateProvider,
  defaultModelFor,
  readAuth,
  markExhausted,
  runHermesChat,
  classifyError,
  buildArgv,
  loadConfig,
};
