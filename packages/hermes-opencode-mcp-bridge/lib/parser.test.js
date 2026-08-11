'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseOpenCodeOutput, MAX_DIFF_BYTES, MAX_TOOL_CALL_BYTES, MAX_TOOL_IO_BYTES } = require('./parser');

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

test('collects non-edit tool calls into tool_calls', () => {
  const bash = evt('tool', {
    tool: 'bash',
    state: { status: 'completed', isError: false, input: 'ls -la', output: 'total 8\n-rw-r--r-- 1 admin admin 0 Aug 11 10:00 a.txt' },
  });
  const r = parseOpenCodeOutput(bash);
  assert.deepStrictEqual(r.tool_calls, [
    { tool: 'bash', status: 'completed', isError: false, input: 'ls -la', output: 'total 8\n-rw-r--r-- 1 admin admin 0 Aug 11 10:00 a.txt' },
  ]);
  assert.deepStrictEqual(r.files_changed, []);
  assert.strictEqual(r.summary, '');
});

test('captures edit tool events in tool_calls too', () => {
  const edit = evt('tool', {
    tool: 'edit',
    state: {
      status: 'completed',
      metadata: { filediff: { file: '/proj/a.txt', patch: 'p' } },
      input: 'change a.txt',
      output: 'edited /proj/a.txt',
    },
  });
  const r = parseOpenCodeOutput(edit);
  assert.strictEqual(r.tool_calls.length, 1);
  assert.strictEqual(r.tool_calls[0].tool, 'edit');
  assert.strictEqual(r.tool_calls[0].output, 'edited /proj/a.txt');
});

test('flags error tool calls with isError', () => {
  const bad = evt('tool', {
    tool: 'bash',
    state: { status: 'error', isError: true, input: 'rm -rf /', output: 'permission denied' },
  });
  const r = parseOpenCodeOutput(bad);
  assert.strictEqual(r.tool_calls[0].isError, true);
  assert.strictEqual(r.tool_calls[0].status, 'error');
});

test('caps tool input/output at MAX_TOOL_IO_BYTES', () => {
  const big = 'y'.repeat(MAX_TOOL_IO_BYTES + 500);
  const bash = evt('tool', {
    tool: 'bash',
    state: { status: 'completed', input: big, output: big },
  });
  const r = parseOpenCodeOutput(bash);
  assert.ok(r.tool_calls[0].input.length <= MAX_TOOL_IO_BYTES + 100);
  assert.match(r.tool_calls[0].input, /truncated/);
  assert.ok(r.tool_calls[0].output.length <= MAX_TOOL_IO_BYTES + 100);
});

test('caps total tool_calls at MAX_TOOL_CALL_BYTES by dropping tail entries', () => {
  const lines = [];
  for (let i = 0; i < 10; i += 1) {
    lines.push(evt('tool', {
      tool: 'bash',
      state: { status: 'completed', input: 'cmd', output: 'x'.repeat(20 * 1024) },
    }));
  }
  const r = parseOpenCodeOutput(lines.join('\n'));
  assert.ok(r.tool_calls.length > 0);
  assert.ok(r.tool_calls.length < 10);
  assert.ok(JSON.stringify(r.tool_calls).length <= MAX_TOOL_CALL_BYTES);
});
