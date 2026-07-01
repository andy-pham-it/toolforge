const MCPServer = require('./mcp-server');

/**
 * Create and start an MCP server instance.
 *
 * @param {object} config
 * @param {string} config.apiKey  — Gemini API key
 * @param {string} [config.model] — Gemini model name (default: gemini-2.0-flash)
 * @returns {MCPServer}
 */
function createServer(config) {
    if (!config || !config.apiKey) {
        throw new Error('MCPServer requires apiKey (Gemini API key)');
    }
    return new MCPServer(config);
}

module.exports = { createServer, MCPServer };
