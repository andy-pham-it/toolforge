'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseOpenCodeOutput, MAX_DIFF_BYTES } = require('./parser');

function evt(type, extra = {}) {
  return JSON.stringify({ type, sessionID: 'ses_test123', timestamp: Date.now(), part: { type, ...extra } });
}

test('parses session_id from first event', () => {
  const out = [evt('step_start'), evt('text', { text: 'Done.' })].join('\n');
  const r = parseOpenCodeOutput(out);
  assert.strictEqual(r.session_id, 'ses_test123');
});

test('collects files_changed and diff from edit tool events', () => {
  const edit = evt('tool', {
    tool: 'edit',
    state: {
      status: 'completed',
      metadata: { filediff: { file: '/proj/a.txt', patch: 'Index: a.txt\n@@ -1 +1 @@\n-hello\n+world' } },
    },
  });
  const r = parseOpenCodeOutput(edit);
  assert.deepStrictEqual(r.files_changed, ['/proj/a.txt']);
  assert.match(r.diff, /Index: a.txt/);
});

test('dedupes files_changed', () => {
  const mk = () => evt('tool', {
    tool: 'edit',
    state: { status: 'completed', metadata: { filediff: { file: '/proj/a.txt', patch: 'p' } } },
  });
  const r = parseOpenCodeOutput([mk(), mk()].join('\n'));
  assert.deepStrictEqual(r.files_changed, ['/proj/a.txt']);
});

test('builds summary from text events in order', () => {
  const out = [evt('text', { text: 'First' }), evt('text', { text: 'Second' })].join('\n');
  const r = parseOpenCodeOutput(out);
  assert.strictEqual(r.summary, 'First\nSecond');
});

test('skips non-JSON lines', () => {
  const out = ['not json', evt('step_start'), 'more noise'].join('\n');
  const r = parseOpenCodeOutput(out);
  assert.strictEqual(r.session_id, 'ses_test123');
});

test('throws PARSE_ERROR with raw output when nothing parseable', () => {
  assert.throws(() => parseOpenCodeOutput(''), (err) => err.code === 'PARSE_ERROR' && err.raw === '');
  assert.throws(() => parseOpenCodeOutput('\n\n'), (err) => err.code === 'PARSE_ERROR');
});

test('caps diff at MAX_DIFF_BYTES with truncate marker', () => {
  const big = 'x'.repeat(MAX_DIFF_BYTES + 1000);
  const edit = evt('tool', {
    tool: 'edit',
    state: { status: 'completed', metadata: { filediff: { file: '/p/a', patch: big } } },
  });
  const r = parseOpenCodeOutput(edit);
  assert.ok(r.diff.length <= MAX_DIFF_BYTES + 100);
  assert.match(r.diff, /truncated at 200KB/);
});
