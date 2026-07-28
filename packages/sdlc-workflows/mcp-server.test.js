'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const SERVER_PATH = path.join(__dirname, 'mcp-server.js');

/**
 * Helper: send a JSON-RPC message to the MCP server and read the response.
 */
function rpcCall(proc, msg) {
  return new Promise((resolve, reject) => {
    const onData = (data) => {
      proc.stdout.removeListener('data', onData);
      try {
        resolve(JSON.parse(data.toString().trim()));
      } catch (e) {
        reject(new Error('Failed to parse response: ' + data.toString()));
      }
    };
    proc.stdout.on('data', onData);
    proc.stdin.write(JSON.stringify(msg) + '\n');
    // Timeout after 5s
    setTimeout(() => {
      proc.stdout.removeListener('data', onData);
      reject(new Error('Timeout waiting for response'));
    }, 5000);
  });
}

describe('MCP Server (mcp-server.js)', () => {
  let proc;

  before(() => {
    proc = spawn(process.execPath, [SERVER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    // Collect stderr for debugging
    proc.stderr.on('data', () => {});
  });

  after(() => {
    if (proc && !proc.killed) {
      proc.kill();
    }
  });

  it('should respond to initialize handshake', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 1);
    assert.ok(resp.result);
    assert.equal(resp.result.protocolVersion, '2024-11-05');
    assert.equal(resp.result.serverInfo.name, '@andy-toolforge/sdlc-workflows');
    assert.ok(resp.result.serverInfo.version);
  });

  it('should list 8 tools via tools/list', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 2);
    assert.ok(resp.result);
    assert.ok(Array.isArray(resp.result.tools));
    assert.equal(resp.result.tools.length, 8);

    const names = resp.result.tools.map(t => t.name).sort();
    assert.deepEqual(names, [
      'sdlc_check_version',
      'sdlc_get_standard',
      'sdlc_get_template',
      'sdlc_list_templates',
      'sdlc_render_template',
      'sdlc_search_skills',
      'sdlc_validate_skill',
      'validate_document',
    ]);
  });

  it('should return tool results on tools/call with valid args', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'sdlc_list_templates', arguments: { category: 'flows' } },
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 3);
    assert.ok(resp.result);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.ok(Array.isArray(parsed.templates.flows));
    assert.ok(parsed.templates.flows.length > 0);
    assert.equal(parsed.totalCount, parsed.templates.flows.length);
  });

  it('should return error on tools/call with missing required args', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'validate_document', arguments: {} },
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 4);
    assert.ok(resp.error);
    // Both documentPath and standard are missing, but the handler
    // throws ToolInputError for the first check
    assert.equal(resp.error.code, -32602);
    assert.ok(resp.error.message);
  });

  it('should return error on tools/call with unknown tool name', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} },
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 5);
    assert.ok(resp.error);
    assert.equal(resp.error.code, -32602);
    assert.ok(resp.error.message.includes('nonexistent_tool'));
  });

  it('should return error on unknown method', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 6,
      method: 'unknown_method',
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 6);
    assert.ok(resp.error);
    assert.equal(resp.error.code, -32601);
    assert.ok(resp.error.message.includes('unknown_method'));
  });

  it('should return error on invalid JSON', async () => {
    // Write raw invalid JSON directly (no JSON.stringify wrapping)
    const resp = await new Promise((resolve, reject) => {
      const onData = (data) => {
        proc.stdout.removeListener('data', onData);
        try { resolve(JSON.parse(data.toString().trim())); }
        catch (e) { reject(e); }
      };
      proc.stdout.on('data', onData);
      proc.stdin.write('not json\n');
      setTimeout(() => {
        proc.stdout.removeListener('data', onData);
        reject(new Error('Timeout'));
      }, 5000);
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, null);
    assert.equal(resp.error.code, -32700);
  });

  it('should handle tools/call for get-template', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'sdlc_get_template', arguments: { templateId: 'prd/agile-prd' } },
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 7);
    assert.ok(resp.result);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.ok(parsed.content);
    assert.ok(parsed.content.includes('PRD'));
    assert.ok(parsed.path);
  });

  it('should handle tools/call for sdlc_search_skills', async () => {
    const resp = await rpcCall(proc, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'sdlc_search_skills', arguments: { query: 'architecture' } },
    });
    assert.equal(resp.jsonrpc, '2.0');
    assert.equal(resp.id, 8);
    assert.ok(resp.result);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.ok(Array.isArray(parsed.results));
    assert.ok(parsed.totalResults >= 1);
    assert.ok(parsed.results.some(r => r.id.includes('arch')));
  });
});
