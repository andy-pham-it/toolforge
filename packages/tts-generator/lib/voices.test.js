const { describe, it } = require('node:test');
const assert = require('node:assert');
const { VOICES, VOICE_NAMES, getVoice, pickVoiceForTone } = require('./voices');

describe('voices', () => {
    it('should export exactly 30 voices', () => {
        assert.strictEqual(VOICE_NAMES.length, 30);
    });

    it('each voice should have style and description', () => {
        for (const name of VOICE_NAMES) {
            const v = VOICES[name];
            assert.ok(v, `Voice "${name}" missing from VOICES`);
            assert.ok(typeof v.style === 'string' && v.style.length > 0, `Voice "${name}" missing style`);
            assert.ok(typeof v.description === 'string' && v.description.length > 0, `Voice "${name}" missing description`);
        }
    });

    it('getVoice should return correct voice data (case-insensitive)', () => {
        const v = getVoice('kore');
        assert.ok(v);
        assert.strictEqual(v.style, 'Firm');
    });

    it('getVoice should return null for unknown name', () => {
        assert.strictEqual(getVoice('nonexistent'), null);
    });

    it('pickVoiceForTone should return a valid voice name for each tone', () => {
        const tones = ['informative', 'upbeat', 'calm', 'authoritative', 'friendly'];
        for (const tone of tones) {
            const name = pickVoiceForTone(tone);
            assert.ok(VOICES[name], `pickVoiceForTone("${tone}") returned invalid voice "${name}"`);
        }
    });
});
