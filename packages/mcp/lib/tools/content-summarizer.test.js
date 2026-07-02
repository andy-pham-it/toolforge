const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./content-summarizer');

describe('andy_toolforge_content_summarizer handler', () => {
    function mockLlm(result) {
        return {
            apiKey: 'test-key',
            model: 'gemini-2.0-flash',
            summarizeContent: async (_content, _title, _lang) => result,
        };
    }

    it('returns summary for valid input', async () => {
        const mockResult = { summary: 'Key points...', wordCount: 500, topics: ['tech'] };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            content: 'Long article text...',
            title: 'Test Article',
        });
        assert.equal(result.summary, 'Key points...');
        assert.equal(result.wordCount, 500);
    });

    it('returns error when content missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { title: 'Test' }),
            /content/
        );
    });

    it('returns error when title missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { content: 'test' }),
            /title/
        );
    });

    it('passes language parameter', async () => {
        const mockResult = { summary: 'Tóm tắt...' };
        const llm = mockLlm(mockResult);
        const result = await handler(llm, {
            content: 'Nội dung dài...',
            title: 'Bài viết',
            lang: 'vi',
        });
        assert.equal(result.summary, 'Tóm tắt...');
    });


});
