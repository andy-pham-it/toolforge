#!/usr/bin/env node
/**
 * CLI entry point for @andy-toolforge/mcp.
 * Reads GEMINI_API_KEY from environment and starts the MCP server over stdin/stdout.
 */
const { createServer } = require('../lib/index');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const server = createServer({ apiKey });
server.start().catch(err => {
    console.error('MCP server error:', err);
    process.exit(1);
});
