#!/usr/bin/env node
/**
 * CLI entry point for @andy-toolforge/mcp.
 * Supports Gemini (preferred) and Groq providers via environment variables.
 *
 * Priority: GEMINI_API_KEY > GROQ_API_KEY
 *
 * Model fallback chain (Gemini): GEMINI_MODEL_CHAIN > GEMINI_MODEL > default
 * Example: GEMINI_MODEL_CHAIN=gemini-3.1-flash-lite,gemma-4-31b,gemma-4-26b
 *
 * NOTE: Server starts even without API keys (tools return clear errors instead of crashing).
 * This allows the MCP to be available when keys are configured via OpenCode vault
 * or provided at tool-call time.
 */
const { createServer } = require('../lib/index');

let provider, apiKey, models;

if (process.env.GEMINI_API_KEY) {
    provider = 'gemini';
    apiKey = process.env.GEMINI_API_KEY;
    // Parse model chain: GEMINI_MODEL_CHAIN > GEMINI_MODEL > default
    const rawModels = process.env.GEMINI_MODEL_CHAIN || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    models = rawModels.split(',').map(s => s.trim()).filter(Boolean);
} else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
    apiKey = process.env.GROQ_API_KEY;
    models = [process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'];
} else {
    provider = null;
    apiKey = null;
    models = [];
    console.warn('[mcp] Warning: No API key found (check GEMINI_API_KEY or GROQ_API_KEY). Tools that need LLM will return errors.');
}

const server = createServer({ provider, apiKey, models });
server.start().catch(err => {
    console.error('MCP server error:', err);
    process.exit(1);
});
