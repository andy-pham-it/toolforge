'use strict';

const MAX_DIFF_BYTES = 200 * 1024; // 200KB

function parseOpenCodeOutput(stdout) {
  const result = {
    session_id: null,
    files_changed: [],
    summary: '',
    diff: '',
  };
  const edits = [];
  const texts = [];
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
    if (part.type === 'tool' && part.tool === 'edit' && part.state) {
      const fd = part.state.metadata && part.state.metadata.filediff;
      if (fd && fd.file) result.files_changed.push(fd.file);
      if (fd && typeof fd.patch === 'string') edits.push(fd.patch);
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

  if (!result.session_id && result.summary === '' && result.files_changed.length === 0) {
    const err = new Error('Could not parse opencode output (no session id, text, or file edits found)');
    err.code = 'PARSE_ERROR';
    err.raw = String(stdout || '');
    throw err;
  }

  return result;
}

module.exports = { parseOpenCodeOutput, MAX_DIFF_BYTES };
