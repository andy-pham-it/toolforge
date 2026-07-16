const { LLMClient, OpenAIAdapter } = require('@andy-toolforge/core');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const mcpPkg = require('../package.json');

class MCPServer {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.provider = config.provider || 'gemini';
        this.config = config;
        this._llm = null;

        // Build adapter chain from config.
        // Priority order:
        //   1. config.adapters (explicit adapter objects — most flexible)
        //   2. config.models (backward-compat: model-name chain, same provider)
        //   3. config.model or default (single model)
        if (config.adapters) {
            // Caller provided pre-built adapter instances
            this._adapterConfig = null;
            this._adapterInstances = config.adapters;
        } else if (config.models && config.models.length > 1) {
            // Backward-compat model chain: create one OpenAIAdapter per model
            this._adapterConfig = null;
            this._adapterInstances = config.models.map(m => new OpenAIAdapter({
                provider: this.provider,
                apiKey: this.apiKey,
                model: m,
            }));
        } else {
            // Single model (backward-compat)
            this._adapterConfig = {
                provider: this.provider,
                apiKey: this.apiKey,
                model: config.model || (this.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-3.1-flash-lite'),
            };
            this._adapterInstances = null;
        }

        this._tools = {};

        if (config.discover !== false) {
            this._loadPluginTools();
        }
        this._tools['toolforge_suggest'] = this._createSuggestTool();
    }

    /** Current model name (first adapter's model, for informational use) */
    get model() {
        if (this._adapterInstances && this._adapterInstances.length > 0) {
            return this._adapterInstances[0].model;
        }
        return this._adapterConfig?.model || 'gemini-3.1-flash-lite';
    }

    /** Lazily create LLMClient (so tests can inject mock). Returns null if no API key configured. */
    get llm() {
        if (!this.apiKey) return null;
        if (!this._llm) {
            if (this._adapterInstances) {
                this._llm = new LLMClient({ adapters: this._adapterInstances });
            } else {
                this._llm = new LLMClient(this._adapterConfig);
            }
        }
        return this._llm;
    }

    /** Override LLM client (for tests) */
    set llm(client) {
        this._llm = client;
    }

    /**
     * Discover and load mcp-tools.js from all installed @andy-toolforge packages.
     * Scans node_modules/@andy-toolforge/<pkg>/mcp-tools.js via require.resolve chain.
     * Each file exports a function(config) => array of { definition, handler }.
     * Built-in tools take priority — plugin tools with conflicting names are skipped.
     * Error isolation: one failing package never breaks other tools.
     */
    _loadPluginTools() {
        const scopeDir = this._findToolforgeScopeDir();
        if (!scopeDir) return;

        let entries;
        try {
            entries = fs.readdirSync(scopeDir);
        } catch {
            return;
        }

        for (const pkgName of entries.sort()) {
            const mcpToolsPath = path.join(scopeDir, pkgName, 'mcp-tools.js');
            if (!fs.existsSync(mcpToolsPath)) continue;

            try {
                const factory = require(mcpToolsPath);
                const tools = typeof factory === 'function' ? factory(this.config) : factory;
                if (!Array.isArray(tools)) continue;

                for (const tool of tools) {
                    const name = tool.definition?.name;
                    if (!name || typeof tool.handler !== 'function') continue;
                    if (this._tools[name]) {
                        console.warn(`[mcp] Plugin tool "${name}" from @andy-toolforge/${pkgName} conflicts with built-in — skipping`);
                        continue;
                    }
                    this._tools[name] = tool;
                }
            } catch (err) {
                console.error(`[mcp] Failed to load plugin tools from @andy-toolforge/${pkgName}:`, err.message);
                if (err.stack) console.error(`[mcp] Stack:`, err.stack.split('\n').slice(0, 3).join('\n'));
            }
        }
    }

    /**
     * Find the node_modules/@andy-toolforge/ directory by traversing up from __dirname.
     * Works for both workspace monorepo dev and production installs.
     */
    _findToolforgeScopeDir() {
        let dir = path.resolve(__dirname);
        const root = path.parse(dir).root;
        let best = null;
        while (dir !== root) {
            const candidate = path.join(dir, 'node_modules', '@andy-toolforge');
            if (fs.existsSync(candidate)) {
                best = candidate; // keep walking up — top-level scope has more packages
            }
            dir = path.dirname(dir);
        }
        return best;
    }

    /**
     * Build the built-in toolforge_suggest tool.
     * Uses LLM to route natural-language tasks to the best registered tool.
     */
    _createSuggestTool() {
        const suggestTool = {
            definition: {
                name: 'toolforge_suggest',
                description: 'Suggest the best @andy-toolforge tool for a given task in natural language',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task: {
                            type: 'string',
                            description: 'What do you want to do in natural language (e.g. "generate SEO metadata for a podcast episode", "analyze a script for visual segments")',
                        },
                    },
                    required: ['task'],
                },
            },
            handler: async (llm, args) => {
                const { task } = args;
                if (!task) throw new Error('Missing required argument: task');

                const toolList = Object.entries(suggestTool._toolCache || this._tools)
                    .filter(([name]) => name !== 'toolforge_suggest')
                    .map(([name, t]) => `  - ${name}: ${t.definition.description || 'No description'}`)
                    .join('\n');

                const systemPrompt = `You are a tool router for the @andy-toolforge MCP server. Given a user's task, suggest the best tool to use.

Available tools:
${toolList}

Respond with a JSON object:
{
  "bestTool": "tool_name",
  "reason": "Short reason why this tool is the best match",
  "suggestedArgs": { ... key args to pass }
}`;

                const raw = await llm.chat(systemPrompt, task, true);
                return JSON.parse(raw);
            },
        };

        Object.defineProperty(suggestTool, '_toolCache', {
            get: () => this._tools,
        });

        return suggestTool;
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
                        version: mcpPkg.version,
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

        // If no API key configured, return a clear error before trying tool handlers
        if (!this.apiKey) {
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32000, message: 'No API key configured. Set GEMINI_API_KEY or GROQ_API_KEY in your opencode.jsonc MCP environment.' },
            };
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
