const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./content-ideator');

describe('andy_toolforge_content_ideator handler', () => {
    function mockLlm(result) {
        return {
            apiKey: 'test-key',
            model: 'gemini-2.0-flash',
            generateContentIdeas: async (_topic, _audience, _format, _num, _lang) => result,
        };
    }

    it('returns ideas for valid input', async () => {
        const mockResult = { ideas: [{ title: 'Idea 1', description: 'Desc' }] };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            topic: 'AI trends',
            audience: 'developers',
            format: 'blog',
        });
        assert(result.ideas);
        assert.equal(result.ideas[0].title, 'Idea 1');
    });

    it('returns error when topic missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { audience: 'devs', format: 'blog' }),
            /topic/
        );
    });

    it('returns error when audience missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { topic: 'AI', format: 'blog' }),
            /audience/
        );
    });

    it('returns error when format missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { topic: 'AI', audience: 'devs' }),
            /format/
        );
    });

    it('passes numIdeas and lang parameters', async () => {
        const mockResult = { ideas: [{ title: 'Ý tưởng' }] };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            topic: 'AI',
            audience: 'devs',
            format: 'video',
            numIdeas: 5,
            lang: 'vi',
        });
        assert(result.ideas);
    });
});
