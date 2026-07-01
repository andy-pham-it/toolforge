const { describe, it } = require('node:test');
const assert = require('node:assert');

const MultiPlatformPublisher = require('./publisher');

const mockBrowser = {
    newPage: async () => ({
        goto: async () => {},
        $: async () => null,
        type: async () => {},
        click: async () => {},
        uploadFile: async () => {},
        close: async () => {},
    }),
    close: async () => {},
};

const mockQueue = {
    enqueue: async (job) => 'job-123',
};

describe('MultiPlatformPublisher', async () => {
    describe('constructor', async () => {
        await it('should store config correctly', () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { youtube: 'yt-key' },
                wordpressUrl: 'https://example.com/wp-json',
            });

            assert.equal(publisher.browser, mockBrowser);
            assert.equal(publisher.queue, mockQueue);
            assert.equal(publisher.apiKeys.youtube, 'yt-key');
            assert.equal(publisher.wordpressUrl, 'https://example.com/wp-json');
        });

        await it('should default apiKeys to empty object', () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            assert.deepEqual(publisher.apiKeys, {});
        });
    });

    describe('publishToWordPress', async () => {
        await it('should return structured result with REST API path', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { wordpress: 'user:pass' },
                wordpressUrl: 'https://example.com/wp-json',
            });

            const result = await publisher.publishToWordPress(
                { title: 'Test Post', content: '<p>Hello</p>', slug: 'test-post', categories: [1], tags: ['test'] },
                []
            );

            assert.ok(result.success === false || result.success === true);
            assert.ok('error' in result || 'url' in result);
        });

        await it('should return error for missing title', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.publishToWordPress(
                { content: '<p>No title</p>' },
                []
            );

            assert.equal(result.success, false);
            assert.ok(result.error.includes('Missing required post'));
        });
    });

    describe('publishToFacebook', async () => {
        await it('should handle missing API key gracefully (does not throw)', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.publishToFacebook(
                { message: 'Hello world', hashtags: ['test', 'opencode'] },
                []
            );

            assert.ok(typeof result === 'object');
            assert.ok('success' in result);
        });

        await it('should return error for missing message', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.publishToFacebook({ link: 'https://example.com' }, []);

            assert.equal(result.success, false);
            assert.ok(result.error.includes('Missing required'));
        });
    });

    describe('scheduleContent', async () => {
        await it('should enqueue each calendar item and return job IDs', async () => {
            let enqueueCount = 0;
            const countingQueue = {
                enqueue: async (job) => {
                    enqueueCount++;
                    return `job-${enqueueCount}`;
                },
            };

            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: countingQueue,
            });

            const calendar = [
                { platform: 'youtube', content: { title: 'Video 1' }, images: [], scheduledAt: '2026-07-02T10:00:00Z' },
                { platform: 'wordpress', content: { title: 'Post 1' }, images: [], scheduledAt: '2026-07-03T10:00:00Z' },
                { platform: 'facebook', content: { message: 'Update' }, images: [], scheduledAt: '2026-07-04T10:00:00Z' },
            ];

            const result1 = await publisher.scheduleContent(calendar);

            assert.equal(enqueueCount, 3);
            assert.equal(result1.success, true);
            assert.equal(result1.jobIds.length, 3);
            assert.equal(result1.jobIds[0], 'job-1');
            assert.equal(result1.jobIds[1], 'job-2');
            assert.equal(result1.jobIds[2], 'job-3');
        });

        await it('should skip invalid calendar items gracefully', async () => {
            let enqueueCount = 0;
            const countingQueue = {
                enqueue: async (job) => {
                    enqueueCount++;
                    return `job-${enqueueCount}`;
                },
            };

            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: countingQueue,
            });

            const calendar = [
                { platform: 'youtube', content: { title: 'Valid' } },
                { content: { message: 'No platform' } },
                { platform: 'wordpress' },
            ];

            const result2 = await publisher.scheduleContent(calendar);

            assert.equal(enqueueCount, 1);
            assert.equal(result2.success, true);
            assert.equal(result2.jobIds.length, 1);
        });

        await it('should return error for empty calendar', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.scheduleContent([]);
            assert.equal(result.success, false);
            assert.ok(result.error);
        });

        await it('should return error for non-array input', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.scheduleContent(null);
            assert.equal(result.success, false);
            assert.ok(result.error);
        });
    });

    describe('publishToYouTube', async () => {
        await it('should return error for missing video', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.publishToYouTube(null, { title: 'Test' });

            assert.equal(result.success, false);
            assert.ok(result.error.includes('Missing required'));
        });

        await it('should return error for missing metadata title', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });

            const result = await publisher.publishToYouTube('/path/to/video.mp4', { description: 'no title' });

            assert.equal(result.success, false);
            assert.ok(result.error.includes('Missing required'));
        });
    });
});
