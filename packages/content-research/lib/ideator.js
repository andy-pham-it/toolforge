const { LLMClient } = require('./llm');

class ContentIdeator {
    constructor(config) {
        this.llm = new LLMClient(config);
    }

    async generate(topic, audience, format, numIdeas, lang) {
        if (!topic || !audience || !format) {
            throw new Error('Missing required arguments: topic, audience, format');
        }
        return this.llm.generateContentIdeas(topic, audience, format, numIdeas, lang);
    }
}

module.exports = ContentIdeator;
