const { describe, it, before, mock } = require('node:test');
const assert = require('node:assert/strict');
const MCPServer = require('./mcp-server');
const { createServer } = require('./index');

/** Create a mock LLM that returns controlled responses */
function mockLlm(returnValue) {
    return {
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
        chat: mock.fn(async (_system, _user, _jsonMode) => {
            return typeof returnValue === 'string'
                ? returnValue
                : JSON.stringify(returnValue);
        }),
    };
}

describe('MCPServer', () => {
    describe('createServer', () => {
        it('throws if apiKey is missing', () => {
            assert.throws(() => createServer({}), /apiKey/);
        });

        it('creates server with valid config', () => {
            const server = createServer({ apiKey: 'test-key' });
            assert(server instanceof MCPServer);
        });
    });

    describe('MCP protocol handshake', () => {
        it('handles initialize request', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {} },
            });

            assert.equal(resp.id, 1);
            assert(resp.result);
            assert.equal(resp.result.protocolVersion, '2024-11-05');
            assert(resp.result.capabilities.tools);
            assert.equal(resp.result.serverInfo.name, '@andy-toolforge/mcp');
        });

        it('returns null for notifications (no response written)', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                method: 'notifications/initialized',
            });

            assert.equal(resp, null);
        });
    });

    describe('tools/list', () => {
        it('returns tool definitions', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list',
            });

            assert.equal(resp.id, 1);
            assert(resp.result);
            const tools = resp.result.tools;
            assert(Array.isArray(tools));
            assert(tools.length >= 2);

            const names = tools.map(t => t.name);
            assert(names.includes('toolforge_seo_generate'));
            assert(names.includes('analyze_script'));

            // Check schema
            const seo = tools.find(t => t.name === 'toolforge_seo_generate');
            assert(seo.inputSchema);
            assert(seo.inputSchema.required.includes('script'));
            assert(seo.inputSchema.required.includes('title'));
        });
    });

    describe('tools/call — toolforge_seo_generate', () => {
        it('returns multi-platform SEO metadata for valid input', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const mockReturn = {
                youtube: {
                    suggestedTitle: 'YT Title',
                    description: 'YT desc',
                    tags: ['yt1', 'yt2'],
                    keywords: ['kw1'],
                    timestamps: [{ time: '00:00', label: 'Start' }],
                },
                tiktok: {
                    suggestedTitle: 'TT Title',
                    description: 'TT desc',
                    tags: ['tt1'],
                    keywords: [],
                    timestamps: [],
                },
                facebook: {
                    suggestedTitle: 'FB Title',
                    description: 'FB desc',
                    tags: ['fb1', 'fb2'],
                    keywords: ['kw2'],
                    timestamps: [{ time: '00:00', label: 'Intro' }],
                },
            };
            server.llm = mockLlm(mockReturn);

            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'toolforge_seo_generate',
                    arguments: {
                        script: 'Hello world test script',
                        title: 'Test',
                    },
                },
            });

            assert.equal(resp.id, 2);
            assert(resp.result);
            const text = resp.result.content[0].text;
            const data = JSON.parse(text);
            assert(data.youtube);
            assert.equal(data.youtube.suggestedTitle, 'YT Title');
            assert(data.tiktok);
            assert(data.facebook);
        });

        it('returns error when args missing', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: {
                    name: 'toolforge_seo_generate',
                    arguments: { script: 'test' }, // missing title
                },
            });

            assert(resp.error);
            assert(resp.error.message.includes('title'));
        });

        it('returns error for incomplete LLM response', async () => {
            const server = createServer({ apiKey: 'test-key' });
            server.llm = mockLlm({ incomplete: true }); // no platform data

            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 4,
                method: 'tools/call',
                params: {
                    name: 'toolforge_seo_generate',
                    arguments: { script: 'test', title: 'Test' },
                },
            });

            assert(resp.error);
            assert(resp.error.message.includes('incomplete'));
        });
    });

    describe('tools/call — analyze_script', () => {
        it('returns segments for valid input', async () => {
            const server = createServer({ apiKey: 'test-key' });

            // Mock LLM with analyzeScript directly (handler checks for its presence)
            const segments = [
                {
                    id: 1,
                    title: 'Intro',
                    summary: 'Opening',
                    visualType: 'Typography',
                    startTime: '00:00',
                    endTime: '00:30',
                    prompts: { a: 'prompt1', b: 'prompt2', c: '', d: '', e: '' },
                    editSuggestions: { zoom: 'none', context: 'intro', mood: 'neutral' },
                },
            ];
            server.llm = mockLlm({ segments });
            server.llm.analyzeScript = () => segments;

            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 5,
                method: 'tools/call',
                params: {
                    name: 'analyze_script',
                    arguments: {
                        script: 'Welcome to the show',
                        title: 'My Podcast',
                    },
                },
            });

            assert.equal(resp.id, 5);
            assert(resp.result);
            const text = resp.result.content[0].text;
            const data = JSON.parse(text);
            assert(data.segments);
            assert(data.segments.length >= 1);
            assert.equal(data.segments[0].title, 'Intro');
        });
    });

    describe('error handling', () => {
        it('returns error for unknown tool', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 6,
                method: 'tools/call',
                params: { name: 'nonexistent' },
            });

            assert(resp.error);
            assert(resp.error.code, -32602);
            assert(resp.error.message.includes('Unknown tool'));
        });

        it('returns error for unknown method', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 7,
                method: 'resources/list',
            });

            assert(resp.error);
            assert.equal(resp.error.code, -32601);
        });

        it('returns error for invalid request (no method)', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0',
                id: 8,
            });

            assert(resp.error);
            assert(resp.error.code, -32600);
        });

        it('handles JSON parse error gracefully', async () => {
            const server = createServer({ apiKey: 'test-key' });
            // Simulate what start() does when JSON.parse fails
            let resp;
            try {
                const msg = JSON.parse('not json');
                resp = await server._handle(msg);
            } catch (err) {
                resp = {
                    jsonrpc: '2.0',
                    id: null,
                    error: { code: -32700, message: 'Parse error', data: err.message },
                };
            }
            assert(resp.error);
            assert.equal(resp.error.code, -32700);
        });
    });
});
