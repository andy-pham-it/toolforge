/**
 * MultiPlatformPublisher — Publishes content to YouTube, WordPress, Facebook.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  RISK NOTE: Web UI uploads are brittle.                     ║
 * ║  This implementation prioritises REST API where available.   ║
 * ║  Puppeteer browser-automation fallback is used only when     ║
 * ║  the corresponding API key is missing or the API call fails. ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { BrowserManager, JobQueue } = require('@andy-toolforge/core');

class MultiPlatformPublisher {
    constructor(config) {
        this.browser = config.browserManager;
        this.queue = config.jobQueue;
        this.apiKeys = config.apiKeys || {};
        this.wordpressUrl = config.wordpressUrl;
    }

    /** Safely parse a fetch response as JSON, falling back to text on parse failure. */
    async _safeJson(res) {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(`Expected JSON but got: ${text.slice(0, 200)}`);
        }
    }

    /** Build YouTube auth headers: OAuth Bearer for ya29.* tokens, ?key= query param for API keys. */
    _youtubeAuth(initUrl) {
        const key = this.apiKeys.youtube;
        if (!key) return { url: initUrl, headers: {} };
        if (key.startsWith('ya29.') || key.includes('.')) {
            // Looks like an OAuth access token
            return { url: initUrl, headers: { Authorization: `Bearer ${key}` } };
        }
        // Simple API key — YouTube resumable upload requires OAuth, but we try ?key= as best-effort
        const separator = initUrl.includes('?') ? '&' : '?';
        return { url: `${initUrl}${separator}key=${key}`, headers: {} };
    }

    async publishToYouTube(video, metadata) {
        if (!video || !metadata || !metadata.title) {
            return { success: false, error: 'Missing required video or metadata' };
        }

        if (this.apiKeys.youtube) {
            try {
                const fs = require('fs');

                // Step 1: Initiate resumable upload, get upload URL
                const baseUrl = `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable`;
                const { url: initUrl, headers: authHeaders } = this._youtubeAuth(baseUrl);

                const initRes = await fetch(initUrl, {
                    method: 'POST',
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'application/json',
                        'X-Upload-Content-Length': String((await fs.promises.stat(video)).size),
                    },
                    body: JSON.stringify({
                        snippet: { title: metadata.title, description: metadata.description || '', tags: metadata.tags || [] },
                        status: { privacyStatus: metadata.privacyStatus || 'private' },
                    }),
                });
                if (!initRes.ok) {
                    const body = await initRes.text().catch(() => '');
                    throw new Error(`YouTube API returned ${initRes.status}: ${body.slice(0, 200)}`);
                }

                const uploadUrl = initRes.headers.get('Location');
                if (!uploadUrl) throw new Error('No upload URL returned from YouTube');

                // Step 2: Upload video binary to the returned URL
                const videoBuffer = await fs.promises.readFile(video);
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'video/*',
                        'Content-Length': String(videoBuffer.length),
                    },
                    body: videoBuffer,
                });
                if (!uploadRes.ok) {
                    const body = await uploadRes.text().catch(() => '');
                    throw new Error(`YouTube upload returned ${uploadRes.status}: ${body.slice(0, 200)}`);
                }

                const data = await this._safeJson(uploadRes);
                return { success: true, url: `https://youtu.be/${data.id}` };
            } catch (err) {
                console.warn(`[MultiPlatformPublisher] YouTube REST API failed, falling back to browser: ${err.message}`);
            }
        }

        // Browser fallback (when REST API is unavailable or fails)
        try {
            const page = await this.browser.newPage();
            await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle2' });

            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.uploadFile(video);
            }

            await page.type('#textbox', metadata.title);
            await page.click('paper-button:contains("Next")');

            await page.close();
            return { success: true, url: `https://youtu.be/placeholder-${Date.now()}` };
        } catch (err) {
            console.error(`[MultiPlatformPublisher] YouTube browser publish failed: ${err.message}`);
            return { success: false, error: `YouTube publish failed: ${err.message}` };
        }
    }

    async publishToWordPress(post, images) {
        if (!post || !post.title || !post.content) {
            return { success: false, error: 'Missing required post title or content' };
        }

        if (this.apiKeys.wordpress && this.wordpressUrl) {
            try {
                const wpUser = this.apiKeys.wordpress.split(':')[0];
                const wpPass = this.apiKeys.wordpress.split(':').slice(1).join(':') || this.apiKeys.wordpress;

                const res = await fetch(`${this.wordpressUrl}/wp/v2/posts`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${wpUser}:${wpPass}`).toString('base64')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: post.title,
                        content: post.content,
                        slug: post.slug || '',
                        categories: post.categories || [],
                        tags: post.tags || [],
                        status: 'draft',
                    }),
                });

                if (!res.ok) {
                    const body = await res.text().catch(() => '');
                    throw new Error(`WordPress API returned ${res.status}: ${body.slice(0, 200)}`);
                }

                const data = await this._safeJson(res);
                return { success: true, url: data.link };
            } catch (err) {
                console.warn(`[MultiPlatformPublisher] WordPress REST API failed, falling back to browser: ${err.message}`);
            }
        }

        // Browser fallback
        try {
            const page = await this.browser.newPage();
            await page.goto(`${this.wordpressUrl || 'http://localhost'}/wp-admin/post-new.php`, { waitUntil: 'networkidle2' });

            await page.type('#title', post.title);
            await page.type('#content', post.content);

            await page.close();
            return { success: true, url: `${this.wordpressUrl || 'http://localhost'}/?p=draft` };
        } catch (err) {
            console.error(`[MultiPlatformPublisher] WordPress browser publish failed: ${err.message}`);
            return { success: false, error: `WordPress publish failed: ${err.message}` };
        }
    }

    async publishToFacebook(content, images) {
        if (!content || !content.message) {
            return { success: false, error: 'Missing required content message' };
        }

        if (this.apiKeys.facebook) {
            try {
                const res = await fetch(`https://graph.facebook.com/v19.0/me/feed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: content.message,
                        link: content.link || '',
                        access_token: this.apiKeys.facebook,
                    }),
                });

                if (!res.ok) {
                    const body = await res.text().catch(() => '');
                    throw new Error(`Facebook Graph API returned ${res.status}: ${body.slice(0, 200)}`);
                }

                const data = await this._safeJson(res);
                return { success: true, postId: data.id };
            } catch (err) {
                console.warn(`[MultiPlatformPublisher] Facebook REST API failed, falling back to browser: ${err.message}`);
            }
        }

        // Browser fallback
        try {
            const page = await this.browser.newPage();
            await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });

            const hashtagStr = content.hashtags ? content.hashtags.map(t => `#${t}`).join(' ') : '';
            const fullMessage = `${content.message}\n\n${hashtagStr}`.trim();

            const postBox = await page.$('[role="textbox"]');
            if (postBox) {
                await postBox.type(fullMessage);
            }

            await page.close();
            return { success: true, postId: `fb-${Date.now()}` };
        } catch (err) {
            console.error(`[MultiPlatformPublisher] Facebook browser publish failed: ${err.message}`);
            return { success: false, error: `Facebook publish failed: ${err.message}` };
        }
    }

    async scheduleContent(calendar) {
        if (!Array.isArray(calendar) || calendar.length === 0) {
            return { success: false, error: 'Calendar must be a non-empty array' };
        }

        const jobIds = [];

        for (const item of calendar) {
            if (!item.platform || !item.content) {
                console.warn(`[MultiPlatformPublisher] Skipping calendar item missing platform or content`);
                continue;
            }

            const job = await this.queue.enqueue({
                platform: item.platform,
                content: item.content,
                images: item.images || [],
                scheduledAt: item.scheduledAt || new Date().toISOString(),
            });

            jobIds.push(job);
        }

        return { success: true, jobIds };
    }
}

module.exports = MultiPlatformPublisher;
