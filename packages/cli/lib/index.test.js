'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, Spinner, loadConfig } = require('./index.js');

test('parseArgs: boolean flags and positionals', () => {
  const { flags, positionals } = parseArgs(['run', '--verbose', 'file.txt'], {
    flags: { verbose: { type: 'boolean' } },
  });
  assert.strictEqual(flags.verbose, true);
  assert.deepStrictEqual(positionals, ['run', 'file.txt']);
});

test('parseArgs: --key=value and --key value', () => {
  const spec = { flags: { output: { type: 'string' }, count: { type: 'string' } } };
  const a = parseArgs(['--output=out.md'], spec);
  assert.strictEqual(a.values.output, 'out.md');
  const b = parseArgs(['--count', '5'], spec);
  assert.strictEqual(b.values.count, '5');
});

test('parseArgs: short flags and clusters', () => {
  const spec = { flags: { verbose: { type: 'boolean', short: 'v' }, output: { type: 'string', short: 'o' } } };
  const a = parseArgs(['-v'], spec);
  assert.strictEqual(a.flags.verbose, true);
  const b = parseArgs(['-vo', 'x.md'], spec);
  assert.strictEqual(b.flags.verbose, true);
  assert.strictEqual(b.values.output, 'x.md');
  const c = parseArgs(['-oout.md'], spec);
  assert.strictEqual(c.values.output, 'out.md');
});

test('parseArgs: -- terminator', () => {
  const { flags, positionals } = parseArgs(['--', '--not-a-flag'], {});
  assert.deepStrictEqual(positionals, ['--not-a-flag']);
  assert.deepStrictEqual(flags, {});
});

test('parseArgs: negative numbers are positionals, not flag clusters', () => {
  const { flags, positionals } = parseArgs(['calc', '-5', '-1.5', '--', '-x'], {});
  assert.deepStrictEqual(positionals, ['calc', '-5', '-1.5', '-x']);
  assert.deepStrictEqual(flags, {});
});

test('Spinner: writes frames and stops with final line', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const chunks = [];
    const stream = { write: (s) => chunks.push(s) };
    const spinner = new Spinner({ frames: ['a', 'b'], interval: 5, text: 'working', stream });
    spinner.start();
    assert.strictEqual(spinner.running, true);
    mock.timers.tick(5);
    assert.ok(chunks.some((c) => c.includes('working')));
    spinner.stop('done');
    assert.strictEqual(spinner.running, false);
    assert.strictEqual(chunks[chunks.length - 1], '\rdone\n');
  } finally {
    mock.timers.reset();
  }
});

test('Spinner: update changes text', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const chunks = [];
    const stream = { write: (s) => chunks.push(s) };
    const spinner = new Spinner({ frames: ['a'], interval: 5, text: 'one', stream });
    spinner.start();
    mock.timers.tick(5);
    spinner.update('two');
    mock.timers.tick(5);
    spinner.stop();
    assert.ok(chunks.some((c) => c.includes('two')));
  } finally {
    mock.timers.reset();
  }
});

test('loadConfig: merges defaults, files, env override', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  const fileA = path.join(dir, 'a.json');
  const fileB = path.join(dir, 'b.json');
  fs.writeFileSync(fileA, JSON.stringify({ host: 'localhost', port: 3000 }));
  fs.writeFileSync(fileB, JSON.stringify({ port: 4000 }));
  process.env.TESTCFG_PORT = '5000';
  try {
    const config = loadConfig([fileA, fileB], { envPrefix: 'TESTCFG', defaults: { host: 'default', debug: false } });
    assert.strictEqual(config.host, 'localhost'); // file overrides default
    assert.strictEqual(config.port, 5000); // env overrides file (coerced to number)
    assert.strictEqual(config.debug, false); // default kept
  } finally {
    delete process.env.TESTCFG_PORT;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig: missing files skipped, JS config supported', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  const jsFile = path.join(dir, 'c.cjs');
  fs.writeFileSync(jsFile, 'module.exports = { mode: "js" };');
  try {
    const config = loadConfig([path.join(dir, 'missing.json'), jsFile], { defaults: { mode: 'default' } });
    assert.strictEqual(config.mode, 'js');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});