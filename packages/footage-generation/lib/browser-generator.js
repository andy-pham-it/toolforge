/**
 * browser-generator.js
 *
 * BrowserImageGenerator — batch image generation via Google Gemini Images
 * browser automation. Uses Puppeteer to control Chrome, simulating human-like
 * interaction to avoid rate-limiting.
 *
 * Free-model strategy: LLM API (paid, cheap text) → generate prompts.
 * Gemini Images Web UI (free browser) → generate images.
 *
 * Features:
 *   - Multi-strategy capture: download button → library → element screenshot
 *   - Timeout resilience: library↔chat fallback loop with progressive backoff
 *   - Enhanced human-like behavior: typos, multi-turn, scroll, mouse hover
 *   - Resume from existing files
 *   - Auto-retry with rate-limit detection
 *   - Event-based progress reporting
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// ─── Human chat phrases ──────────────────────────────────────────────────────

const HUMAN_CHAT = {
    vi: [
        "Cái này đẹp đó, nhưng background hơi tối một xíu.",
        "Ok ổn rồi, lưu lại.",
        "Màu sắc ổn, nhưng bố cục hơi lệch trái.",
        "Cái này ổn, cho thêm ánh sáng ấm hơn được không?",
        "NICE, góc nhìn này chuẩn.",
        "Hmm, để xem nào… ừ được đó.",
        "Đẹp! Lưu lại để dùng.",
        "Background đẹp, nhưng chữ hơi khó đọc.",
        "Ok, next ảnh khác.",
        "Tông màu hơi lạnh, thử ấm hơn xem.",
        "Bức này ổn nhất từ đầu tới giờ.",
        "Nhìn chung được, nhưng bố cục nên cân bằng hơn.",
        "Được rồi, chuyển sang prompt tiếp theo.",
        "Cảnh này hợp với nội dung, keep.",
        "Góc nhìn thú vị, nhưng thiếu depth.",
        "Tạm ổn, lưu vào thư mục.",
        "Background hơi rối, nên đơn giản hơn.",
        "Góc này ok nhưng màu hơi chói, dịu lại xíu.",
        "Bố cục đẹp, ánh sáng vừa phải. Lưu.",
        "Khá ưng bức này, màu sắc hài hòa.",
        "Ok lưu, chạy tiếp.",
        "Chưa ưng lắm, thử lại với góc nhìn khác.",
        "Màu pastel thế này hợp với nội dung.",
        "Cận cảnh hơn vào chủ đề chính.",
    ],
    en: [
        "Nice image, but can you brighten it a bit?",
        "Good composition, I like the lighting here.",
        "This one works. Save and continue.",
        "The colors feel off, too saturated.",
        "Keep this one, it captures the mood well.",
        "Alright, next prompt please.",
        "Not bad, but the left side feels empty.",
        "The perspective is interesting but the focus is soft.",
        "This matches the tone I was looking for.",
        "Try a wider angle, more landscape orientation.",
    ],
    /** Context-aware messages that reference previous image */
    followUp: [
        "So với bức trước, bức này sáng hơn hẳn. Giữ nhé.",
        "Tông màu này ấm hơn, hợp với nội dung hơn bức kia.",
        "Bố cục gọn gàng hơn cái trước.",
        "Thiếu depth so với bức hồi nãy, nhưng màu đẹp.",
        "Bức này dễ nhìn hơn, giữ lại.",
        "Góc chụp này thoáng hơn cái đầu tiên.",
    ],
};

// ─── Typo generators for human-like typing simulation ────────────────────────

const TYPO_MAP = {
    'e': 'r', 'r': 't', 't': 'y', 'y': 'u', 'u': 'i',
    'i': 'o', 'o': 'p', 'p': '[',
    'a': 's', 's': 'd', 'd': 'f', 'f': 'g', 'g': 'h',
    'h': 'j', 'j': 'k', 'k': 'l',
    'z': 'x', 'x': 'c', 'c': 'v', 'v': 'b', 'b': 'n', 'n': 'm',
    'n': 'm', 'm': ',',
};

// ─── Class ────────────────────────────────────────────────────────────────────

class BrowserImageGenerator extends EventEmitter {
    /**
     * @param {object} options
     * @param {string} [options.chromePath]   - Path to Chrome executable
     * @param {string} [options.profileDir]   - Chrome user data directory
     * @param {number} [options.debugPort]    - Remote debugging port
     * @param {string} [options.baseUrl]       - Gemini Images URL
     * @param {number} [options.minDelay]     - Min delay between images (ms)
     * @param {number} [options.maxDelay]     - Max delay between images (ms)
     * @param {number} [options.batchBreakMin]- Min batch break (minutes)
     * @param {number} [options.batchBreakMax]- Max batch break (minutes)
     * @param {number} [options.maxRetries]   - Max retries per image
     * @param {number} [options.maxTimeout]   - Max wait per image attempt (ms)
     * @param {string} [options.language]     - Chat language ('vi' or 'en')
     * @param {object} [options.logger]       - Logger instance (optional)
     */
    constructor(options = {}) {
        super();
        const DEFAULTS = BrowserImageGenerator.DEFAULTS;
        this.chromePath = options.chromePath || DEFAULTS.chromePath;
        this.profileDir = options.profileDir || path.join(os.homedir(), '.chrome-puppeteer-profile');
        this.debugPort = options.debugPort || DEFAULTS.debugPort;
        this.baseUrl = options.baseUrl || DEFAULTS.baseUrl;
        this.minDelay = options.minDelay || DEFAULTS.minDelay;
        this.maxDelay = options.maxDelay || DEFAULTS.maxDelay;
        this.batchBreakMin = options.batchBreakMin || DEFAULTS.batchBreakMin;
        this.batchBreakMax = options.batchBreakMax || DEFAULTS.batchBreakMax;
        this.maxRetries = options.maxRetries || DEFAULTS.maxRetries;
        this.maxTimeout = options.maxTimeout || DEFAULTS.maxTimeout;
        this.language = options.language || DEFAULTS.language;
        this.logger = options.logger || null;
        this.langChat = HUMAN_CHAT[this.language] || HUMAN_CHAT.vi;
        this.speed = options.speed || DEFAULTS.speed;

        // Speed presets override min/max delays
        const SPEEDS = {
            fast:   { minDelay: 15000, maxDelay: 45000, batchBreakMin: 1, batchBreakMax: 2 },
            normal: { minDelay: 30000, maxDelay: 60000, batchBreakMin: 1, batchBreakMax: 2 },
            cautious: { minDelay: 90000, maxDelay: 180000, batchBreakMin: 5, batchBreakMax: 8 },
        };
        if (SPEEDS[this.speed]) {
            const s = SPEEDS[this.speed];
            this.minDelay = this.minDelay || s.minDelay;
            this.maxDelay = this.maxDelay || s.maxDelay;
            this.batchBreakMin = this.batchBreakMin || s.batchBreakMin;
            this.batchBreakMax = this.batchBreakMax || s.batchBreakMax;
        }

        this._browser = null;
        this._chromeProcess = null;
    }

    static DEFAULTS = {
        chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        debugPort: 9222,
        baseUrl: 'https://gemini.google.com/images',
        minDelay: 30000,        // 30s
        maxDelay: 60000,        // 60s
        batchBreakMin: 1,       // 1 min
        batchBreakMax: 2,       // 2 min
        maxRetries: 5,
        maxTimeout: 600000,     // 10 min per attempt
        language: 'vi',
        speed: 'normal',        // 'fast' | 'normal' | 'cautious'
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Chrome management
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Ensure Chrome is running with remote debugging.
     * @param {boolean} [loginMode=false] - If true, open window for manual login.
     */
    async ensureChromeRunning(loginMode = false) {
        const connected = await this._tryConnect();
        if (connected) {
            this._log('Chrome already running with remote debugging');
            return;
        }

        this._log('Starting Chrome with remote debugging...');
        const args = [
            `--remote-debugging-port=${this.debugPort}`,
            `--user-data-dir=${this.profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
        ];
        if (loginMode) args.push('--window-size=1400,900');

        this._chromeProcess = spawn(this.chromePath, args, {
            stdio: 'ignore',
            detached: true,
        });
        this._chromeProcess.unref();

        for (let i = 0; i < 30; i++) {
            await this._sleep(1000);
            if (await this._tryConnect()) {
                this._log('Chrome started successfully');
                return;
            }
        }
        throw new Error('Chrome failed to start within 30s');
    }

    /**
     * Connect Puppeteer to the running Chrome instance.
     * Returns { browser, page }.
     * Reconnects automatically if the previous connection was lost.
     */
    async connect() {
        const browserURL = `http://localhost:${this.debugPort}`;
        try {
            this._browser = await puppeteer.connect({ browserURL });
            const pages = await this._browser.pages();
            const page = pages.length > 0 ? pages[0] : await this._browser.newPage();
            await page.setViewport({ width: 1400, height: 900 });
            return { browser: this._browser, page };
        } catch (err) {
            throw new Error(`Failed to connect to Chrome: ${err.message}`);
        }
    }

    async close() {
        if (this._browser) {
            try { await this._browser.disconnect(); } catch {}
            this._browser = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Batch generation (public API)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Generate images for an array of prompts.
     *
     * @param {Array<{name: string, file: string, prompt: string}>} prompts
     * @param {string} outputDir - Directory to save images.
     * @param {object} [options]
     * @param {function} [options.onProgress] - Callback({current, total, name, status})
     * @param {AbortSignal} [options.signal] - AbortController signal
     * @returns {Promise<{successCount: number, totalCount: number, rateLimitRetries: number, skippedCount: number}>}
     */
    async generateBatch(prompts, outputDir, options = {}) {
        const { onProgress, signal } = options;
        fs.mkdirSync(outputDir, { recursive: true });

        await this.ensureChromeRunning(false);
        const connection = await this.connect();
        const browser = connection.browser;

        let successCount = 0;
        let rateLimitRetries = 0;
        let skippedCount = 0;
        let newSuccessCount = 0;

        for (let i = 0; i < prompts.length; i++) {
            if (signal?.aborted) {
                this._log(`Aborted at ${i}/${prompts.length}`);
                break;
            }

            const p = prompts[i];
            const fileName = p.file || `scene_${String(i + 1).padStart(2, '0')}.png`;
            const outputPath = path.join(outputDir, fileName);

            this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: 'starting', file: fileName });

            if (fs.existsSync(outputPath)) {
                const stat = fs.statSync(outputPath);
                if (stat.size > 1000) {
                    this._log(`⏩ Skipped (already exists): ${fileName} (${(stat.size / 1024).toFixed(0)}KB)`);
                    successCount++;
                    skippedCount++;
                    this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: 'skipped', file: fileName });
                    continue;
                }
            }

            // Fresh page per image — prevents accumulated rate-limit state
            let attempts = 0;
            let success = false;
            this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: 'generating', file: fileName });

            while (attempts <= this.maxRetries && !success && !signal?.aborted) {
                const page = await browser.newPage();
                await page.setViewport({ width: 1400, height: 900 });

                try {
                    // Check page not rate-limited / denied before starting
                    if (!(await this._checkPageHealthy(page))) {
                        this._log(`  ⚠️ Page unhealthy (rate-limited/denied), retrying...`);
                        attempts++;
                        continue;
                    }

                    const buffer = await this._generateSingle(page, p.prompt, `${i + 1}/${prompts.length} ${fileName}`, attempts);
                    fs.writeFileSync(outputPath, buffer);
                    const sizeKB = (buffer.length / 1024).toFixed(0);
                    this._log(`💾 Saved: ${fileName} (${sizeKB}KB)`);
                    successCount++;
                    success = true;
                    newSuccessCount++;
                    this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: 'done', file: fileName });

                    // Lightweight anti-rate-limit: simulate mic use
                    await this._simulateMicUse(page).catch(() => {});
                } catch (err) {
                    if (err.message === 'RATE_LIMITED') {
                        attempts++;
                        rateLimitRetries++;
                        const waitMin = Math.max(this._randomInt(10, 20) * attempts, 15);
                        this._log(`⛔ Rate-limited! Attempt ${attempts}/${this.maxRetries}. Waiting ${waitMin}min...`);
                        this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: `rate-limited (retry ${attempts})`, file: fileName });
                        for (let m = 0; m < waitMin; m++) {
                            if (signal?.aborted) break;
                            process.stdout.write(`  ${m + 1}/${waitMin} min...`);
                            await this._sleep(60000);
                        }
                        console.log('');
                    } else if (err.message === 'CAPTURE_FAILED') {
                        attempts++;
                        this._log(`⚠️ Capture failed (attempt ${attempts}), retrying with fresh page...`);
                        await this._takeDebugScreenshot(page, `capture_failed_${i + 1}`, outputDir);
                    } else if (err.message === 'PAGE_HEALTHY_CHECK_FAILED') {
                        attempts++;
                        this._log(`  ⚠️ Page became unhealthy during generation, retrying...`);
                    } else if (err.message === 'ABORTED') {
                        break;
                    } else {
                        this._log(`❌ Failed: ${err.message}`);
                        await this._takeDebugScreenshot(page, `error_${i + 1}`, outputDir);
                        this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: `error: ${err.message}`, file: fileName });
                        break;
                    }
                } finally {
                    await page.close().catch(() => {});
                }
            }

            if (!success) {
                this._log(`❌ Gave up after ${this.maxRetries + 1} attempts: ${fileName}`);
                this._emitProgress(onProgress, { current: i + 1, total: prompts.length, name: p.name, status: 'failed', file: fileName });
            }

            if (signal?.aborted) break;

            // Batch breaks
            if (success && (i + 1) < prompts.length) {
                if (newSuccessCount > 0 && newSuccessCount % 3 === 0) {
                    await this._batchBreak();
                } else {
                    await this._randomDelay(this.minDelay / 1000, this.maxDelay / 1000);
                }
            }
        }

        await this.close();
        return { successCount, totalCount: prompts.length, rateLimitRetries, skippedCount };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Single image generation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Generate one image: submit prompt → capture via multi-strategy.
     * @private
     */
    async _generateSingle(page, promptText, imageLabel, attemptIndex) {
        const shortPrompt = promptText.replace(/\n/g, ' ').slice(0, 60);
        this._log(`🎨 [${imageLabel}] Generating: "${shortPrompt}..."`);

        await this._navigateToGemini(page);

        // Submit prompt
        await this._submitPrompt(page, promptText);

        // Wait for image with timeout → library fallback loop
        const timeout = this.maxTimeout + (attemptIndex || 0) * 60000; // progressive backoff
        const buffer = await this._waitAndCapture(page, timeout, promptText);
        return buffer;
    }

    /**
     * Navigate to Gemini Images and click "New chat".
     * @private
     */
    async _navigateToGemini(page) {
        await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this._sleep(3000);

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('a, button, [role="button"]'))
                .find(el => el.innerText?.trim() === 'New chat');
            if (btn) btn.click();
        });
        await this._sleep(3000);
    }

    /**
     * Type the prompt into the chat with human-like speed.
     * Includes occasional typos and corrections.
     * @private
     */
    async _submitPrompt(page, promptText) {
        this._log('  ⏳ Typing prompt...');
        const input = await page.$('[contenteditable]');
        if (!input) throw new Error('Input not found');

        await input.click();
        await this._sleep(500);

        const flatPrompt = promptText.replace(/\n+/g, ' ');
        const fullPrompt = `Generate an image: ${flatPrompt}`;

        // Type with human-like speed: bursty + occasional typos
        let i = 0;
        while (i < fullPrompt.length) {
            // 10% chance of typo
            if (Math.random() < 0.08) {
                const char = fullPrompt[i];
                const typoChar = TYPO_MAP[char.toLowerCase()];
                if (typoChar && char.match(/[a-z]/i)) {
                    // Type wrong char
                    await input.type(typoChar, { delay: this._randomInt(15, 40) });
                    await this._sleep(this._randomInt(150, 400));
                    // Backspace
                    await page.keyboard.press('Backspace');
                    await this._sleep(this._randomInt(100, 300));
                }
            }

            // Type the correct character
            await input.type(fullPrompt[i], { delay: this._randomInt(5, 15) });

            // Bursty: occasionally pause
            if (Math.random() < 0.03) {
                await this._sleep(this._randomInt(300, 800));
            }

            i++;
        }

        await this._sleep(500);

        // Submit
        this._log('  ⏳ Submitting...');
        await page.keyboard.press('Enter');
    }

    /**
     * Wait for image, then attempt multi-strategy capture.
     * Implements library↔chat fallback loop.
     * @private
     */
    async _waitAndCapture(page, timeout, originalPrompt) {
        // ── Phase 1: Wait in chat ──
        this._log(`  ⏳ Waiting up to ${(timeout / 1000).toFixed(0)}s for image...`);
        const found = await this._waitForImage(page, timeout);

        if (found) {
            // Try capture
            const buffer = await this._captureImage(page);
            if (buffer) return buffer;
            this._log('  ⚠️ Chat capture failed, trying library...');
        } else if (this._isRateLimited(page)) {
            throw new Error('RATE_LIMITED');
        }

        // ── Phase 2: Library fallback ──
        this._log('  🔄 Trying library page...');
        const fromLib = await this._captureFromLibrary(page, originalPrompt);
        if (fromLib) return fromLib;

        // ── Phase 3: Go back to chat and try again ──
        this._log('  🔄 Going back to chat for another attempt...');
        await this._navigateToGemini(page);
        await this._sleep(5000);

        // Check if image appeared while we were gone
        const stillThere = await this._waitForImage(page, 30000);
        if (stillThere) {
            const buffer = await this._captureImage(page);
            if (buffer) return buffer;
        }

        // ── Phase 4: Resubmit and try one more time ──
        this._log('  🔄 Re-submitting prompt...');
        await this._submitPrompt(page, originalPrompt);
        const retryFound = await this._waitForImage(page, timeout);
        if (retryFound) {
            const buffer = await this._captureImage(page);
            if (buffer) return buffer;
            const fromLib2 = await this._captureFromLibrary(page, originalPrompt);
            if (fromLib2) return fromLib2;
        }

        throw new Error('CAPTURE_FAILED');
    }

    /**
     * Wait for an image to appear in the page.
     * @private
     */
    async _waitForImage(page, timeout) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            await this._sleep(3000);

            // Check rate-limit
            const rateLimited = await page.evaluate(() => {
                const body = document.body.innerText || '';
                return body.includes('being asked for a lot of images') ||
                       body.includes("can't create that") ||
                       body.includes('try again later') ||
                       body.includes('rate limit');
            });

            if (rateLimited) return false; // caller checks rate-limit

            const imgCount = await page.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll('img')).filter(img => {
                    if (!img.complete) return false;
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;
                    if (w < 300 || h < 300) return false;
                    const ratio = Math.max(w, h) / Math.min(w, h);
                    if (ratio > 3.0) return false;
                    const src = (img.src || '').toLowerCase();
                    if (src.includes('favicon') || src.includes('icon')) return false;
                    return true;
                });
                return candidates.length;
            });
            if (imgCount > 0) return true;

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            if (parseInt(elapsed) % 15 === 0) {
                process.stdout.write(`  ${elapsed}s... `);
            }
        }
        return false;
    }

    /**
     * Check if the page is showing a rate-limit message.
     * @private
     */
    async _isRateLimited(page) {
        try {
            return await page.evaluate(() => {
                const body = document.body.innerText || '';
                return body.includes('being asked for a lot of images') ||
                       body.includes("can't create that") ||
                       body.includes('try again later') ||
                       body.includes('rate limit');
            });
        } catch {
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Capture strategies
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Capture image via download button (primary) or fallback methods.
     * @private
     */
    async _captureImage(page) {
        this._log('  ⏳ Capturing image...');

        // Strategy 1: Download button → CDN URL
        try {
            await page.evaluate(() => {
                const img = Array.from(document.querySelectorAll('img')).find(i => {
                    if (!i.complete) return false;
                    if (i.naturalWidth < 300 || i.naturalHeight < 300) return false;
                    const ratio = Math.max(i.naturalWidth, i.naturalHeight) / Math.min(i.naturalWidth, i.naturalHeight);
                    if (ratio > 3.0) return false;
                    return !(i.src || '').toLowerCase().includes('favicon');
                });
                if (img) img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            });
            await this._sleep(2000);

            const cdnUrl = await new Promise((resolve, reject) => {
                const handler = (resp) => {
                    const ct = resp.headers()['content-type'] || '';
                    if (ct.startsWith('image/') && resp.url().includes('googleusercontent.com')) {
                        page.off('response', handler);
                        resolve(resp.url());
                    }
                };
                page.on('response', handler);

                page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const dl = btns.find(b => b.getAttribute('aria-label') === 'Download full size image');
                    if (dl) dl.click();
                }).catch(() => {});

                setTimeout(() => {
                    page.off('response', handler);
                    reject(new Error('No CDN URL'));
                }, 20000);
            });

            const buffer = await this._fetchImageBuffer(page, cdnUrl);
            if (buffer) {
                this._log('  ✅ Captured via download button');
                return buffer;
            }
        } catch (err) {
            this._log(`  ⚠️ Download button failed: ${err.message}`);
        }

        // Strategy 2: Element screenshot
        try {
            const imgElement = await page.evaluateHandle(() => {
                const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                    if (!img.complete) return false;
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;
                    if (w < 300 || h < 300) return false;
                    const ratio = Math.max(w, h) / Math.min(w, h);
                    if (ratio > 3.0) return false;
                    return !(img.src || '').toLowerCase().includes('favicon');
                });
                return imgs[imgs.length - 1] || null;
            });
            if (imgElement) {
                const buffer = await imgElement.screenshot({ type: 'png' });
                this._log('  ✅ Captured via element screenshot');
                return buffer;
            }
        } catch (err) {
            this._log(`  ⚠️ Element screenshot failed: ${err.message}`);
        }

        return null;
    }

    /**
     * Navigate to Gemini library and capture the most recent image.
     * @private
     */
    async _captureFromLibrary(page, originalPrompt) {
        try {
            await page.goto('https://gemini.google.com/library', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this._sleep(5000);

            const clicked = await page.evaluate(() => {
                const card = document.querySelector('.library-item-card, [class*="library-item"]');
                if (card) { card.click(); return true; }
                const img = document.querySelector('img[src*="gg/AE"]');
                if (img) { img.click(); return true; }
                return false;
            });

            if (!clicked) {
                this._log('  ⚠️ No library items found');
                return null;
            }
            await this._sleep(3000);

            // Try download button in library
            const cdnUrl = await new Promise((resolve, reject) => {
                const handler = (resp) => {
                    const ct = resp.headers()['content-type'] || '';
                    if (ct.startsWith('image/') && resp.url().includes('googleusercontent.com')) {
                        page.off('response', handler);
                        resolve(resp.url());
                    }
                };
                page.on('response', handler);

                page.evaluate(() => {
                    let btn = Array.from(document.querySelectorAll('button'))
                        .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('download'));
                    if (!btn) {
                        btn = Array.from(document.querySelectorAll('button'))
                            .find(b => b.querySelector('[class*="download"], mat-icon[fonticon="download"], svg'));
                    }
                    if (btn) btn.click();
                }).catch(() => {});

                setTimeout(() => {
                    page.off('response', handler);
                    reject(new Error('No CDN URL from library'));
                }, 20000);
            });

            const buffer = await this._fetchImageBuffer(page, cdnUrl);
            if (buffer) {
                this._log('  ✅ Captured via library');
                return buffer;
            }
        } catch (err) {
            this._log(`  ⚠️ Library capture failed: ${err.message}`);
        }

        return null;
    }

    /**
     * Fetch an image from a CDN URL via page context (avoids CORS).
     * @private
     */
    async _fetchImageBuffer(page, url) {
        try {
            const dataUrl = await page.evaluate(async (fetchUrl) => {
                const resp = await fetch(fetchUrl);
                const blob = await resp.blob();
                return new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }, url);

            const base64 = dataUrl.split(',')[1];
            if (!base64) return null;
            return Buffer.from(base64, 'base64');
        } catch (err) {
            this._log(`  ⚠️ Fetch failed: ${err.message}`);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Enhanced human-like behavior
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Simulate a human reviewing images in the chat.
     * Enhanced version: multi-turn conversation, scroll, click image.
     * @private
     */
    async _simulateHumanChat(page, lastImageName) {
        const msg = this.langChat[this._randomInt(0, this.langChat.length - 1)];
        const followUp = HUMAN_CHAT.followUp[this._randomInt(0, HUMAN_CHAT.followUp.length - 1)];
        this._log(`  💬 Simulating human review...`);

        try {
            // Step 1: Scroll around (pretend to examine)
            await this._simulateScroll(page);

            // Step 2: Hover over the generated image
            await this._simulateImageHover(page);

            // Step 3: Type a context-aware message
            const input = await page.$('[contenteditable]');
            if (!input) return;

            await input.click();
            await this._sleep(800);

            // Type the main message with human delays
            for (const char of msg) {
                await input.type(char, { delay: this._randomInt(30, 80) });
            }
            await this._sleep(this._randomInt(2000, 4000));

            // Send (80% chance) or clear
            const willSend = Math.random() > 0.2;
            if (willSend) {
                await page.keyboard.press('Enter');
                this._log('  💬 Message sent, waiting for response...');
                await this._sleep(this._randomInt(5000, 10000));

                // ── Multi-turn: Type a follow-up ──
                const doFollowUp = Math.random() > 0.5;
                if (doFollowUp) {
                    await input.click();
                    await this._sleep(500);

                    for (const char of followUp) {
                        await input.type(char, { delay: this._randomInt(25, 60) });
                    }
                    await this._sleep(this._randomInt(1500, 3000));
                    await page.keyboard.press('Enter');
                    this._log('  💬 Follow-up sent');
                    await this._sleep(this._randomInt(3000, 6000));
                } else {
                    // Just a quick acknowledgement
                    const ack = ["Ok.", "Got it.", "Được rồi.", "Ok next."][this._randomInt(0, 3)];
                    await input.type(ack, { delay: this._randomInt(20, 50) });
                    await this._sleep(this._randomInt(1000, 2000));
                    await page.keyboard.press('Enter');
                    await this._sleep(this._randomInt(3000, 6000));
                }
            } else {
                // Clear input without sending
                await input.click();
                await page.keyboard.down('Meta');
                await page.keyboard.press('a');
                await page.keyboard.up('Meta');
                await this._sleep(300);
                await page.keyboard.press('Backspace');
                this._log('  💬 Input cleared without sending.');
            }

            // Step 4: Another scroll (pretend to read response)
            await this._simulateScroll(page);

        } catch (e) {
            this._log(`  💬 Chat sim skipped (${e.message})`);
        }
    }

    /**
     * Simulate scrolling to review images.
     * @private
     */
    async _simulateScroll(page) {
        try {
            const scrollAmount = this._randomInt(200, 600);
            await page.evaluate((amount) => {
                window.scrollBy({ top: amount, behavior: 'smooth' });
            }, scrollAmount);
            await this._sleep(this._randomInt(800, 2000));

            // Sometimes scroll back
            if (Math.random() > 0.5) {
                const scrollBack = this._randomInt(100, 300);
                await page.evaluate((amount) => {
                    window.scrollBy({ top: -amount, behavior: 'smooth' });
                }, scrollBack);
                await this._sleep(this._randomInt(500, 1500));
            }
        } catch {}
    }

    /**
     * Simulate hovering over the generated image.
     * @private
     */
    async _simulateImageHover(page) {
        try {
            await page.evaluate(() => {
                const img = Array.from(document.querySelectorAll('img'))
                    .find(i => i.complete && i.naturalWidth > 500);
                if (img) {
                    const rect = img.getBoundingClientRect();
                    // Move mouse to image center
                    const event = new MouseEvent('mouseenter', {
                        bubbles: true,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2,
                    });
                    img.dispatchEvent(event);
                }
            });
            await this._sleep(this._randomInt(1000, 2500));
        } catch {}
    }

    /**
     * Check if the page is usable — not showing rate-limit / denied / captcha.
     * @private
     */
    async _checkPageHealthy(page) {
        try {
            const title = await page.title().catch(() => '');
            if (title.toLowerCase().includes('denied') || title.toLowerCase().includes('sorry')) return false;

            const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
            const bad = [
                'request denied', 'rate limit', 'being asked for a lot',
                "can't create", 'something went wrong', 'try again later',
                'sign in', 'robot', 'unusual traffic', 'verify',
            ];
            for (const phrase of bad) {
                if (body.toLowerCase().includes(phrase)) return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Simulate clicking the microphone button to create human-activity signal.
     * @private
     */
    async _simulateMicUse(page) {
        try {
            const micClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                const mic = buttons.find(el => {
                    const label = (el.getAttribute('aria-label') || '').toLowerCase();
                    const text = (el.innerText || '').toLowerCase();
                    return label.includes('microphone') || label.includes('mic') || text.includes('microphone');
                });
                if (mic) { mic.click(); return true; }
                return false;
            });
            if (micClicked) {
                await this._sleep(this._randomInt(2000, 4000));
                await page.keyboard.press('Escape');
                await this._sleep(1000);
                this._log('  🎤 Mic simulation done');
            }
        } catch {}
    }

    /**
     * Capture debug screenshot + page text when something goes wrong.
     * @private
     */
    async _takeDebugScreenshot(page, label, outputDir) {
        try {
            const debugDir = path.join(outputDir, 'debug');
            fs.mkdirSync(debugDir, { recursive: true });
            const ssPath = path.join(debugDir, `${label}_${Date.now()}.png`);
            await page.screenshot({ path: ssPath, fullPage: false });
            const text = await page.evaluate(() =>
                document.body?.innerText?.slice(0, 2000) || 'NO TEXT'
            ).catch(() => 'UNREADABLE');
            this._log(`  📸 Debug screenshot: ${ssPath}`);
            this._log(`  📄 Page text: "${text.slice(0, 300)}"`);
        } catch {}
    }

    /**
     * Long break between batches.
     * @private
     */
    async _batchBreak() {
        const breakMin = this._randomInt(this.batchBreakMin, this.batchBreakMax);
        this._log(`\n  ☕ Batch break: resting ${breakMin} minutes...\n`);
        for (let m = 0; m < breakMin; m++) {
            process.stdout.write(`    ${m + 1}/${breakMin} min...`);
            await this._sleep(60000);
        }
        this._log('\n  ☕ Break over, resuming.');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Utilities
    // ═══════════════════════════════════════════════════════════════════════

    async _randomDelay(minSec, maxSec) {
        const ms = this._randomInt(minSec * 1000, maxSec * 1000);
        this._log(`  ⏳ Waiting ${(ms / 1000).toFixed(0)}s (anti-rate-limit delay)...`);
        for (let i = 0; i < ms; i += 5000) {
            await this._sleep(Math.min(5000, ms - i));
            process.stdout.write('.');
        }
        console.log('');
    }

    async _tryConnect() {
        return new Promise((resolve) => {
            const req = http.get(`http://localhost:${this.debugPort}/json/version`, (resp) => {
                resolve(resp.statusCode === 200);
                resp.resume();
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => { req.destroy(); resolve(false); });
        });
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    _log(msg) {
        if (this.logger && typeof this.logger.info === 'function') {
            this.logger.info(`[BrowserImageGen] ${msg}`);
        } else {
            console.log(msg);
        }
    }

    _emitProgress(onProgress, data) {
        if (typeof onProgress === 'function') {
            onProgress(data);
        }
        this.emit('progress', data);
    }
}

module.exports = BrowserImageGenerator;
