const { LLMClient } = require('./llm');

class ContentSummarizer {
    constructor(config) {
        this.llm = new LLMClient(config);
    }

    async summarize(content, title, lang) {
        if (!content || !title) {
            throw new Error('Missing required arguments: content, title');
        }
        return this.llm.summarizeContent(content, title, lang);
    }
}

module.exports = ContentSummarizer;
