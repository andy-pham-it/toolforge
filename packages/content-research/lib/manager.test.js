const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ArticleManager = require('./manager');
const { LLMClient } = require('./llm');

describe('ArticleManager', () => {
    it('processes article correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.manageArticle = async (content, title, action, lang) => {
            assert.equal(content, 'Article content');
            assert.equal(title, 'Article Title');
            assert.equal(action, 'summarize');
            assert.equal(lang, 'en');
            return { articleId: '123', title: 'Article Title', summary: 'Summary' };
        };

        const manager = new ArticleManager({});
        manager.llm = mockLlm;

        const result = await manager.processArticle('Article content', 'Article Title', 'summarize', 'en');
        assert.equal(result.articleId, '123');
        assert.equal(result.summary, 'Summary');
    });

    it('throws error if articleContent, articleTitle, or action is missing', async () => {
        const manager = new ArticleManager({});
        await assert.rejects(() => manager.processArticle(null, 'Title', 'Action'), /articleContent/);
        await assert.rejects(() => manager.processArticle('Content', null, 'Action'), /articleTitle/);
        await assert.rejects(() => manager.processArticle('Content', 'Title', null), /action/);
    });
});
