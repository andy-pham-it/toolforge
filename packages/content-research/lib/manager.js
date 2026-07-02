const { LLMClient } = require('./llm');

class ArticleManager {
    constructor(config) {
        this.llm = new LLMClient(config);
    }

    async processArticle(articleContent, articleTitle, action, lang) {
        if (!articleContent || !articleTitle || !action) {
            throw new Error('Missing required arguments: articleContent, articleTitle, action');
        }
        return this.llm.manageArticle(articleContent, articleTitle, action, lang);
    }
}

module.exports = ArticleManager;
