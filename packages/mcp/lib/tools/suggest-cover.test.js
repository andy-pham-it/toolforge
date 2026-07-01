const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./suggest-cover');

describe('suggest_cover handler', () => {
    function mockLlm(returnValue) {
        return {
            chat: mock.fn(async (_sys, _user, jsonMode) => {
                assert.equal(jsonMode, true);
                return typeof returnValue === 'string'
                    ? returnValue
                    : JSON.stringify(returnValue);
            }),
        };
    }

    it('returns cover design with formattedBrief for valid input', async () => {
        const llm = mockLlm({
            designRationale: 'Philosophical tone matching the deep content',
            formattedBrief: 'DESIGN BRIEF\nPhilosophical tone...\nColors: #000, #fff, #f00\nSeries: Test concept...',
            colorPalette: {
                primary: '#1a1a2e',
                secondary: '#16213e',
                accent: '#e94560',
                background: '#0f3460',
                text: '#ffffff',
            },
            seriesCover: {
                conceptTitle: 'Cosmic Philosophy',
                visualStyle: 'Surrealist',
                composition: 'Abstract shapes in deep space',
                prompt: 'Surreal cosmic landscape with floating geometric shapes',
                filename: 'cover_series.png',
            },
            episodeCover: {
                conceptTitle: 'Episode Journey',
                visualStyle: 'Surrealist',
                composition: 'A figure walking through a dreamscape',
                prompt: 'Silhouette walking through surreal dreamscape',
                filename: 'cover_episode.png',
            },
            thumbnail: {
                conceptTitle: 'Thumbnail Impact',
                visualStyle: 'Comparison',
                composition: 'Split image showing before/after contrast',
                prompt: 'Split composition contrasting dark and light',
                filename: 'thumbnail.png',
            },
        });

        const result = await handler(llm, {
            title: 'My Deep Podcast',
            description: 'A philosophical journey',
        });

        assert(result.designRationale);
        assert(result.formattedBrief, 'should have formattedBrief');
        assert(result.colorPalette);
        assert(result.seriesCover);
        assert(result.episodeCover);
        assert(result.thumbnail);
    });

    it('returns error when title missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { description: 'test' }),
            /title/
        );
    });

    it('returns error when description missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { title: 'test' }),
            /description/
        );
    });

    it('throws when LLM returns incomplete data (no designRationale)', async () => {
        const llm = mockLlm({ colorPalette: {} });
        await assert.rejects(
            () => handler(llm, { title: 'Test', description: 'Test desc' }),
            /incomplete/
        );
    });

    it('throws when LLM returns no cover sections', async () => {
        const llm = mockLlm({ designRationale: 'Some rationale' });
        await assert.rejects(
            () => handler(llm, { title: 'Test', description: 'Test desc' }),
            /incomplete/
        );
    });

    it('accepts coverType=thumbnail and returns partial result', async () => {
        const llm = mockLlm({
            designRationale: 'Thumbnail-focused design',
            formattedBrief: 'Thumbnail design brief...',
            colorPalette: { primary: '#000', secondary: '#fff', accent: '#f00', background: '#333', text: '#fff' },
            thumbnail: {
                conceptTitle: 'Bold Thumbnail',
                visualStyle: 'Typography',
                composition: 'Bold text over dark gradient',
                prompt: 'Typography with bold text on dark gradient',
                filename: 'thumbnail.png',
            },
        });

        const result = await handler(llm, {
            title: 'Test',
            description: 'Test desc',
            coverType: 'thumbnail',
        });

        assert(result.formattedBrief);
        assert(result.thumbnail);
        assert(!result.seriesCover);
    });
});
