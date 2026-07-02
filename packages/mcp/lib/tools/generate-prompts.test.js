const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./generate-prompts');

describe('generate_prompts handler', () => {
    function mockLlm(returnValue) {
        return {
            chat: async (_sys, _user, jsonMode) => {
                assert.equal(jsonMode, true);
                return typeof returnValue === 'string'
                    ? returnValue
                    : JSON.stringify(returnValue);
            },
        };
    }

    it('returns segments for valid input', async () => {
        const segments = [
            {
                id: 1,
                segmentTitle: 'Opening Hook',
                summary: 'Grabbing attention with a provocative question',
                visualStyle: 'Typography',
                startTime: '00:00',
                endTime: '01:30',
                images: {
                    a: { filename: '1_opening_a.png', prompt: 'Typography with bold question text on dark background', editSuggestions: { closer: 'Zoom in', differentSpace: 'Add particles', moodShift: 'Darker' } },
                    b: { filename: '1_opening_b.png', prompt: 'Silhouette thinking under spotlight', editSuggestions: {} },
                    c: { filename: '1_opening_c.png', prompt: 'Abstract question marks floating', editSuggestions: {} },
                    d: { filename: '1_opening_d.png', prompt: 'Minimalist clock ticking', editSuggestions: {} },
                    e: { filename: '1_opening_e.png', prompt: 'Transition to black', editSuggestions: {} },
                },
            },
        ];

        const llm = mockLlm(segments);
        const result = await handler(llm, {
            script: 'Have you ever wondered...',
            title: 'Deep Questions',
        });

        assert(result.segments);
        assert.equal(result.segments.length, 1);
        assert(result.segments[0].images.a);
        assert(result.segments[0].images.a.prompt);
        assert(result.segments[0].images.a.filename);
        assert(result.segments[0].images.b);
        assert(result.segments[0].images.e);
        assert(result.segments[0].images.a.editSuggestions.closer);
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

    it('throws when LLM returns empty array', async () => {
        const llm = mockLlm([]);
        await assert.rejects(
            () => handler(llm, { script: 'test', title: 'Test' }),
            /empty segments/
        );
    });

    it('throws when LLM returns segment without prompts', async () => {
        const llm = mockLlm([{ id: 1, segmentTitle: 'Broken' }]);
        await assert.rejects(
            () => handler(llm, { script: 'test', title: 'Test' }),
            /incomplete/
        );
    });

    it('passes optional outline and language', async () => {
        const segments = [{
            id: 1,
            segmentTitle: 'Test',
            summary: 'Test',
            visualStyle: 'Typography',
            startTime: '00:00',
            endTime: '01:00',
            images: {
                a: { filename: '1_test_a.png', prompt: 'Test prompt', editSuggestions: {} },
                b: { filename: '1_test_b.png', prompt: 'Test prompt 2', editSuggestions: {} },
                c: { filename: '1_test_c.png', prompt: 'Test prompt 3', editSuggestions: {} },
                d: { filename: '1_test_d.png', prompt: 'Test prompt 4', editSuggestions: {} },
                e: { filename: '1_test_e.png', prompt: 'Test prompt 5', editSuggestions: {} },
            },
        }];

        const llm = mockLlm(segments);
        const result = await handler(llm, {
            script: 'test',
            title: 'Test',
            outline: '1. Intro\n2. Main\n3. Conclusion',
            language: 'vi',
            density: 5,
        });

        assert(result.segments);
        assert.equal(result.segments[0].images.a.prompt, 'Test prompt');
    });
});
