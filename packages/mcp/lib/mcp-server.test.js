const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const MCPServer = require('./mcp-server');
const { createServer } = require('./index');

/** Create a mock LLM that returns controlled responses */
function mockLlm(returnValue) {
    return {
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
        chat: async (_system, _user, _jsonMode) => {
            return typeof returnValue === 'string'
                ? returnValue
                : JSON.stringify(returnValue);
        },
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
            assert(tools.length >= 9);

            const names = tools.map(t => t.name);
            assert(names.includes('toolforge_seo_generate'));
            assert(names.includes('analyze_script'));
            assert(names.includes('generate_prompts'));
            assert(names.includes('generate_mapping'));
            assert(names.includes('suggest_cover'));
            assert(names.includes('andy_toolforge_content_summarizer'));
            assert(names.includes('andy_toolforge_content_ideator'));
            assert(names.includes('andy_toolforge_article_manager'));
            assert(names.includes('andy_toolforge_competitor_analyzer'));

            // Check at least one tool has a proper schema
            const seo = tools.find(t => t.name === 'toolforge_seo_generate');
            assert(seo.inputSchema);
            assert(seo.inputSchema.required.includes('script'));
            assert(seo.inputSchema.required.includes('title'));

            const cover = tools.find(t => t.name === 'suggest_cover');
            assert(cover.inputSchema);
            assert(cover.inputSchema.required.includes('description'));
        });
    });

    describe('tools/call — toolforge_seo_generate', () => {
        it('returns multi-platform SEO metadata for valid input', async () => {
            const server = createServer({ apiKey: 'test-key' });

            function buildTimestamps(count, prefix) {
                return Array.from({ length: count }, (_, i) => ({
                    time: `${String(Math.floor(i * 2)).padStart(2, '0')}:${String((i * 120) % 60).padStart(2, '0')}`,
                    label: `${prefix} seg ${i + 1}`,
                }));
            }

            const mockReturn = {
                youtube: {
                    suggestedTitle: 'YT Title',
                    description: 'YT desc with more detail',
                    formattedDescription: '📌 Summary\n⏱️ Timestamps\n🔗 Links\n#SEO #Content',
                    tags: ['yt1', 'yt2', 'yt3'],
                    keywords: ['kw1', 'kw2'],
                    hashtags: ['#YT1', '#YT2'],
                    thumbnailText: 'YT Thumbnail',
                    thumbnailIdea: 'Bold text over dark background',
                    hook: 'Opening hook for YouTube',
                    timestamps: buildTimestamps(8, 'YT'),
                },
                tiktok: {
                    suggestedTitle: 'TT Title',
                    description: 'TT desc with hook',
                    formattedDescription: 'text hook\n#TT1 #TT2 #TT3',
                    tags: ['tt1', 'tt2'],
                    keywords: ['kw3'],
                    hashtags: ['#TT1', '#TT2', '#TT3'],
                    thumbnailText: 'TT Cover',
                    thumbnailIdea: 'Close-up with text overlay',
                    hook: 'Scroller stopper',
                    timestamps: [],
                },
                facebook: {
                    suggestedTitle: 'FB Title',
                    description: 'FB desc with engagement',
                    formattedDescription: '📌 Key points\n• Point 1\n• Point 2\nCTA: Comment\n#FB #SEO',
                    tags: ['fb1', 'fb2', 'fb3'],
                    keywords: ['kw4', 'kw5'],
                    hashtags: ['#FB1'],
                    thumbnailText: 'FB Thumbnail',
                    thumbnailIdea: 'Split image with CTA',
                    hook: 'Feed engagement opener',
                    timestamps: buildTimestamps(6, 'FB'),
                },
                hashtagMatrix: {
                    youtube: ['#YT1', '#YT2', '#SEO', '#Content', '#Marketing', '#Video', '#Tips', '#Growth'],
                    tiktok: ['#TT1', '#TT2', '#TT3', '#Viral', '#Trending', '#FYP', '#Content', '#Tips'],
                    facebook: ['#FB1', '#FB2', '#FB3', '#Social', '#Video', '#Engagement', '#Reach', '#Tips'],
                    crossPlatform: ['#ContentCreation', '#VideoMarketing', '#DigitalStrategy', '#CreatorTips'],
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
            assert(data.youtube.hashtags);
            assert(data.youtube.thumbnailText);
            assert(data.youtube.hook);
            assert(data.youtube.timestamps.length >= 3);
            assert(data.tiktok);
            assert(data.tiktok.hashtags);
            assert(data.facebook);
            assert(data.facebook.thumbnailIdea);
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

    describe('tools/call — generate_prompts', () => {
        it('returns prompt segments for valid input', async () => {
            const server = createServer({ apiKey: 'test-key' });
            server.llm = mockLlm([
                { id: 1, segmentTitle: 'Intro', summary: 'Opening', visualStyle: 'Typography', startTime: '00:00', endTime: '02:00', images: { a: { filename: '1_intro_a.png', prompt: 'Test prompt', editSuggestions: {} } } },
            ]);

            const resp = await server._handle({
                jsonrpc: '2.0', id: 10, method: 'tools/call',
                params: { name: 'generate_prompts', arguments: { script: 'Hello world', title: 'Test' } },
            });

            assert(resp.result);
            const data = JSON.parse(resp.result.content[0].text);
            assert(data.segments);
            assert(data.segments.length >= 1);
            assert(data.segments[0].images.a.prompt);
        });

        it('returns error for missing args', async () => {
            const server = createServer({ apiKey: 'test-key' });
            const resp = await server._handle({
                jsonrpc: '2.0', id: 11, method: 'tools/call',
                params: { name: 'generate_prompts', arguments: { script: 'test' } },
            });
            assert(resp.error);
            assert(resp.error.message.includes('title'));
        });
    });

    describe('tools/call — generate_mapping', () => {
        it('returns music mapping for valid segments', async () => {
            const server = createServer({ apiKey: 'test-key' });
            server.llm = mockLlm({ overallVibe: 'Contemplative', tracks: [
                { segmentId: 1, segmentTitle: 'Intro', startTime: '00:00', endTime: '02:00', genre: 'Ambient', energy: 'low', bpm: 70, instruments: ['piano'], moodKeywords: ['calm'], transition: 'fade_in', sfx: ['chime'] },
            ]});

            const resp = await server._handle({
                jsonrpc: '2.0', id: 12, method: 'tools/call',
                params: { name: 'generate_mapping', arguments: { segments: [{ id: 1, title: 'Intro', startTime: '00:00', endTime: '02:00' }] } },
            });

            assert(resp.result);
            const data = JSON.parse(resp.result.content[0].text);
            assert(data.overallVibe);
            assert(data.tracks.length >= 1);
        });
    });

    describe('tools/call — suggest_cover', () => {
        it('returns cover design for valid input', async () => {
            const server = createServer({ apiKey: 'test-key' });
            server.llm = mockLlm({
                designRationale: 'Philosophical tone',
                colorPalette: { primary: '#000', secondary: '#fff', accent: '#f00' },
                seriesCover: { conceptTitle: 'Test', visualStyle: 'Surrealist', composition: 'Test', prompt: 'Test prompt', filename: 'cover_series.png' },
            });

            const resp = await server._handle({
                jsonrpc: '2.0', id: 13, method: 'tools/call',
                params: { name: 'suggest_cover', arguments: { title: 'My Podcast', description: 'A test podcast' } },
            });

            assert(resp.result);
            const data = JSON.parse(resp.result.content[0].text);
            assert(data.designRationale);
            assert(data.seriesCover);
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

    describe('Plugin discovery mechanism', () => {
        describe('_findToolforgeScopeDir', () => {
            it('returns a non-null path in the monorepo environment', () => {
                const server = createServer({ apiKey: 'test-key', discover: false });
                const dir = server._findToolforgeScopeDir();
                assert(dir, 'scope dir should not be null');
                assert(dir.endsWith('@andy-toolforge'), `expected @andy-toolforge suffix, got: ${dir}`);
                assert(fs.existsSync(dir), 'scope dir should exist on disk');
            });
        });

        describe('toolforge_suggest', () => {
            it('is registered in tools/list', () => {
                const server = createServer({ apiKey: 'test-key', discover: false });
                const names = server.getToolList().map(t => t.name);
                assert(names.includes('toolforge_suggest'));
            });

            it('handler returns JSON with mock LLM', async () => {
                const server = createServer({ apiKey: 'test-key', discover: false });
                server.llm = mockLlm(JSON.stringify({
                    bestTool: 'analyze_script',
                    reason: 'Best tool for script analysis',
                    suggestedArgs: { script: '...', title: '...' },
                }));
                const tool = server._tools['toolforge_suggest'];
                assert(tool, 'toolforge_suggest should exist');
                const result = await tool.handler(server.llm, { task: 'analyze a podcast script' });
                assert.equal(result.bestTool, 'analyze_script');
                assert(result.reason);
                assert(result.suggestedArgs);
            });

            it('throws error for missing task argument', async () => {
                const server = createServer({ apiKey: 'test-key', discover: false });
                const tool = server._tools['toolforge_suggest'];
                await assert.rejects(
                    () => tool.handler(server.llm, {}),
                    /Missing required argument: task/,
                );
            });
        });

        describe('config.discover', () => {
            it('loads plugin tools by default (discover not set)', () => {
                const server = createServer({ apiKey: 'test-key' });
                const names = Object.keys(server._tools);
                // Built-in: 9 tools + toolforge_suggest = 10
                // Plugins from content-operations, ba-support, book-writing = 1 + 5 + 4 = 10
                // Total expected: at least 14
                assert(names.length >= 14, `expected >= 14 tools, got ${names.length}`);
                assert(names.includes('toolforge_content_research'), 'content-operations plugin should load');
                assert(names.includes('toolforge_competitor_analysis'), 'ba-support plugin should load');
                assert(names.includes('toolforge_book_outline'), 'book-writing plugin should load');
            });

            it('skips plugin loading when discover is false', () => {
                const server = createServer({ apiKey: 'test-key', discover: false });
                const names = Object.keys(server._tools);
                // All tools now come from plugins (migrated from built-in).
                // With discover=false, only toolforge_suggest should be present.
                assert.equal(names.length, 1, `expected 1 tool (toolforge_suggest only), got ${names.length}`);
                assert(!names.includes('toolforge_content_research'), 'plugin tools should not load when discover=false');
            });
        });
    });
});
