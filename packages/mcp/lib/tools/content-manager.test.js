const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./content-manager');

describe('andy_toolforge_article_manager handler', () => {
    function mockLlm(result) {
        return {
            apiKey: 'test-key',
            model: 'gemini-2.0-flash',
            manageArticle: async (_content, _title, _action, _lang) => result,
        };
    }

    it('returns result for valid input', async () => {
        const mockResult = { category: 'tech', tags: ['AI', 'ML'], summary: 'Article about AI' };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            articleContent: 'Full article text...',
            articleTitle: 'AI in 2026',
            action: 'classify',
        });
        assert.equal(result.category, 'tech');
        assert(result.tags.includes('AI'));
    });

    it('returns error when articleContent missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { articleTitle: 'Test', action: 'classify' }),
            /articleContent/
        );
    });

    it('returns error when articleTitle missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { articleContent: 'text', action: 'classify' }),
            /articleTitle/
        );
    });

    it('returns error when action missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { articleContent: 'text', articleTitle: 'Test' }),
            /action/
        );
    });

    it('passes lang parameter', async () => {
        const mockResult = { category: 'công nghệ' };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            articleContent: 'text',
            articleTitle: 'Test',
            action: 'classify',
            lang: 'vi',
        });
        assert.equal(result.category, 'công nghệ');
    });
});
