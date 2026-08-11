'use strict';

const MAX_DIFF_BYTES = 200 * 1024; // 200KB
const MAX_TOOL_CALL_BYTES = 100 * 1024; // 100KB total tool_calls budget
const MAX_TOOL_IO_BYTES = 20 * 1024; // 20KB per input/output field

function capText(value, maxBytes) {
  const s = String(value == null ? '' : value);
  if (s.length <= maxBytes) return s;
  return `${s.slice(0, maxBytes)}... [truncated at ${maxBytes} bytes]`;
}

function parseOpenCodeOutput(stdout) {
  const result = {
    session_id: null,
    files_changed: [],
    summary: '',
    diff: '',
    tool_calls: [],
  };
  const edits = [];
  const texts = [];
  const toolCalls = [];
  const lines = String(stdout || '').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let evt;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      continue; // skip non-JSON lines
    }
    if (!evt || typeof evt !== 'object') continue;
    if (!result.session_id && evt.sessionID) result.session_id = evt.sessionID;
    const part = evt.part;
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'tool' && part.state) {
      const fd = part.state.metadata && part.state.metadata.filediff;
      if (part.tool === 'edit' && fd) {
        if (fd.file) result.files_changed.push(fd.file);
        if (typeof fd.patch === 'string') edits.push(fd.patch);
      }
      toolCalls.push({
        tool: part.tool,
        status: typeof part.state.status === 'string' ? part.state.status : 'unknown',
        isError: !!part.state.isError,
        input: capText(part.state.input, MAX_TOOL_IO_BYTES),
        output: capText(part.state.output, MAX_TOOL_IO_BYTES),
      });
    } else if (part.type === 'text' && typeof part.text === 'string') {
      texts.push(part.text);
    }
  }

  result.files_changed = [...new Set(result.files_changed)];
  result.summary = texts.join('\n').trim();
  result.diff = edits.join('\n');

  if (result.diff.length > MAX_DIFF_BYTES) {
    result.diff = result.diff.slice(0, MAX_DIFF_BYTES) + '\n... [diff truncated at 200KB]';
  }

  // Cap total tool_calls budget: drop tail entries until under MAX_TOOL_CALL_BYTES.
  let serialized = JSON.stringify(toolCalls);
  while (serialized.length > MAX_TOOL_CALL_BYTES && toolCalls.length > 0) {
    toolCalls.pop();
    serialized = JSON.stringify(toolCalls);
  }
  result.tool_calls = toolCalls;

  if (!result.session_id && result.summary === '' && result.files_changed.length === 0) {
    const err = new Error('Could not parse opencode output (no session id, text, or file edits found)');
    err.code = 'PARSE_ERROR';
    err.raw = String(stdout || '');
    throw err;
  }

  return result;
}

module.exports = { parseOpenCodeOutput, MAX_DIFF_BYTES, MAX_TOOL_CALL_BYTES, MAX_TOOL_IO_BYTES };
