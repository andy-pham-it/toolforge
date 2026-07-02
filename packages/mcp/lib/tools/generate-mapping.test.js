const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('./generate-mapping');

describe('generate_mapping handler', () => {
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

    it('returns track mapping with formattedTrackList for valid segments', async () => {
        const llm = mockLlm({
            overallVibe: 'Contemplative journey through philosophical topics',
            formattedTrackList: 'TRACK LIST\nVibe: Contemplative...\n1. Intro (00:00-02:00) — Ambient, low energy, piano\n2. Main Discussion (02:00-10:00) — Cinematic, medium energy, strings + percussion',
            tracks: [
                {
                    segmentId: 1,
                    segmentTitle: 'Intro',
                    startTime: '00:00',
                    endTime: '02:00',
                    genre: 'Ambient',
                    subgenre: 'Dark Ambient',
                    energy: 'low',
                    bpm: 70,
                    instruments: ['piano pad', 'bass drone'],
                    moodKeywords: ['contemplative', 'warm'],
                    transition: 'fade_in',
                    sfx: ['soft chime at 00:30'],
                    notes: 'Establish atmosphere',
                },
                {
                    segmentId: 2,
                    segmentTitle: 'Main Discussion',
                    startTime: '02:00',
                    endTime: '10:00',
                    genre: 'Cinematic',
                    subgenre: 'Epic Orchestral',
                    energy: 'medium',
                    bpm: 90,
                    instruments: ['strings', 'percussion', 'brass swells'],
                    moodKeywords: ['dramatic', 'building'],
                    transition: 'crossfade',
                    sfx: ['page flip at 02:00'],
                    notes: 'Build gradually',
                },
            ],
        });

        const result = await handler(llm, {
            segments: [
                { id: 1, title: 'Intro', summary: 'Opening', startTime: '00:00', endTime: '02:00' },
                { id: 2, title: 'Main Discussion', summary: 'Deep dive', startTime: '02:00', endTime: '10:00' },
            ],
        });

        assert(result.overallVibe);
        assert(result.formattedTrackList, 'should have formattedTrackList');
        assert(result.tracks);
        assert.equal(result.tracks.length, 2);
        assert.equal(result.tracks[0].segmentTitle, 'Intro');
        assert.equal(result.tracks[0].genre, 'Ambient');
        assert(result.tracks[0].instruments);
        assert(result.tracks[0].sfx);
        assert(result.tracks[0].notes);
    });

    it('returns error when segments missing', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, {}),
            /segments/
        );
    });

    it('returns error when segments is not an array', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { segments: 'not-array' }),
            /segments/
        );
    });

    it('returns error when segments array is empty', async () => {
        const llm = mockLlm({});
        await assert.rejects(
            () => handler(llm, { segments: [] }),
            /segments/
        );
    });

    it('throws when LLM returns empty tracks array', async () => {
        const llm = mockLlm({ overallVibe: 'Test', tracks: [] });
        await assert.rejects(
            () => handler(llm, { segments: [{ id: 1, title: 'Test', startTime: '00:00', endTime: '01:00' }] }),
            /empty tracks/
        );
    });

    it('accepts mood and language parameters', async () => {
        const llm = mockLlm({
            overallVibe: 'Educational',
            formattedTrackList: 'TRACK LIST\nEducational vibe...',
            tracks: [{
                segmentId: 1, segmentTitle: 'Lesson', startTime: '00:00', endTime: '05:00',
                genre: 'Electronic', subgenre: 'Downtempo', energy: 'low', bpm: 80,
                instruments: ['synth pad'], moodKeywords: ['educational'], transition: 'fade_in',
                sfx: [], notes: 'Keep subtle',
            }],
        });

        const result = await handler(llm, {
            segments: [{ id: 1, title: 'Lesson', startTime: '00:00', endTime: '05:00' }],
            mood: 'educational',
            language: 'en',
        });

        assert(result.tracks);
        assert.equal(result.tracks.length, 1);
    });
});
