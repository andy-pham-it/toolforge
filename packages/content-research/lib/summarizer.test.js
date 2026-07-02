const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ContentSummarizer = require('./summarizer');
const { LLMClient } = require('./llm');

describe('ContentSummarizer', () => {
    it('summarizes content correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.summarizeContent = async (content, title, lang) => {
            assert.equal(content, 'Test content');
            assert.equal(title, 'Test Title');
            assert.equal(lang, 'en');
            return { title: 'Summary Title', summary: 'Summary text', keyPoints: ['Point 1'] };
        };

        const summarizer = new ContentSummarizer({});
        summarizer.llm = mockLlm;

        const result = await summarizer.summarize('Test content', 'Test Title', 'en');
        assert.equal(result.title, 'Summary Title');
        assert.equal(result.summary, 'Summary text');
        assert.deepStrictEqual(result.keyPoints, ['Point 1']);
    });

    it('throws error if content or title is missing', async () => {
        const summarizer = new ContentSummarizer({});
        await assert.rejects(() => summarizer.summarize(null, 'Title'), /content/);
        await assert.rejects(() => summarizer.summarize('Content', null), /title/);
    });
});
