'use strict';

/**
 * @andy-toolforge/sdlc-workflows typed error classes.
 *
 * Each error carries a numeric `code` matching MCP JSON-RPC error codes:
 *   -32602  Invalid Params  (user-facing: bad input, resource not found)
 *   -32000  Server Error    (internal bug)
 */

class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolInputError';
    this.code = -32602;
  }
}

class ToolNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolNotFoundError';
    this.code = -32602;
  }
}

class ToolInternalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolInternalError';
    this.code = -32000;
  }
}

module.exports = { ToolInputError, ToolNotFoundError, ToolInternalError };
