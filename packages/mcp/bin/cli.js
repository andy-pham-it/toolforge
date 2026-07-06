#!/usr/bin/env node
/**
 * CLI entry point for @andy-toolforge/mcp.
 * Supports Gemini (preferred) and Groq providers via environment variables.
 *
 * Priority: GEMINI_API_KEY > GROQ_API_KEY
 */
const { createServer } = require('../lib/index');

let provider, apiKey, model;

if (process.env.GEMINI_API_KEY) {
    provider = 'gemini';
    apiKey = process.env.GEMINI_API_KEY;
    model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
} else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
    apiKey = process.env.GROQ_API_KEY;
    model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
} else {
    console.error('Either GEMINI_API_KEY or GROQ_API_KEY environment variable is required');
    process.exit(1);
}

const server = createServer({ provider, apiKey, model });
server.start().catch(err => {
    console.error('MCP server error:', err);
    process.exit(1);
});
