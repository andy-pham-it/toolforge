'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractToolCalls, capText, TRUNCATION_MARKER } = require('./tool-calls');

function sampleExport() {
  return {
    id: '20260811_113818_00d7a6',
    model: 'gemini-3.1-pro',
    message_count: 5,
    tool_call_count: 2,
    messages: [
      { id: 'u1', role: 'user', content: 'search EntitlementService', tool_calls: null, tool_call_id: null },
      {
        id: 'a1', role: 'assistant', content: '',
        tool_calls: [
          { id: 'call_1', call_id: 'call_1', type: 'function', function: { name: 'search_files', arguments: '{"pattern": "EntitlementService"}' } },
        ],
      },
      { id: 't1', role: 'tool', content: '{"total_count": 14}', tool_call_id: 'call_1', tool_name: 'search_files', tool_calls: null },
      {
        id: 'a2', role: 'assistant', content: 'Found it.',
        tool_calls: [
          { id: 'call_2', call_id: 'call_2', type: 'function', function: { name: 'read_file', arguments: '{"path": "src/a.ts"}' } },
        ],
      },
      { id: 't2', role: 'tool', content: 'file content here', tool_call_id: 'call_2', tool_name: 'read_file', tool_calls: null },
    ],
  };
}

test('extractToolCalls returns paired invocations in order', () => {
  const calls = extractToolCalls(sampleExport());
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    id: 'call_1',
    name: 'search_files',
    arguments: { pattern: 'EntitlementService' },
    result: '{"total_count": 14}',
  });
  assert.deepEqual(calls[1], {
    id: 'call_2',
    name: 'read_file',
    arguments: { path: 'src/a.ts' },
    result: 'file content here',
  });
});

test('extractToolCalls returns [] on empty or non-export input', () => {
  assert.deepEqual(extractToolCalls(null), []);
  assert.deepEqual(extractToolCalls({}), []);
  assert.deepEqual(extractToolCalls({ messages: [] }), []);
  assert.deepEqual(extractToolCalls({ messages: [{ role: 'user', content: 'hi' }] }), []);
});

test('extractToolCalls leaves unparseable arguments as raw string', () => {
  const exp = sampleExport();
  exp.messages[1].tool_calls[0].function.arguments = 'not-json';
  const calls = extractToolCalls(exp);
  assert.equal(calls[0].arguments, 'not-json');
});

test('extractToolCalls caps entry count at maxToolCalls', () => {
  const exp = sampleExport();
  const calls = extractToolCalls(exp, { maxToolCalls: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'call_1');
});

test('extractToolCalls caps arguments and result bytes', () => {
  const exp = sampleExport();
  const calls = extractToolCalls(exp, { maxToolCallArgsBytes: 10, maxToolCallResultBytes: 10 });
  assert.equal(calls[0].arguments, '{"pattern"' + TRUNCATION_MARKER);
  assert.equal(calls[0].result, '{"total_co' + TRUNCATION_MARKER);
});

test('extractToolCalls leaves result null when no matching tool result message', () => {
  const exp = sampleExport();
  exp.messages = exp.messages.filter((m) => m.id !== 't1');
  const calls = extractToolCalls(exp);
  assert.equal(calls[0].result, null);
});

test('capText truncates by bytes without splitting multi-byte chars', () => {
  assert.equal(capText('hello', 10), 'hello');
  assert.equal(capText(null, 10), '');
  const s = 'a\u00e9\u4e2d'; // a(1) + é(2) + 中(3) = 6 bytes
  assert.equal(capText(s, 4), 'a\u00e9' + TRUNCATION_MARKER);
  assert.equal(Buffer.byteLength('a\u00e9', 'utf8'), 3);
  assert.equal(capText(s, 20), s);
});
