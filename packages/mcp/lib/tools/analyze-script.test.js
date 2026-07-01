const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./analyze-script');

describe('analyze_script handler', () => {
    function mockLlm(result) {
        return {
            apiKey: 'test-key',
            model: 'gemini-2.0-flash',
            analyzeScript: mock.fn(async (_script, _title, _outline, _density, _lang) => {
                return result;
            }),
        };
    }

    it('returns segments with formattedSummary for valid input', async () => {
        const segments = [
            {
                id: 1,
                title: 'Introduction',
                summary: 'Opening with key questions',
                visualType: 'Typography',
                prompts: { a: 'Typography title card with bold quote', b: 'Silhouette under spotlight', c: '', d: '', e: '' },
                editSuggestions: { zoom: 'none', context: 'intro', mood: 'neutral' },
            },
            {
                id: 2,
                title: 'Main Discussion',
                summary: 'Deep dive into the topic',
                visualType: 'Surrealist',
                startTime: '02:30',
                endTime: '15:00',
                prompts: { a: 'Abstract dreamscape with floating questions', b: 'Mirror reflection scene', c: 'Contrasting viewpoints split composition', d: '', e: '' },
                editSuggestions: { zoom: 'slow', context: 'discussion', mood: 'thoughtful' },
            },
        ];

        const llm = mockLlm(segments);
        const result = await handler(llm, {
            script: 'Hello and welcome to the show...',
            title: 'My Podcast Episode',
        });

        assert(result.segments);
        assert.equal(result.segments.length, 2);
        assert(result.formattedSummary, 'should have formattedSummary');
        assert(result.formattedSummary.includes('Introduction'));
        assert(result.formattedSummary.includes('Main Discussion'));
        assert(result.formattedSummary.includes('Prompt: Abstract'));
        assert(result.formattedSummary.includes('Style: Surrealist'));
    });

    it('returns error when script missing', async () => {
        const llm = mockLlm([]);
        await assert.rejects(
            () => handler(llm, { title: 'Test' }),
            /script/
        );
    });

    it('returns error when title missing', async () => {
        const llm = mockLlm([]);
        await assert.rejects(
            () => handler(llm, { script: 'test' }),
            /title/
        );
    });

    it('handles empty outline gracefully', async () => {
        const segments = [{
            id: 1, title: 'Intro', summary: 'Opening',
            visualType: 'Typography',
            prompts: { a: 'P1', b: 'P2', c: '', d: '', e: '' },
            editSuggestions: {},
        }];
        const llm = mockLlm(segments);
        const result = await handler(llm, {
            script: 'Script text',
            title: 'Test',
        });
        assert(result.segments);
        assert(result.formattedSummary);
    });

    it('passes language and density parameters', async () => {
        const segments = [{
            id: 1, title: 'Intro', summary: 'Mở đầu',
            visualType: 'Typography',
            prompts: { a: 'P1', b: '', c: '', d: '', e: '' },
            editSuggestions: {},
        }];
        const llm = mockLlm(segments);
        const result = await handler(llm, {
            script: 'Script text',
            title: 'Test',
            lang: 'vi',
            density: 3,
        });
        assert(result.segments);
        assert(result.formattedSummary);
    });
});
