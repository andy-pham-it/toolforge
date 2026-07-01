const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const ContentCreator = require('./creator');
const { ContentCreatorError } = require('./errors');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };
const mockLLM = {
    chat: async (prompt) => {
        // Use prompt startsWith for unambiguous matching
        if (prompt.startsWith('You are a blog writer')) return JSON.stringify({
            title: 'Getting Started with Content Marketing',
            metaDescription: 'Learn content marketing from scratch',
            slug: 'getting-started-content-marketing',
            content: '<h1>Getting Started</h1><p>Content marketing is essential.</p>',
            estimatedReadingTime: 5,
            keywordsUsed: ['content marketing'],
        });
        if (prompt.startsWith('You are a scriptwriter')) return JSON.stringify({
            hook: 'Did you know content marketing drives 3x more leads?',
            segments: [{ timestamp: '0:00', duration: '15s', visual: 'Host intro', dialogue: 'Welcome!' }],
            callToAction: 'Subscribe for more',
            estimatedWordCount: 150,
            keyTakeaways: ['Content marketing works'],
        });
        if (prompt.startsWith('You are a social media copywriter')) return JSON.stringify({
            post: 'Content marketing is the future!',
            hashtags: ['#marketing', '#content'],
            bestPostingTime: '10:00 AM',
            characterCount: 120,
            tips: ['Use images', 'Add CTA'],
        });
        if (prompt.startsWith('You are an SEO specialist')) return JSON.stringify({
            optimizedContent: 'Optimized version of the content',
            seoScore: 85,
            improvements: ['Added keywords', 'Better structure'],
            keywordDensity: { marketing: 2.5 },
            missingElements: ['Meta description'],
            recommendations: ['Add more internal links'],
        });
        if (prompt.startsWith('You are a hashtag strategist')) return JSON.stringify({
            hashtags: ['marketing', 'contentstrategy', 'digitalmarketing'],
            categories: { highVolume: ['marketing'], niche: ['contentstrategy'], brand: [] },
            recommendation: '#marketing #contentstrategy #digitalmarketing',
        });
        if (prompt.startsWith('You are a thumbnail designer')) return JSON.stringify({
            ideas: [{ title: 'Bold Text Overlay', description: 'Big bold text with contrasting background', visualElements: ['Text', 'Icon'], textOverlay: 'CONTENT MARKETING', colorScheme: 'Blue/White', style: 'Minimal' }],
            topPick: 'Bold Text Overlay',
            compositionTips: ['Use contrasting colors'],
        });
        if (prompt.startsWith('You are a content expander')) return JSON.stringify({
            expandedOutline: '1. Introduction\n2. Main Content\n3. Conclusion',
            sections: [{ heading: 'Introduction', subheadings: ['Hook', 'Context'], keyPoints: ['Start strong'], suggestedWordCount: 300 }],
            totalEstimatedWords: 1500,
        });
        if (prompt.startsWith('You are a headline writer')) return JSON.stringify({
            headlines: [{ headline: '10 Tips for Content Marketing', type: 'Listicle', estimatedCTR: 'high', emotionalAppeal: 'Curiosity' }],
            bestPick: '10 Tips for Content Marketing',
            tips: ['Use numbers', 'Create urgency'],
        });
        return JSON.stringify({});
    },
};

describe('ContentCreator', async () => {
    let creator;

    before(() => {
        creator = new ContentCreator({ logger: mockLogger, llmClient: mockLLM });
    });

    describe('constructor', async () => {
        await it('should create instance with defaults', () => {
            const c = new ContentCreator();
            assert.ok(c.logger);
            assert.strictEqual(c.llmClient, null);
        });
    });

    describe('writeBlogPost', async () => {
        await it('should return blog post for valid topic', async () => {
            const result = await creator.writeBlogPost('content marketing');
            assert.ok(result.title);
            assert.ok(result.content);
            assert.equal(result.topic, 'content marketing');
        });

        await it('should throw for empty topic', async () => {
            await assert.rejects(
                () => creator.writeBlogPost(''),
                ContentCreatorError
            );
        });

        await it('should throw without LLMClient', async () => {
            const c = new ContentCreator({ logger: mockLogger });
            await assert.rejects(
                () => c.writeBlogPost('topic'),
                /LLMClient is required/
            );
        });
    });

    describe('writeScript', async () => {
        await it('should return script for valid input', async () => {
            const result = await creator.writeScript('content marketing', 60, 'youtube');
            assert.ok(result.hook);
            assert.ok(Array.isArray(result.segments));
        });

        await it('should throw for invalid duration', async () => {
            await assert.rejects(
                () => creator.writeScript('topic', 10, 'youtube'),
                ContentCreatorError
            );
            await assert.rejects(
                () => creator.writeScript('topic', 4000, 'youtube'),
                ContentCreatorError
            );
        });

        await it('should throw for invalid format', async () => {
            await assert.rejects(
                () => creator.writeScript('topic', 60, 'unknown'),
                ContentCreatorError
            );
        });
    });

    describe('writeSocialPost', async () => {
        await it('should return social post for valid input', async () => {
            const result = await creator.writeSocialPost('Content is king', 'facebook', 'professional');
            assert.ok(result.post);
            assert.ok(Array.isArray(result.hashtags));
        });

        await it('should throw for empty content', async () => {
            await assert.rejects(
                () => creator.writeSocialPost(''),
                ContentCreatorError
            );
        });

        await it('should throw for invalid platform', async () => {
            await assert.rejects(
                () => creator.writeSocialPost('content', 'myspace', 'professional'),
                ContentCreatorError
            );
        });
    });

    describe('optimizeForSEO', async () => {
        await it('should return SEO optimization', async () => {
            const result = await creator.optimizeForSEO('Some content here', 'blog', ['marketing']);
            assert.ok(result.optimizedContent);
            assert.ok(typeof result.seoScore === 'number');
        });

        await it('should throw for empty content', async () => {
            await assert.rejects(
                () => creator.optimizeForSEO(''),
                ContentCreatorError
            );
        });

        await it('should throw for non-array keywords', async () => {
            await assert.rejects(
                () => creator.optimizeForSEO('content', 'blog', 'not-array'),
                ContentCreatorError
            );
        });
    });

    describe('generateHashtags', async () => {
        await it('should return hashtags for valid input', async () => {
            const result = await creator.generateHashtags('marketing', 'tiktok', 5);
            assert.ok(Array.isArray(result.hashtags));
        });

        await it('should throw for invalid platform', async () => {
            await assert.rejects(
                () => creator.generateHashtags('topic', 'unknown', 5),
                ContentCreatorError
            );
        });

        await it('should throw for invalid count', async () => {
            await assert.rejects(
                () => creator.generateHashtags('topic', 'tiktok', 0),
                ContentCreatorError
            );
            await assert.rejects(
                () => creator.generateHashtags('topic', 'tiktok', 50),
                ContentCreatorError
            );
        });
    });

    describe('generateThumbnailIdeas', async () => {
        await it('should return thumbnail ideas', async () => {
            const result = await creator.generateThumbnailIdeas('content marketing');
            assert.ok(Array.isArray(result.ideas));
            assert.ok(result.topPick);
        });

        await it('should throw for invalid platform', async () => {
            await assert.rejects(
                () => creator.generateThumbnailIdeas('topic', 'unknown'),
                ContentCreatorError
            );
        });

        await it('should throw for empty topic', async () => {
            await assert.rejects(
                () => creator.generateThumbnailIdeas(''),
                ContentCreatorError
            );
        });
    });

    describe('expandOutline', async () => {
        await it('should return expanded outline', async () => {
            const result = await creator.expandOutline('1. Intro 2. Body 3. Conclusion', 2);
            assert.ok(result.expandedOutline);
            assert.ok(Array.isArray(result.sections));
        });

        await it('should throw for empty outline', async () => {
            await assert.rejects(
                () => creator.expandOutline(''),
                ContentCreatorError
            );
        });

        await it('should throw for invalid depth', async () => {
            await assert.rejects(
                () => creator.expandOutline('outline', 0),
                ContentCreatorError
            );
            await assert.rejects(
                () => creator.expandOutline('outline', 10),
                ContentCreatorError
            );
        });
    });

    describe('suggestHeadlines', async () => {
        await it('should return headline suggestions', async () => {
            const result = await creator.suggestHeadlines(['content marketing'], 5);
            assert.ok(Array.isArray(result.headlines));
        });

        await it('should throw for empty keywords', async () => {
            await assert.rejects(
                () => creator.suggestHeadlines([]),
                ContentCreatorError
            );
        });

        await it('should throw for non-array keywords', async () => {
            await assert.rejects(
                () => creator.suggestHeadlines('not-array'),
                ContentCreatorError
            );
        });

        await it('should throw for invalid count', async () => {
            await assert.rejects(
                () => creator.suggestHeadlines(['kw'], 0),
                ContentCreatorError
            );
            await assert.rejects(
                () => creator.suggestHeadlines(['kw'], 30),
                ContentCreatorError
            );
        });
    });
});
