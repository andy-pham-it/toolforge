const assert = require('node:assert');
const { handler } = require('./seo-generate');

// Mock LLM client
const mockLLM = {
    chat: async (sys, user, json) => {
        return JSON.stringify({
            youtube: { suggestedTitle: 'YT Title', tags: ['tag1'] },
            tiktok: { suggestedTitle: 'TT Title', tags: ['tag2'] },
            facebook: { suggestedTitle: 'FB Title', tags: ['tag3'] }
        });
    }
};

async function testSeoGenerate() {
    const result = await handler(mockLLM, { script: 'test script', title: 'test title' });
    assert.strictEqual(result.youtube.suggestedTitle, 'YT Title');
    console.log('testSeoGenerate passed');
}

testSeoGenerate().catch(err => {
    console.error(err);
    process.exit(1);
});
