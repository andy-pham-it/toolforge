const { describe, it } = require('node:test');
const assert = require('node:assert');
const ContentArbitrageEngine = require('./content-arbitrage');

const mockLLM = {
    chat: async (sys, usr) => 'Generated content for: ' + usr.slice(0, 50),
};

const jsonMockLLM = {
    chat: async (sys, usr, jsonMode) => {
        if (usr.length < 10) throw new Error('empty');
        if (jsonMode) {
            return JSON.stringify({ title: 'Test', meta: 'desc', content: 'body', imagePrompts: ['img1'] });
        }
        return 'plain text';
    },
};

describe('ContentArbitrageEngine', () => {
    describe('constructor', () => {
        it('should throw if llmClient is null', () => {
            assert.throws(() => new ContentArbitrageEngine(null), /LLMClient/);
        });

        it('should throw if llmClient has no chat method', () => {
            assert.throws(() => new ContentArbitrageEngine({}), /chat/);
        });

        it('should accept a valid llmClient', () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            assert.ok(engine instanceof ContentArbitrageEngine);
        });
    });

    describe('expandToBlog', () => {
        it('should return a structured object when LLM responds', async () => {
            const engine = new ContentArbitrageEngine(jsonMockLLM);
            const result = await engine.expandToBlog('source content for blog');
            assert.ok(typeof result === 'object');
            assert.ok('title' in result);
            assert.ok('meta' in result);
            assert.ok('content' in result);
            assert.ok('imagePrompts' in result);
        });

        it('should throw for empty source', async () => {
            const engine = new ContentArbitrageEngine(jsonMockLLM);
            await assert.rejects(() => engine.expandToBlog(''), /non-empty/);
            await assert.rejects(() => engine.expandToBlog('   '), /non-empty/);
            await assert.rejects(() => engine.expandToBlog(null), /non-empty/);
        });
    });

    describe('expandToThread', () => {
        it('should return a structured object with hook and replies', async () => {
            const threadMockLLM = {
                chat: async () => JSON.stringify({
                    hook: 'Did you know?',
                    replies: [{ number: 1, text: 'First reply' }],
                }),
            };
            const engine = new ContentArbitrageEngine(threadMockLLM);
            const result = await engine.expandToThread('source for thread');
            assert.ok(typeof result === 'object');
            assert.ok('hook' in result);
            assert.ok('replies' in result);
            assert.ok(Array.isArray(result.replies));
            assert.equal(result.replies[0].number, 1);
        });

        it('should throw for empty source', async () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            await assert.rejects(() => engine.expandToThread(''), /non-empty/);
        });
    });

    describe('expandToShort', () => {
        it('should return a structured short script object', async () => {
            const shortMockLLM = {
                chat: async () => JSON.stringify({
                    hook: 'Stop scrolling',
                    patternInterrupt: 'beat drop',
                    body: 'Here is the content',
                    cta: 'Follow now',
                    estimatedDuration: 70,
                }),
            };
            const engine = new ContentArbitrageEngine(shortMockLLM);
            const result = await engine.expandToShort('source for short');
            assert.ok(typeof result === 'object');
            assert.ok('hook' in result);
            assert.ok('patternInterrupt' in result);
            assert.ok('body' in result);
            assert.ok('cta' in result);
            assert.ok('estimatedDuration' in result);
        });

        it('should throw for empty source', async () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            await assert.rejects(() => engine.expandToShort(''), /non-empty/);
        });
    });

    describe('expandToPost', () => {
        it('should return a structured post object', async () => {
            const postMockLLM = {
                chat: async () => JSON.stringify({
                    body: 'Professional post content',
                    engagementQuestion: 'What do you think?',
                }),
            };
            const engine = new ContentArbitrageEngine(postMockLLM);
            const result = await engine.expandToPost('source for post');
            assert.ok(typeof result === 'object');
            assert.ok('body' in result);
            assert.ok('engagementQuestion' in result);
        });

        it('should throw for empty source', async () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            await assert.rejects(() => engine.expandToPost(''), /non-empty/);
        });
    });

    describe('translateTo', () => {
        it('should pass the correct target language in the prompt', async () => {
            let capturedSystemPrompt = '';
            const captureMock = {
                chat: async (sys, usr) => {
                    capturedSystemPrompt = sys;
                    return 'translated text';
                },
            };
            const engine = new ContentArbitrageEngine(captureMock);
            const result = await engine.translateTo('vi', 'Hello world');
            assert.ok(capturedSystemPrompt.includes('Vietnamese'));
            assert.ok(capturedSystemPrompt.includes('vi'));
            assert.equal(result, 'translated text');
        });

        it('should support all valid target languages', async () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            for (const lang of ['en', 'vi', 'jp', 'kr']) {
                const result = await engine.translateTo(lang, 'content here');
                assert.ok(typeof result === 'string');
            }
        });

        it('should throw for invalid target language', async () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            await assert.rejects(() => engine.translateTo('fr', 'content'), /one of/);
        });

        it('should throw for empty content', async () => {
            const engine = new ContentArbitrageEngine(mockLLM);
            await assert.rejects(() => engine.translateTo('en', ''), /non-empty/);
            await assert.rejects(() => engine.translateTo('vi', null), /non-empty/);
        });
    });
});
