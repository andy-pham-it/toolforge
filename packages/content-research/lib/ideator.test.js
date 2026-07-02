const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ContentIdeator = require('./ideator');
const { LLMClient } = require('./llm');

describe('ContentIdeator', () => {
    it('generates content ideas correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.generateContentIdeas = async (topic, audience, format, numIdeas, lang) => {
            assert.equal(topic, 'AI');
            assert.equal(audience, 'Developers');
            assert.equal(format, 'Blog Post');
            assert.equal(numIdeas, 2);
            assert.equal(lang, 'en');
            return { topic: 'AI', ideas: [{ title: 'Idea 1' }] };
        };

        const ideator = new ContentIdeator({});
        ideator.llm = mockLlm;

        const result = await ideator.generate('AI', 'Developers', 'Blog Post', 2, 'en');
        assert.equal(result.topic, 'AI');
        assert.equal(result.ideas[0].title, 'Idea 1');
    });

    it('throws error if topic, audience, or format is missing', async () => {
        const ideator = new ContentIdeator({});
        await assert.rejects(() => ideator.generate(null, 'Audience', 'Format'), /topic/);
        await assert.rejects(() => ideator.generate('Topic', null, 'Format'), /audience/);
        await assert.rejects(() => ideator.generate('Topic', 'Audience', null), /format/);
    });
});
