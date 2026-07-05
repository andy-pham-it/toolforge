/**
 * generator.js — ImageGenerator
 *
 * Entry point for batch image generation.
 * Delegates to BrowserImageGenerator (the actual engine) which uses
 * Puppeteer + Google Gemini Images Web UI for free image generation.
 *
 * Strategy: LLM API (paid, cheap text) → generate prompts.
 * Gemini Images Web UI (free) → generate images.
 */

const path = require('path');
const BrowserImageGenerator = require('./browser-generator');
const PromptParser = require('./prompt-parser');

class ImageGenerator {
    /**
     * Generate images from a prompts.md file.
     *
     * @param {string} promptsFilePath - Path to prompts.md (written by PromptWriter).
     * @param {string} outputDir - Directory to save generated PNGs.
     * @param {object} [options]
     * @param {function} [options.onProgress] - Progress callback({current, total, name, status, file}).
     * @param {AbortSignal} [options.signal] - AbortController signal to cancel.
     * @returns {Promise<{successCount: number, totalCount: number, rateLimitRetries: number, skippedCount: number}>}
     */
    static async generateBatch(promptsFilePath, outputDir, options = {}) {
        const prompts = PromptParser.parseFile(promptsFilePath);
        if (prompts.length === 0) {
            throw new Error('No prompts found in file');
        }

        const gen = new BrowserImageGenerator();
        return gen.generateBatch(prompts, outputDir, options);
    }
}

module.exports = ImageGenerator;
