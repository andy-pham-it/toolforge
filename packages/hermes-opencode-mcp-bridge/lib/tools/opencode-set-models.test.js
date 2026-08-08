'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const configMod = require('../config');
const { opencodeSetModels } = require('./opencode-set-models');

function fakeEnv(t, body = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-models-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(body));
  const old = process.env.HERMES_OPENCODE_CONFIG;
  process.env.HERMES_OPENCODE_CONFIG = file;
  t.after(() => {
    if (old === undefined) delete process.env.HERMES_OPENCODE_CONFIG;
    else process.env.HERMES_OPENCODE_CONFIG = old;
  });
  return file;
}

test('list returns current models', async (t) => {
  fakeEnv(t, { models: ['opencode/a', 'opencode/b'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'list' } });
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(res.data.models, ['opencode/a', 'opencode/b']);
});

test('set replaces models and persists', async (t) => {
  const file = fakeEnv(t, { models: ['opencode/a'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'set', models: ['opencode/c'] } });
  assert.strictEqual(res.status, 'success');
  assert.deepStrictEqual(res.data.models, ['opencode/c']);
  const reloaded = configMod.loadConfig(file);
  assert.deepStrictEqual(reloaded.models, ['opencode/c']);
});

test('add appends unique models', async (t) => {
  fakeEnv(t, { models: ['opencode/a'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'add', models: ['opencode/b', 'opencode/a'] } });
  assert.deepStrictEqual(res.data.models, ['opencode/a', 'opencode/b']);
});

test('remove drops models', async (t) => {
  fakeEnv(t, { models: ['opencode/a', 'opencode/b'] });
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'remove', models: ['opencode/a'] } });
  assert.deepStrictEqual(res.data.models, ['opencode/b']);
});

test('set without models is INVALID_ARGS', async (t) => {
  fakeEnv(t, {});
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'set' } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'INVALID_ARGS');
});

test('unknown action is INVALID_ARGS', async (t) => {
  fakeEnv(t, {});
  const cfg = configMod.loadConfig();
  const res = await opencodeSetModels({ config: cfg, args: { action: 'explode' } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'INVALID_ARGS');
});
