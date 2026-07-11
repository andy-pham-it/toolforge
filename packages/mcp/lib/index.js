const MCPServer = require('./mcp-server');

/**
 * Create and start an MCP server instance.
 *
 * @param {object} config
 * @param {string} config.apiKey     — API key for the LLM provider
 * @param {string} [config.provider] — LLM provider: 'groq' | 'gemini' (default: gemini)
 * @param {string} [config.model]    — Model name (default depends on provider)
 * @returns {MCPServer}
 */
function createServer(config) {
    if (!config || !config.apiKey) {
        console.warn('[mcp] Warning: No API key provided. Tools will return errors until GEMINI_API_KEY or GROQ_API_KEY is set.');
    }
    return new MCPServer(config || {});
}

module.exports = { createServer, MCPServer };
