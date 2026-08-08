'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { opencodeRead } = require('./opencode-read');

function tmpdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hob-read-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('reads a file with content and size', async (t) => {
  const dir = tmpdir(t);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'line1\nline2\n');
  const res = await opencodeRead({ args: { path: path.join(dir, 'a.txt') } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.content, 'line1\nline2');
  assert.strictEqual(res.data.size, 12);
  assert.strictEqual(res.data.is_dir, false);
});

test('truncates long files at max_lines', async (t) => {
  const dir = tmpdir(t);
  const content = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
  fs.writeFileSync(path.join(dir, 'long.txt'), content);
  const res = await opencodeRead({ args: { path: path.join(dir, 'long.txt'), max_lines: 5 } });
  assert.strictEqual(res.data.content.split('\n').filter(Boolean).length, 6);
  assert.match(res.data.content, /truncated at 5 lines/);
});

test('lists directory entries shallow by default', async (t) => {
  const dir = tmpdir(t);
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
  const res = await opencodeRead({ args: { path: dir, depth: 1 } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.is_dir, true);
  const names = res.data.entries.map((e) => e.name).sort();
  assert.deepStrictEqual(names, ['f.txt', 'sub']);
});

test('lists nested entries up to depth', async (t) => {
  const dir = tmpdir(t);
  fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'a', 'b', 'deep.txt'), 'x');
  const res = await opencodeRead({ args: { path: dir, depth: 3 } });
  const names = res.data.entries.map((e) => e.name);
  assert.ok(names.includes('deep.txt'));
});

test('expands ~ in path', async () => {
  const res = await opencodeRead({ args: { path: '~' } });
  assert.strictEqual(res.status, 'success');
  assert.strictEqual(res.data.is_dir, true);
});

test('returns NOT_FOUND for missing path', async () => {
  const res = await opencodeRead({ args: { path: path.join(os.tmpdir(), 'definitely-missing-file-xyz') } });
  assert.strictEqual(res.status, 'error');
  assert.strictEqual(res.error.code, 'NOT_FOUND');
});
