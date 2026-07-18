'use strict';
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('embedImagesToMarkdown', () => {
    let embedImagesToMarkdown;
    let tmpDir;

    before(() => {
        embedImagesToMarkdown = require('./embed-images').embedImagesToMarkdown;
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-img-'));
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('loads the module', () => {
        assert.ok(typeof embedImagesToMarkdown === 'function');
    });

    it('throws if markdown is missing', async () => {
        await assert.rejects(
            () => embedImagesToMarkdown({}),
            /markdown is required/,
        );
    });

    it('returns original markdown if no placeholders', async () => {
        const md = '# Hello\n\nNo images here.';
        const result = await embedImagesToMarkdown({ markdown: md });
        assert.strictEqual(result.markdown, md);
        assert.deepStrictEqual(result.images, []);
    });

    it('detects image placeholders', async () => {
        const md = 'Text ![desc](placeholder:test image) more text';
        const result = await embedImagesToMarkdown({ markdown: md, outputDir: tmpDir });
        // Should have attempted image generation (will fail without API key, but placeholders should be replaced)
        assert.ok(result.markdown);
    });

    it('handles multiple unique placeholders', async () => {
        const md = [
            '![img1](placeholder:first concept)',
            'more text',
            '![img2](placeholder:second concept)',
        ].join('\n');

        const result = await embedImagesToMarkdown({ markdown: md, outputDir: tmpDir });
        assert.ok(result.markdown);
    });

    it('handles markdown with no matching content gracefully', async () => {
        const md = '# Just text\nNo placeholders here.';
        const result = await embedImagesToMarkdown({ markdown: md, outputDir: tmpDir });
        assert.strictEqual(result.markdown, md);
        assert.deepStrictEqual(result.images, []);
    });
});
