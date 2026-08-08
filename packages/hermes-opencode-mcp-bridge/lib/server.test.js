'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { createServer, startServer } = require('./server');

test('createServer registers 5 tools', () => {
  const srv = createServer();
  const names = Object.keys(srv._registeredTools);
  assert.deepStrictEqual(names.sort(), ['opencode_read', 'opencode_run', 'opencode_set_models', 'opencode_status', 'opencode_task']);
});

test('createServer throws on bad tool name', () => {
  assert.throws(() => createServer({ tools: ['opencode_bogus'] }), /unknown tool/i);
});

test('createServer registers only requested tools', () => {
  const srv = createServer({ tools: ['opencode_run'] });
  assert.deepStrictEqual(Object.keys(srv._registeredTools), ['opencode_run']);
});
