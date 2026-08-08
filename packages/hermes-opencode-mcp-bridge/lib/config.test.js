'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS, loadConfig, writeConfig, expandHome } = require('./config');

function tmpConfig(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-config-'));
  const file = path.join(dir, 'config.json');
  if (body !== null) fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  return file;
}

test('loadConfig returns defaults when file missing', () => {
  const file = tmpConfig(null);
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.default_agent, DEFAULTS.default_agent);
  assert.strictEqual(cfg.default_model, DEFAULTS.default_model);
  assert.deepStrictEqual(cfg.models, []);
  assert.strictEqual(cfg.opencode_bin, path.join(os.homedir(), '.opencode', 'bin', 'opencode'));
  assert.strictEqual(cfg.session_file, path.join(os.homedir(), '.config', 'hermes-opencode', 'sessions.json'));
});

test('loadConfig merges user config over defaults', () => {
  const file = tmpConfig({ default_agent: 'implementer', session_timeout: 60 });
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.default_agent, 'implementer');
  assert.strictEqual(cfg.session_timeout, 60);
  assert.strictEqual(cfg.default_model, DEFAULTS.default_model);
});

test('loadConfig expands ~ in paths', () => {
  const file = tmpConfig({ opencode_bin: '~/bin/opencode', default_project_dir: '~', session_file: '~/sess.json' });
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.opencode_bin, path.join(os.homedir(), 'bin', 'opencode'));
  assert.strictEqual(cfg.default_project_dir, os.homedir());
  assert.strictEqual(cfg.session_file, path.join(os.homedir(), 'sess.json'));
});

test('loadConfig throws CONFIG_ERROR on bad JSON', () => {
  const file = tmpConfig('{ not json');
  assert.throws(() => loadConfig(file), (err) => err.code === 'CONFIG_ERROR');
});

test('writeConfig persists config and roundtrips', () => {
  const file = tmpConfig(null);
  const cfg = { ...DEFAULTS, default_agent: 'refactor', models: ['a', 'b'] };
  const written = writeConfig(cfg, file);
  assert.strictEqual(written, file);
  const roundtrip = loadConfig(file);
  assert.strictEqual(roundtrip.default_agent, 'refactor');
  assert.deepStrictEqual(roundtrip.models, ['a', 'b']);
  assert.strictEqual(roundtrip.session_file, path.join(os.homedir(), '.config', 'hermes-opencode', 'sessions.json'));
});
