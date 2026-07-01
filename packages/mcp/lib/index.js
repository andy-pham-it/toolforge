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
        throw new Error('MCPServer requires an apiKey');
    }
    return new MCPServer(config);
}

module.exports = { createServer, MCPServer };
