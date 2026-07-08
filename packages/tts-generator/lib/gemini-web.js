'use strict';

/**
 * gemini-web.js — Gemini Web browser automation for TTS tag injection
 *
 * Uses Puppeteer to interact with gemini.google.com chat UI.
 * Reuses the same persistent Chrome profile as BrowserImageGenerator
 * from @andy-toolforge/footage-generation so login state persists.
 */

const puppeteer = require('puppeteer');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.chrome-puppeteer-profile');
const DEBUG_PORT = 9222;
const GEMINI_URL = 'https://gemini.google.com/';

class GeminiWebClient {
    /**
     * @param {object} [options]
     * @param {string} [options.chromePath] - Path to Chrome executable
     * @param {string} [options.profileDir] - Chrome user data directory
     * @param {number} [options.debugPort] - Remote debugging port
     */
    constructor(options = {}) {
        this.chromePath = options.chromePath || CHROME_PATH;
        this.profileDir = options.profileDir || DEFAULT_PROFILE_DIR;
        this.debugPort = options.debugPort || DEBUG_PORT;
        this._browser = null;
    }

    /**
     * Ensure Chrome is running and return a page.
     * Uses persistent profile so Gemini login cookies carry over.
     * @returns {Promise<Page>}
     */
    async getPage() {
        // Try connecting to existing Chrome
        const existing = await this._tryConnect();
        if (existing) {
            const pages = await this._browser.pages();
            return pages.length > 0 ? pages[0] : this._browser.newPage();
        }

        // Launch Chrome with persistent profile
        this._chromeProcess = spawn(this.chromePath, [
            `--remote-debugging-port=${this.debugPort}`,
            `--user-data-dir=${this.profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
        ], { stdio: 'ignore', detached: true });
        this._chromeProcess.unref();

        // Wait up to 30s for Chrome to start
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1000));
            if (await this._tryConnect()) {
                const pages = await this._browser.pages();
                return pages.length > 0 ? pages[0] : this._browser.newPage();
            }
        }

        throw new Error('GeminiWebClient: Chrome failed to start within 30s');
    }

    /**
     * Check if user is logged into Gemini by examining page content.
     * @param {Page} page
     * @returns {Promise<boolean>}
     */
    async checkSignedIn(page) {
        try {
            const text = await page.evaluate(() => document.body?.innerText?.slice(0, 1500) || '');
            const bad = ['sign in', 'sign-in', 'log in', 'get started', 'try gemini'];
            const lower = text.toLowerCase();
            const hasBad = bad.some(phrase => lower.includes(phrase));
            const hasInput = await page.$('[contenteditable], textarea').catch(() => null) !== null;
            return hasInput || !hasBad;
        } catch {
            return false;
        }
    }

    /**
     * Navigate to Gemini and ensure we're on the chat page.
     * @param {Page} page
     */
    async navigateToChat(page) {
        await page.goto(GEMINI_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait for page to fully render
        await new Promise(r => setTimeout(r, 4000));
    }

    /**
     * Type a prompt into the Gemini chat input and submit it.
     * @param {Page} page
     * @param {string} prompt - The full prompt text to send
     */
    async sendPrompt(page, prompt) {
        // Wait for chat input to appear
        await page.waitForSelector('[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable]', {
            timeout: 15000,
        });

        const input = await page.$('[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable]');
        if (!input) throw new Error('Chat input not found on gemini.google.com');

        await input.click();
        await new Promise(r => setTimeout(r, 500));

        // Type the prompt character by character with human-like delay
        for (const char of prompt) {
            await input.type(char, { delay: 5 });
        }

        // Wait a moment then submit
        await new Promise(r => setTimeout(r, 800));
        await page.keyboard.press('Enter');
    }

    /**
     * Wait for Gemini to finish generating and return the response text.
     * Polls for the response to appear and the "stop" button to disappear.
     * @param {Page} page
     * @param {number} timeout - Max wait time in ms (default 120s)
     * @returns {Promise<string>}
     */
    async waitForResponse(page, timeout = 120000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            // Check for abort
            // Check if the "stop" button is still visible (generation in progress)
            const hasStopButton = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                return btns.some(b =>
                    (b.getAttribute('aria-label') || '').toLowerCase().includes('stop') ||
                    b.innerText?.includes('■') ||
                    b.querySelector('[data-icon="stop"]')
                );
            }).catch(() => false);

            if (!hasStopButton) {
                // Generation might be done; get the latest assistant response
                const responseText = await this._extractResponseText(page);
                if (responseText && responseText.length > 50) {
                    return responseText;
                }
            }

            // Wait before next poll
            await new Promise(r => setTimeout(r, 1000));
        }

        throw new Error('Gemini Web did not return a response within timeout');
    }

    /**
     * Extract the latest assistant response text from the page.
     * @private
     */
    async _extractResponseText(page) {
        try {
            // Strategy: get all visible text paragraphs from the chat area
            // Typically Gemini renders responses in divs/paragraphs below the input
            const text = await page.evaluate(() => {
                // Try to find the chat message container
                // Gemini responses are usually in elements that contain markdown-rendered text
                const candidates = Array.from(document.querySelectorAll(
                    '.response-container, [class*="response"], [class*="message"], ' +
                    '[class*="conversation"], main, [role="main"]'
                ));

                if (candidates.length > 0) {
                    // Get the last response-like element
                    const last = candidates[candidates.length - 1];
                    return last.innerText || '';
                }

                // Fallback: get all text that looks like a response
                // (exclude the input area)
                const inputEl = document.querySelector('[contenteditable], textarea');
                const allText = document.body?.innerText || '';
                if (inputEl) {
                    // Remove input text from the full text
                    const inputText = inputEl.innerText || inputEl.textContent || '';
                    const idx = allText.lastIndexOf(inputText);
                    if (idx >= 0) {
                        return allText.slice(0, idx).trim();
                    }
                }
                return allText;
            });

            return text.trim();
        } catch {
            return '';
        }
    }

    /**
     * Try connecting to an existing Chrome debugging endpoint.
     * @private
     */
    async _tryConnect() {
        try {
            this._browser = await puppeteer.connect({
                browserURL: `http://localhost:${this.debugPort}`,
            });
            return true;
        } catch {
            return false;
        }
    }

    /** Close browser connection */
    async close() {
        if (this._browser) {
            try { await this._browser.disconnect(); } catch {}
            this._browser = null;
        }
    }
}

module.exports = GeminiWebClient;
