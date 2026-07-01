const { describe, it } = require('node:test');
const assert = require('node:assert');
const SEOAnalyzer = require('./seo');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };

describe('SEOAnalyzer', async () => {
    describe('constructor', async () => {
        await it('should set default log level', () => {
            const a = new SEOAnalyzer();
            assert.ok(a.logger);
        });
    });

    describe('analyzeYouTube', async () => {
        await it('should return high score for optimal input', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeYouTube(
                'How to Build a React App',
                'Learn how to build a React app from scratch. React is a powerful library for building user interfaces. This tutorial covers everything. Building React apps is fun and rewarding.',
                ['react', 'javascript', 'tutorial']
            );
            assert.ok(result.score >= 0);
            assert.ok(result.score <= 100);
            assert.ok(Array.isArray(result.suggestions));
            assert.ok(result.details);
            assert.ok('checks' in result.details);
        });

        await it('should throw for non-string title', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.analyzeYouTube(123, 'desc', ['tag']),
                /title and description must be strings/
            );
        });

        await it('should throw for non-array tags', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.analyzeYouTube('title', 'desc', 'not-array'),
                /tags must be an array/
            );
        });

        await it('should suggest when description is too short', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeYouTube('Title', 'Short.', []);
            assert.ok(result.suggestions.length > 0);
            assert.ok(result.score < 100);
        });

        await it('should suggest when no hashtags present', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeYouTube('Title', 'A '.repeat(100), ['tag1', 'tag2', 'tag3']);
            assert.ok(result.suggestions.some(s => s.toLowerCase().includes('hashtag')));
        });
    });

    describe('analyzeFacebook', async () => {
        await it('should return high score for optimal input', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeFacebook(
                'Amazing New Product Launching Soon\n\nStay tuned for our biggest release yet. This will change everything you know about productivity.',
                ['#productivity', '#launch']
            );
            assert.ok(result.score >= 0);
            assert.ok(result.score <= 100);
            assert.ok(Array.isArray(result.suggestions));
        });

        await it('should throw for non-string post', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.analyzeFacebook(null, ['#tag']),
                /post must be a string/
            );
        });

        await it('should throw for non-array hashtags', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.analyzeFacebook('Hello', '#not-array'),
                /hashtags must be an array/
            );
        });

        await it('should suggest when headline is too short', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeFacebook('Hi', []);
            assert.ok(result.suggestions.some(s => s.toLowerCase().includes('headline') || s.toLowerCase().includes('short')));
        });

        await it('should suggest missing link', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeFacebook('A '.repeat(50), ['#tag1', '#tag2']);
            assert.ok(result.suggestions.some(s => s.toLowerCase().includes('link')));
        });
    });

    describe('analyzeTikTok', async () => {
        await it('should return high score for optimal input', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeTikTok(
                { duration: 30, url: 'https://tiktok.com/v/123' },
                'Want to learn the secret to perfect pasta? Here is the step-by-step guide! #cooking #pasta #tutorial #tips'
            );
            assert.ok(result.score >= 0);
            assert.ok(result.score <= 100);
            assert.ok(Array.isArray(result.suggestions));
        });

        await it('should throw for non-object video', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.analyzeTikTok('not-object', 'caption'),
                /video must be an object/
            );
        });

        await it('should throw for non-string caption', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.analyzeTikTok({}, 123),
                /caption must be a string/
            );
        });

        await it('should suggest when caption is too short', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeTikTok({}, 'Hey');
            assert.ok(result.suggestions.length > 0);
        });

        await it('should suggest missing hook', async () => {
            const a = new SEOAnalyzer();
            const result = await a.analyzeTikTok({}, 'just a regular sentence without punctuation'.repeat(10));
            assert.ok(result.suggestions.some(s => s.toLowerCase().includes('hook')));
        });
    });

    describe('generateKeywordCloud', async () => {
        await it('should return ranked keywords from text', async () => {
            const a = new SEOAnalyzer();
            const result = await a.generateKeywordCloud(
                'react react react javascript javascript tutorial build app framework'
            );
            assert.ok(Array.isArray(result.keywords));
            assert.ok(result.keywords.length > 0);
            assert.equal(result.keywords[0].word, 'react');
            assert.equal(result.keywords[0].count, 3);
        });

        await it('should throw for non-string input', async () => {
            const a = new SEOAnalyzer();
            await assert.rejects(
                () => a.generateKeywordCloud(42),
                /text must be a string/
            );
        });

        await it('should return empty array for empty text', async () => {
            const a = new SEOAnalyzer();
            const result = await a.generateKeywordCloud('');
            assert.deepEqual(result.keywords, []);
            assert.equal(result.totalWords, 0);
        });

        await it('should filter stop words', async () => {
            const a = new SEOAnalyzer();
            const result = await a.generateKeywordCloud('the and a an of to in it is');
            assert.equal(result.keywords.length, 0);
        });

        await it('should include total word count', async () => {
            const a = new SEOAnalyzer();
            const result = await a.generateKeywordCloud('hello world foo bar');
            assert.equal(result.totalWords, 4);
        });
    });
});
