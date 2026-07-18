'use strict';

/**
 * embedImagesToMarkdown — Replace image placeholders with generated images.
 *
 * Scans markdown content for placeholders in the format:
 *   ![alt](placeholder:description)
 * Generates an image for each unique description using Gemini Images API,
 * then replaces the placeholder with a proper markdown image link.
 *
 * @param {object} options
 * @param {string} options.markdown      — Markdown content with placeholders
 * @param {string} [options.outputDir]   — Where to save generated images (default: ./images)
 * @param {string} [options.apiKey]      — Gemini API key (or set GEMINI_API_KEY env)
 * @returns {Promise<{ markdown: string, images: string[] }>}
 */
async function embedImagesToMarkdown(options) {
    const { markdown, outputDir = 'images', apiKey } = options;

    if (!markdown) throw new Error('markdown is required');

    // Find all image placeholders: ![alt](placeholder:description)
    const placeholderRegex = /!\[([^\]]*)\]\(placeholder:([^)]+)\)/g;
    const placeholders = [];
    let match;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
        placeholders.push({
            full: match[0],
            alt: match[1],
            description: match[2].trim(),
        });
    }

    if (placeholders.length === 0) {
        return { markdown, images: [] };
    }

    const fs = require('fs');
    const path = require('path');

    // Resolve output directory
    const resolvedDir = path.resolve(outputDir);
    fs.mkdirSync(resolvedDir, { recursive: true });

    const generated = [];

    // Generate images using Gemini API
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });

    let result = markdown;

    for (const ph of placeholders) {
        const fileSlug = ph.description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60);

        const fileName = `${fileSlug}-${Date.now()}.png`;
        const filePath = path.join(resolvedDir, fileName);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image',
                contents: [{ role: 'user', parts: [{ text: ph.description }] }],
                config: {
                    responseModalities: ['image', 'text'],
                },
            });

            // Extract image data from response
            let imageData = null;
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    imageData = part.inlineData.data;
                    break;
                }
            }

            if (imageData) {
                const buffer = Buffer.from(imageData, 'base64');
                fs.writeFileSync(filePath, buffer);

                const relativePath = path.relative(path.dirname(path.resolve('.')), filePath);
                const imgTag = `![${ph.alt}](${relativePath})`;
                result = result.replace(ph.full, imgTag);
                generated.push(filePath);
            } else {
                // If no image returned, try browser-based generation fallback
                result = result.replace(ph.full, `*[Image: ${ph.description}](${filePath})*`);
            }
        } catch (err) {
            console.error(`[authoring] Failed to generate image for "${ph.description}":`, err.message);
            result = result.replace(ph.full, `*[Image generation failed: ${ph.description}]*`);
        }
    }

    return { markdown: result, images: generated };
}

module.exports = { embedImagesToMarkdown };
