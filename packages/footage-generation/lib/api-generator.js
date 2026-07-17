'use strict';

/**
 * api-generator.js — ApiImageGenerator
 *
 * Alternative to BrowserImageGenerator that uses the Gemini API
 * (gemini-3.1-flash-image model) to generate images directly.
 *
 * Trade-offs vs BrowserImageGenerator (Puppeteer):
 *   + Much faster (no human-like delays, no batch breaks)
 *   + No Chrome needed
 *   + More reliable (no CDN capture, no rate-limit mimicry)
 *   + Aspect ratio control (native API support)
 *   - Requires GEMINI_API_KEY (API costs)
 *   - Cannot bypass Gemini's own rate limits without API quota
 *
 * Default: BrowserImageGenerator remains the default.
 * Use method: 'api' to switch.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

class ApiImageGenerator {
    /**
     * @param {object} [options]
     * @param {string} [options.apiKey] - Gemini API key (default: GEMINI_API_KEY env)
     * @param {string} [options.model] - Gemini model (default: gemini-3.1-flash-image)
     * @param {string} [options.aspectRatio] - Aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9; default 16:9)
     * @param {string} [options.mimeType] - Output MIME type (image/jpeg, image/png; default image/jpeg)
     * @param {string[]} [options.outputFormats] - Additional formats (default ['png'])
     * @param {number} [options.jpgQuality] - JPEG quality 1-100 (default 85)
     * @param {number} [options.webpQuality] - WebP quality 1-100 (default 80)
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
        this.model = options.model || 'gemini-3.1-flash-image';
        this.aspectRatio = options.aspectRatio || '16:9';
        this.mimeType = options.mimeType || 'image/jpeg';
        this.outputFormats = options.outputFormats || ['png'];
        this.jpgQuality = options.jpgQuality || 85;
        this.webpQuality = options.webpQuality || 80;
    }

    /**
     * Generate images for an array of prompts via Gemini API.
     *
     * @param {Array<{name: string, file: string, prompt: string}>} prompts
     * @param {string} outputDir - Directory to save images.
     * @param {object} [options]
     * @param {function} [options.onProgress] - Callback({current, total, name, status, file}).
     * @param {AbortSignal} [options.signal] - AbortController signal.
     * @returns {Promise<{successCount: number, totalCount: number, rateLimitRetries: number, skippedCount: number}>}
     */
    async generateBatch(prompts, outputDir, options = {}) {
        const { onProgress, signal } = options;

        if (!this.apiKey) {
            throw new Error(
                'Gemini API key required for API mode. ' +
                'Set GEMINI_API_KEY environment variable or pass apiKey in options.'
            );
        }

        fs.mkdirSync(outputDir, { recursive: true });

        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: this.apiKey });

        let successCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < prompts.length; i++) {
            if (signal?.aborted) break;

            const p = prompts[i];
            const fileName = p.file || `scene_${String(i + 1).padStart(2, '0')}.jpg`;
            const outputPath = path.join(outputDir, fileName);

            this._emitProgress(onProgress, {
                current: i + 1, total: prompts.length,
                name: p.name, status: 'generating', file: fileName,
            });

            // Skip existing
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
                successCount++;
                skippedCount++;
                this._emitProgress(onProgress, {
                    current: i + 1, total: prompts.length,
                    name: p.name, status: 'skipped', file: fileName,
                });
                continue;
            }

            try {
                const interaction = await ai.interactions.create({
                    model: this.model,
                    input: p.prompt,
                    response_format: {
                        type: 'image',
                        mime_type: this.mimeType,
                        aspect_ratio: this.aspectRatio,
                    },
                });

                // output_image is a convenience property for the most recent image block
                const imageData = interaction?.output_image?.data
                    || this._findImageInSteps(interaction?.steps);

                if (!imageData) {
                    throw new Error('No image data in Gemini API response');
                }

                const buffer = Buffer.from(imageData, 'base64');
                fs.writeFileSync(outputPath, buffer);
                await this._convertOutputFormats(buffer, outputPath);

                successCount++;
                this._emitProgress(onProgress, {
                    current: i + 1, total: prompts.length,
                    name: p.name, status: 'done', file: fileName,
                });
            } catch (err) {
                this._emitProgress(onProgress, {
                    current: i + 1, total: prompts.length,
                    name: p.name, status: `error: ${err.message}`, file: fileName,
                });
            }
        }

        return {
            successCount,
            totalCount: prompts.length,
            rateLimitRetries: 0,
            skippedCount,
        };
    }

    /**
     * Fallback: walk interaction steps looking for an image content block.
     * @private
     */
    _findImageInSteps(steps) {
        if (!steps || !Array.isArray(steps)) return null;
        for (const step of steps) {
            const blocks = step.content;
            if (!blocks) continue;
            const list = Array.isArray(blocks) ? blocks : [blocks];
            for (const block of list) {
                if (block.type === 'image' && block.data) {
                    return block.data;
                }
            }
        }
        return null;
    }

    /**
     * Convert the saved image to configured output formats (jpg, webp) via sharp.
     * @private
     */
    async _convertOutputFormats(buffer, outputPath) {
        const baseName = outputPath.replace(/\.(png|jpg|jpeg)$/i, '');
        if (baseName === outputPath) return;

        for (const fmt of this.outputFormats || ['png']) {
            const f = fmt.toLowerCase().trim();
            if (f === 'png') continue;

            const ext = f === 'jpeg' ? 'jpg' : f;
            const outPath = `${baseName}.${ext}`;

            try {
                if (f === 'jpg' || f === 'jpeg') {
                    await sharp(buffer).jpeg({ quality: this.jpgQuality }).toFile(outPath);
                } else if (f === 'webp') {
                    await sharp(buffer).webp({ quality: this.webpQuality }).toFile(outPath);
                } else {
                    continue;
                }
                const stat = fs.statSync(outPath);
            } catch (err) {
                // Non-fatal: log and continue
            }
        }
    }

    _emitProgress(onProgress, data) {
        if (typeof onProgress === 'function') onProgress(data);
    }
}

module.exports = ApiImageGenerator;
