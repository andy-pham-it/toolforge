const { LLMClient } = require('@andy-toolforge/core');
const readline = require('readline');
const seoGenerate = require('./tools/seo-generate');
const analyzeScript = require('./tools/analyze-script');
const generatePrompts = require('./tools/generate-prompts');
const generateMapping = require('./tools/generate-mapping');
const suggestCover = require('./tools/suggest-cover');
const contentSummarizer = require('./tools/content-summarizer');
const contentIdeator = require('./tools/content-ideator');
const contentManager = require('./tools/content-manager');
const contentAnalyzer = require('./tools/content-analyzer');

class MCPServer {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.provider = config.provider || 'gemini';
        this.model = config.model || (this.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.0-flash');
        this._llm = null;
        this._tools = {
            toolforge_seo_generate: seoGenerate,
            analyze_script: analyzeScript,
            generate_prompts: generatePrompts,
            generate_mapping: generateMapping,
            suggest_cover: suggestCover,
            andy_toolforge_content_summarizer: contentSummarizer,
            andy_toolforge_content_ideator: contentIdeator,
            andy_toolforge_article_manager: contentManager,
            andy_toolforge_competitor_analyzer: contentAnalyzer,
        };
    }

    /** Lazily create LLMClient (so tests can inject mock) */
    get llm() {
        if (!this._llm) {
            this._llm = new LLMClient({
                provider: this.provider,
                apiKey: this.apiKey,
                model: this.model,
            });
        }
        return this._llm;
    }

    /** Override LLM client (for tests) */
    set llm(client) {
        this._llm = client;
    }

    /** Return tool definitions for tools/list */
    getToolList() {
        return Object.values(this._tools).map(t => t.definition);
    }

    /** Start listening on stdin for JSON-RPC messages */
    async start() {
        const rl = readline.createInterface({
            input: process.stdin,
            crlfDelay: Infinity,
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                const resp = await this._handle(msg);
                if (resp !== null) {
                    process.stdout.write(JSON.stringify(resp) + '\n');
                }
            } catch (err) {
                process.stdout.write(JSON.stringify({
                    jsonrpc: '2.0',
                    id: null,
                    error: { code: -32700, message: 'Parse error', data: err.message },
                }) + '\n');
            }
        }
    }

    /** Handle a single JSON-RPC request */
    async _handle(msg) {
        if (!msg || typeof msg === 'string') {
            return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
        }

        const { id, method, params } = msg || {};

        if (!method) {
            return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request: method required' } };
        }

        // MCP protocol notifications — no response
        if (method.startsWith('notifications/')) {
            return null;
        }

        // MCP protocol initialize handshake
        if (method === 'initialize') {
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: params?.protocolVersion || '2024-11-05',
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: '@andy-toolforge/mcp',
                        version: '1.0.0',
                    },
                },
            };
        }

        if (method === 'tools/list') {
            return {
                jsonrpc: '2.0',
                id,
                result: { tools: this.getToolList() },
            };
        }

        if (method === 'tools/call') {
            return this._handleToolCall(id, params);
        }

        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }

    /** Handle a tools/call request */
    async _handleToolCall(id, params) {
        if (!params || !params.name) {
            return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: tool name required' } };
        }

        const tool = this._tools[params.name];
        if (!tool) {
            return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${params.name}` } };
        }

        try {
            const result = await tool.handler(this.llm, params.arguments || {});
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                },
            };
        } catch (err) {
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32000, message: err.message, data: err.stack },
            };
        }
    }
}

module.exports = MCPServer;
