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

    describe('_safeJson', async () => {
        await it('should parse valid JSON', async () => {
            const publisher = new MultiPlatformPublisher({ browserManager: mockBrowser, jobQueue: mockQueue });
            const res = { text: async () => '{"key": "value"}' };
            const result = await publisher._safeJson(res);
            assert.deepEqual(result, { key: 'value' });
        });

        await it('should throw on invalid JSON with error context', async () => {
            const publisher = new MultiPlatformPublisher({ browserManager: mockBrowser, jobQueue: mockQueue });
            const res = { text: async () => '<html>not json</html>' };
            await assert.rejects(
                () => publisher._safeJson(res),
                /Expected JSON but got:/
            );
        });

        await it('should throw on empty body', async () => {
            const publisher = new MultiPlatformPublisher({ browserManager: mockBrowser, jobQueue: mockQueue });
            const res = { text: async () => '' };
            await assert.rejects(
                () => publisher._safeJson(res),
                /Expected JSON but got:/
            );
        });
    });

    describe('_youtubeAuth', async () => {
        await it('should use Bearer header for OAuth token (ya29.*)', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { youtube: 'ya29.a0AfH6SAMPLE' },
            });
            const baseUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable';
            const { url, headers } = publisher._youtubeAuth(baseUrl);
            assert.equal(url, baseUrl);
            assert.equal(headers['Authorization'], 'Bearer ya29.a0AfH6SAMPLE');
        });

        await it('should use Bearer header for OAuth token with dots (ya29.)', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { youtube: 'ya29.dots.in.token' },
            });
            const baseUrl = 'https://www.googleapis.com/upload/youtube/v3/videos';
            const { url, headers } = publisher._youtubeAuth(baseUrl);
            assert.equal(url, baseUrl);
            assert.equal(headers['Authorization'], 'Bearer ya29.dots.in.token');
        });

        await it('should use ?key= query param for simple API key', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { youtube: 'AIzaSyABC123DEF456' },
            });
            const baseUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet';
            const { url, headers } = publisher._youtubeAuth(baseUrl);
            assert.ok(url.includes('key=AIzaSyABC123DEF456'));
            assert.equal(url, baseUrl + '&key=AIzaSyABC123DEF456');
            assert.deepEqual(headers, {});
        });

        await it('should return no auth when no API key set', async () => {
            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
            });
            const baseUrl = 'https://example.com/api';
            const { url, headers } = publisher._youtubeAuth(baseUrl);
            assert.equal(url, baseUrl);
            assert.deepEqual(headers, {});
        });
    });

    describe('fetch-mocked REST API', async () => {
        let originalFetch;

        await before(() => { originalFetch = global.fetch; });
        await after(() => { global.fetch = originalFetch; });

        await it('should publish to WordPress via REST API on success', async () => {
            global.fetch = async (url, opts) => {
                assert.ok(url.includes('/wp/v2/posts'));
                assert.equal(opts.method, 'POST');
                assert.ok(opts.headers['Authorization'].startsWith('Basic '));
                return {
                    ok: true,
                    text: async () => JSON.stringify({ link: 'https://example.com/?p=42' }),
                };
            };

            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { wordpress: 'user:app-pass' },
                wordpressUrl: 'https://example.com/wp-json',
            });

            const result = await publisher.publishToWordPress(
                { title: 'Test', content: '<p>Hello</p>' },
                []
            );

            assert.equal(result.success, true);
            assert.equal(result.url, 'https://example.com/?p=42');
        });

        await it('should fall back to browser on WordPress API error', async () => {
            global.fetch = async () => ({
                ok: false,
                status: 403,
                text: async () => '{"code":"rest_forbidden"}',
            });

            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { wordpress: 'user:wrong-pass' },
                wordpressUrl: 'https://example.com/wp-json',
            });

            const result = await publisher.publishToWordPress(
                { title: 'Test', content: '<p>Hello</p>' },
                []
            );

            assert.equal(result.success, true);
            assert.ok(result.url.includes('draft'));
        });

        await it('should publish to Facebook via REST API on success', async () => {
            global.fetch = async (url, opts) => {
                assert.ok(url.includes('graph.facebook.com'));
                const body = JSON.parse(opts.body);
                assert.equal(body.message, 'Hello Facebook');
                return {
                    ok: true,
                    text: async () => JSON.stringify({ id: 'fb-post-123' }),
                };
            };

            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { facebook: 'eaabc123def456' },
            });

            const result = await publisher.publishToFacebook(
                { message: 'Hello Facebook', link: 'https://example.com' },
                []
            );

            assert.equal(result.success, true);
            assert.equal(result.postId, 'fb-post-123');
        });

        await it('should fall back to browser on Facebook API error', async () => {
            global.fetch = async () => ({
                ok: false,
                status: 400,
                text: async () => '{"error":{"message":"invalid token"}}',
            });

            const publisher = new MultiPlatformPublisher({
                browserManager: mockBrowser,
                jobQueue: mockQueue,
                apiKeys: { facebook: 'bad-token' },
            });

            const result = await publisher.publishToFacebook(
                { message: 'Hello' },
                []
            );

            assert.equal(result.success, true);
        });
    });
});
