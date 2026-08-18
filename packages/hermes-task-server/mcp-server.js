#!/usr/bin/env node
'use strict';

/**
 * Standalone MCP stdio entry point for @andy-toolforge/hermes-task-server.
 * Exposes hermes_task / hermes_task_detail / hermes_models / hermes_telemetry
 * over JSON-RPC 2.0 stdio for MCP hosts (opencode, etc.).
 *
 * Usage: node mcp-server.js
 * Env: HERMES_TASK_CWD_ALLOWLIST (comma-separated absolute paths, optional)
 */

const { createServer } = require('./lib/index');

const cwdAllowlist = (process.env.HERMES_TASK_CWD_ALLOWLIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const server = createServer({ cwdAllowlist });
server.start();