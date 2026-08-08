'use strict';

const { z } = require('zod');
const pkg = require('../package.json');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { loadConfig } = require('./config');
const { SessionManager } = require('./session');
const { opencodeRun } = require('./tools/opencode-run');
const { opencodeRead } = require('./tools/opencode-read');
const { opencodeStatus } = require('./tools/opencode-status');
const { opencodeSetModels } = require('./tools/opencode-set-models');

function wrap(toolFn) {
  return async (args) => {
    try {
      return await toolFn(args);
    } catch (err) {
      return { status: 'error', error: { code: 'TASK_ERROR', message: err.message } };
    }
  };
}

function createServer({ config, sessions, tools } = {}) {
  const cfg = config || loadConfig();
  const sms = sessions || new SessionManager();
  const KNOWN_TOOLS = ['opencode_run', 'opencode_read', 'opencode_status', 'opencode_set_models', 'opencode_task'];
  if (tools) {
    for (const name of tools) {
      if (!KNOWN_TOOLS.includes(name)) throw new Error(`unknown tool: ${name}`);
    }
  }
  const enabled = tools ? new Set(tools) : null;
  const server = new McpServer({ name: 'hermes-opencode-bridge', version: pkg.version });

  if (!enabled || enabled.has('opencode_run')) {
    server.registerTool(
      'opencode_run',
      {
        title: 'Run task in opencode',
        description: 'Run a task in an opencode session. Use conversation_id to continue a previous session.',
        inputSchema: z.object({
          task: z.string().describe('The task to run'),
          project_dir: z.string().optional().describe('Project directory'),
          model: z.string().optional().describe('Model id'),
          agent: z.string().optional().describe('Agent name'),
          conversation_id: z.string().optional().describe('Conversation to continue'),
        }).strict(),
      },
      wrap((args) => opencodeRun({ config: cfg, sessions: sms, args }))
    );
  }

  if (!enabled || enabled.has('opencode_read')) {
    server.registerTool(
      'opencode_read',
      {
        title: 'Read files or tree',
        description: 'Read a file or list a directory tree.',
        inputSchema: z.object({
          path: z.string().describe('Path to file or directory'),
          depth: z.number().optional().describe('Directory recursion depth (default 2)'),
          max_lines: z.number().optional().describe('Max lines for files (default 500)'),
        }).strict(),
      },
      wrap((args) => opencodeRead({ config: cfg, args }))
    );
  }

  if (!enabled || enabled.has('opencode_status')) {
    server.registerTool(
      'opencode_status',
      {
        title: 'Git working state',
        description: 'Get git status of a project directory.',
        inputSchema: z.object({
          project_dir: z.string().optional().describe('Project directory'),
        }).strict(),
      },
      wrap((args) => opencodeStatus({ config: cfg, args }))
    );
  }

  if (!enabled || enabled.has('opencode_set_models')) {
    server.registerTool(
      'opencode_set_models',
      {
        title: 'Manage allowed models',
        description: 'Set, add, remove, or list allowed models.',
        inputSchema: z.object({
          models: z.array(z.string()).optional().describe('Model ids'),
          action: z.enum(['set', 'add', 'remove', 'list']).optional().describe('Action'),
        }).strict(),
      },
      wrap((args) => opencodeSetModels({ config: cfg, args }))
    );
  }

  if (!enabled || enabled.has('opencode_task')) {
    server.registerTool(
      'opencode_task',
      {
        title: 'Run task with auto-commit',
        description: 'Run a task and auto-commit changes afterward.',
        inputSchema: z.object({
          task: z.string().describe('The task to run'),
          project_dir: z.string().optional().describe('Project directory'),
          model: z.string().optional().describe('Model id'),
          agent: z.string().optional().describe('Agent name'),
          conversation_id: z.string().optional().describe('Conversation to continue'),
        }).strict(),
      },
      wrap((args) => opencodeRun({ config: { ...cfg, auto_commit: true }, sessions: sms, args }))
    );
  }

  return server;
}

async function startServer(opts = {}) {
  const cfg = opts.config || loadConfig();
  const sms = opts.sessions || new SessionManager();
  const server = createServer({ config: cfg, sessions: sms, tools: opts.tools });
  sms.startCleanup();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

module.exports = { createServer, startServer };
