'use strict';

const fs = require('fs');
const path = require('path');

const CRITICAL_CODE = -32000;
const DEFAULT_MAX_BUFFER = 1000;

/**
 * Centralized error tracking for MCP servers.
 *
 * Wraps tool handlers and JSON-RPC dispatch functions to count calls,
 * bucket errors by JSON-RPC code, keep a bounded in-memory log, optionally
 * append a JSONL log file, and fire an alerting hook for internal errors.
 *
 * The wrapper never swallows or transforms errors — it re-throws so the
 * server layer still owns the JSON-RPC response envelope.
 */
class MCPErrorTracker {
  constructor({ logPath, onCritical, maxBuffer = DEFAULT_MAX_BUFFER } = {}) {
    this._logPath = logPath ? path.resolve(logPath) : null;
    this._onCritical = onCritical;
    this._maxBuffer = maxBuffer;
    this._buffer = [];
    this._errorCounts = {};
    this._totalCalls = 0;
    this._totalErrors = 0;
    this._writeChain = Promise.resolve();
  }

  _now() {
    return new Date().toISOString();
  }

  _record(entry) {
    this._buffer.push(entry);
    if (this._buffer.length > this._maxBuffer) {
      this._buffer.shift();
    }
    if (this._logPath) {
      const line = JSON.stringify(entry) + '\n';
      this._writeChain = this._writeChain
        .then(() => fs.promises.appendFile(this._logPath, line))
        .catch(() => {});
    }
  }

  /** Wrap a tool handler. Returns async (llm, args) => result. Re-throws on error. */
  wrap(toolName, handler) {
    return async (llm, args) => {
      const start = Date.now();
      this._totalCalls += 1;
      try {
        const result = await handler(llm, args);
        this._record({
          timestamp: this._now(),
          type: 'ok',
          tool: toolName,
          duration: Date.now() - start,
        });
        return result;
      } catch (err) {
        this._totalErrors += 1;
        const code = err && typeof err.code === 'number' ? err.code : CRITICAL_CODE;
        this._errorCounts[String(code)] = (this._errorCounts[String(code)] || 0) + 1;
        this._record({
          timestamp: this._now(),
          type: 'error',
          tool: toolName,
          code,
          message: err && err.message ? err.message : String(err),
          duration: Date.now() - start,
        });
        if (code === CRITICAL_CODE && typeof this._onCritical === 'function') {
          try {
            this._onCritical({
              tool: toolName,
              code,
              message: err && err.message ? err.message : String(err),
              stack: err && err.stack ? err.stack : undefined,
            });
          } catch (e) {
            // A buggy hook must never break the tool call path.
          }
        }
        throw err;
      }
    };
  }

  /** Wrap the top-level JSON-RPC dispatch. Re-throws on error. */
  wrapHandle(handleFn) {
    return async (msg) => {
      try {
        return await handleFn(msg);
      } catch (err) {
        this._totalErrors += 1;
        this._record({
          timestamp: this._now(),
          type: 'handle_error',
          method: msg && msg.method ? msg.method : undefined,
          message: err && err.message ? err.message : String(err),
        });
        throw err;
      }
    };
  }

  /** Returns cumulative stats and the bounded recent-log buffer. */
  getStats() {
    return {
      totalCalls: this._totalCalls,
      totalErrors: this._totalErrors,
      errorCounts: { ...this._errorCounts },
      recentLogs: this._buffer.slice(-50),
    };
  }

  /** Clears counters and the buffer. Does NOT touch the log file. */
  reset() {
    this._buffer = [];
    this._errorCounts = {};
    this._totalCalls = 0;
    this._totalErrors = 0;
  }
}

module.exports = { MCPErrorTracker };
