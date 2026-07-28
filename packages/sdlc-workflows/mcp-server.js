#!/usr/bin/env node
'use strict';

/**
 * @andy-toolforge/sdlc-workflows MCP server.
 *
 * Lightweight stdio MCP server exposing only SDLC document-generation tools.
 * No LLM/API key required — all tools are file-based (read templates,
 * validate docs, render markdown, search skills).
 *
 * Usage:
 *   npx @andy-toolforge/sdlc-workflows
 *
 * In opencode.jsonc:
 *   "sdlc-workflows": {
 *     "type": "local",
 *     "command": ["npx", "@andy-toolforge/sdlc-workflows"],
 *     "enabled": true
 *   }
 */

const readline = require('readline');
const pkg = require('./package.json');
const loadTools = require('./mcp-tools');

// --debug flag: enable per-call duration logging
const DEBUG = process.argv.includes('--debug');

// ---------------------------------------------------------------------------
// Tools — loaded from mcp-tools/ (no LLM, no API key)
// ---------------------------------------------------------------------------
const tools = {};

function registerTools() {
  const toolList = loadTools();
  if (!Array.isArray(toolList)) return;

  for (const tool of toolList) {
    const name = tool.definition?.name;
    if (!name || typeof tool.handler !== 'function') continue;
    if (tools[name]) {
      console.warn(`[sdlc-workflows] Duplicate tool "${name}" — skipping`);
      continue;
    }
    tools[name] = tool;
  }
}

registerTools();

// ---------------------------------------------------------------------------
// JSON-RPC over stdin/stdout
// ---------------------------------------------------------------------------

/** Return tool definitions for tools/list */
function getToolList() {
  return Object.values(tools).map(t => t.definition);
}

/** Handle a single JSON-RPC request */
async function handle(msg) {
  if (!msg || typeof msg === 'string') {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
  }

  const { id, method, params } = msg;

  if (!method) {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request: method required' } };
  }

  // MCP protocol notifications — no response
  if (method.startsWith('notifications/')) {
    return null;
  }

  // MCP protocol initialize handshake
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: '@andy-toolforge/sdlc-workflows',
          version: pkg.version,
        },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: getToolList() },
    };
  }

  if (method === 'tools/call') {
    return handleToolCall(id, params);
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

/** Handle a tools/call request */
async function handleToolCall(id, params) {
  if (!params || !params.name) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: tool name required' } };
  }

  const tool = tools[params.name];
  if (!tool) {
    return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${params.name}` } };
  }

  const start = Date.now();
  try {
    const result = await tool.handler(null, params.arguments || {});
    if (DEBUG) {
      console.error(`[sdlc-workflows] tool ${params.name} OK — ${Date.now() - start}ms`);
    }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      },
    };
  } catch (err) {
    if (DEBUG) {
      console.error(`[sdlc-workflows] tool ${params.name} ERROR — ${Date.now() - start}ms: ${err.message}`);
    }
    return {
      jsonrpc: '2.0',
      id,
      error: { code: err.code || -32000, message: err.message, data: err.stack },
    };
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function start() {
  // Log startup to stderr (so it doesn't interfere with stdio JSON-RPC)
  const toolNames = Object.keys(tools);
  console.error(`[sdlc-workflows] MCP server v${pkg.version} started — ${toolNames.length} tools loaded: ${toolNames.join(', ')}`);

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      const resp = await handle(msg);
      if (resp !== null) {
        process.stdout.write(JSON.stringify(resp) + '\n');
      }
    } catch (err) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error', data: err.message },
      }) + '\n');
    }
  }
}

start().catch(err => {
  console.error('[sdlc-workflows] Fatal error:', err);
  process.exit(1);
});
