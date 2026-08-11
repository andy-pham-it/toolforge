'use strict';

const TRUNCATION_MARKER = '... [truncated]';

/**
 * Cap a UTF-8 string to maxBytes without splitting a multi-byte char.
 * Appends TRUNCATION_MARKER when truncated. null/undefined -> ''.
 */
function capText(value, maxBytes) {
  if (value == null) return '';
  const text = String(value);
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  let buf = Buffer.from(text, 'utf8').subarray(0, maxBytes);
  let cut = buf.length;
  while (cut > 0 && (buf[cut - 1] & 0xc0) === 0x80) cut -= 1; // drop trailing continuation bytes
  if (cut > 0 && (buf[cut - 1] & 0xc0) === 0xc0) cut -= 1; // drop a dangling lead byte
  return buf.subarray(0, cut).toString('utf8') + TRUNCATION_MARKER;
}

/**
 * Best-effort JSON.parse; falls back to the raw string when unparseable.
 * null/undefined -> null.
 */
function parseMaybe(s) {
  if (s == null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Extract tool calls from a `hermes sessions export --format jsonl` object
 * (single JSON object with `messages[]`).
 *
 * Tool invocations live on assistant messages as `tool_calls:[{id, call_id,
 * response_item_id, type:'function', function:{name, arguments(<JSON string>)}}]`;
 * tool results live on `role:'tool'` messages with `tool_call_id` matching the
 * invocation id and `content` carrying the JSON-string tool output.
 *
 * Returns entries in invocation order: {id, name, arguments, result}
 * (arguments best-effort parsed; result = paired tool output or null).
 * Results are capped at cfg.maxToolCallResultBytes, arguments at
 * cfg.maxToolCallArgsBytes, entry count at cfg.maxToolCalls. Returns [] when
 * the export has no messages or no tool calls.
 */
function extractToolCalls(exportObj, cfg = {}) {
  const maxCalls = cfg.maxToolCalls != null ? cfg.maxToolCalls : 50;
  const maxArgs = cfg.maxToolCallArgsBytes != null ? cfg.maxToolCallArgsBytes : 2048;
  const maxResult = cfg.maxToolCallResultBytes != null ? cfg.maxToolCallResultBytes : 8192;
  const messages = Array.isArray(exportObj && exportObj.messages) ? exportObj.messages : [];
  if (messages.length === 0) return [];

  const results = new Map();
  for (const msg of messages) {
    if (msg && msg.role === 'tool' && msg.tool_call_id && msg.content != null) {
      results.set(msg.tool_call_id, capText(msg.content, maxResult));
    }
  }

  const out = [];
  for (const msg of messages) {
    if (!msg || msg.role !== 'assistant' || !Array.isArray(msg.tool_calls)) continue;
    for (const tc of msg.tool_calls) {
      if (out.length >= maxCalls) return out;
      if (!tc || !tc.function) continue;
      const id = tc.id || tc.call_id || null;
      const rawArgs = tc.function.arguments;
      const entry = {
        id,
        name: tc.function.name || null,
        arguments: rawArgs == null ? null : parseMaybe(capText(rawArgs, maxArgs)),
        result: results.get(id) || results.get(tc.call_id) || null,
      };
      out.push(entry);
    }
  }
  return out;
}

module.exports = { extractToolCalls, capText, parseMaybe, TRUNCATION_MARKER };
