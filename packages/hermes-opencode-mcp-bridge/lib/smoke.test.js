'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const pkg = require('../package.json');
const BIN = path.join(__dirname, 'index.js');

function spawnBridge() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-smoke-'));
  const configFile = path.join(dir, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify({ session_file: path.join(dir, 'sessions.json') }));
  const child = spawn(process.execPath, [BIN], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HERMES_OPENCODE_CONFIG: configFile },
  });
  return child;
}

function collectStdout(child) {
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { buf += chunk; });
  return () => buf;
}

function waitForLine(getBuf, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      for (const line of getBuf().split('\n')) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (predicate(msg)) {
            clearInterval(timer);
            return resolve(msg);
          }
        } catch { /* partial line */ }
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('timed out waiting for MCP response; buffer: ' + getBuf()));
      }
    }, 25);
  });
}

test('smoke: real bin responds to MCP initialize with correct name/version', async (t) => {
  const child = spawnBridge();
  t.after(() => { child.kill(); });
  const getBuf = collectStdout(child);
  const stderr = [];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c) => stderr.push(c));

  const respP = waitForLine(getBuf, (m) => m.id === 1 && m.result);
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '0.0.1' },
    },
  }) + '\n');

  const resp = await respP;
  assert.strictEqual(resp.result.serverInfo.name, 'hermes-opencode-bridge');
  assert.strictEqual(resp.result.serverInfo.version, pkg.version, 'version must match package.json');
});

test('smoke: tools/list returns all 5 registered tools', async (t) => {
  const child = spawnBridge();
  t.after(() => { child.kill(); });
  const getBuf = collectStdout(child);

  const initP = waitForLine(getBuf, (m) => m.id === 1 && m.result);
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.0.1' } },
  }) + '\n');
  await initP;

  const toolsP = waitForLine(getBuf, (m) => m.id === 2 && m.result);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  const tools = await toolsP;
  const names = tools.result.tools.map((t2) => t2.name).sort();
  assert.deepStrictEqual(names, ['opencode_read', 'opencode_run', 'opencode_set_models', 'opencode_status', 'opencode_task']);
});

test('smoke: unknown input key (dir) is rejected with error', async (t) => {
  const child = spawnBridge();
  t.after(() => { child.kill(); });
  const getBuf = collectStdout(child);

  const initP = waitForLine(getBuf, (m) => m.id === 1 && m.result);
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.0.1' } },
  }) + '\n');
  await initP;

  const callP = waitForLine(getBuf, (m) => m.id === 2 && (m.result || m.error));
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'opencode_run', arguments: { task: 'noop', dir: '/tmp/other' } },
  }) + '\n');
  const call = await callP;
  assert.ok(call.error || call.result.isError, 'expected tools/call to fail on unknown key');
  const text = JSON.stringify(call.error || call.result);
  assert.match(text, /Unrecognized key|Invalid arguments|dir/i);
});
