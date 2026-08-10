'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const childProcess = require('child_process');

const mcpToolsFactory = require('../mcp-tools');
const { runHermesTask } = require('./server');

function fakeChild({ stdoutData = '', exitCode = 0 } = {}) {
  const child = new EventEmitter();
  child.pid = 11;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  setImmediate(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    child.emit('exit', exitCode, null);
  });
  return child;
}

test('mcp-tools factory: returns [{definition, handler}] with FR-2 schema', () => {
  const tools = mcpToolsFactory({});
  assert.equal(tools.length, 1);
  const { definition, handler } = tools[0];
  assert.equal(typeof handler, 'function');
  assert.equal(definition.name, 'hermes_task');
  assert.equal(definition.inputSchema.type, 'object');
  assert.deepEqual(definition.inputSchema.required, ['prompt']);
  for (const k of ['prompt', 'provider', 'model', 'timeout_seconds', 'cwd', 'toolsets', 'max_turns']) {
    assert.ok(definition.inputSchema.properties[k], `missing param ${k}`);
  }
});

test('mcp-tools handler: dispatches to runHermesTask and returns FR-5 JSON', async () => {
  const mock = test.mock.method(childProcess, 'spawn', (bin, args) => {
    assert.ok(args.includes('--ignore-user-config'));
    return fakeChild({ stdoutData: 'done', exitCode: 0 });
  });
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-task-mcp-'));
  const authPath = path.join(dir, 'auth.json');
  fs.writeFileSync(authPath, JSON.stringify({ credential_pool: { gemini: [{ id: 'g1', last_status: null }] } }));
  try {
    mcpToolsFactory({ authPath });
    const [tool] = mcpToolsFactory({ authPath });
    const result = await tool.handler({}, { prompt: 'hello', provider: 'gemini' });
    assert.equal(result.ok, true);
    assert.equal(result.provider, 'gemini');
  } finally {
    mock.mock.restore();
  }
});
