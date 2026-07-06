'use strict';

class OutputFormatter {
    /**
     * Format batch output: structured segment-audio pairs.
     * @param {Array} segments - Original segment objects
     * @param {Buffer[]} audioBuffers - Audio buffers in same order
     * @returns {{ segments: Array<{id, text, audio, voice, duration}> }}
     */
    formatBatch(segments, audioBuffers) {
        if (segments.length !== audioBuffers.length) {
            throw new Error(`OutputFormatter: segment/audio length mismatch (${segments.length} vs ${audioBuffers.length})`);
        }

        const paired = segments.map((seg, i) => ({
            id: seg.id || i + 1,
            text: seg.text,
            audio: audioBuffers[i],
            voice: seg.voice || 'auto',
            duration: seg.duration || seg.estimatedDuration || null,
        }));

        return { segments: paired };
    }

    /**
     * Concatenate all audio buffers into a single buffer.
     * Note: For production use, proper WAV concatenation may be needed.
     * For v1, simple buffer concatenation for same-format audio clips.
     *
     * @param {Buffer[]} audioBuffers
     * @returns {Buffer}
     */
    formatSingle(audioBuffers) {
        return Buffer.concat(audioBuffers);
    }

    /**
     * Stream output: yields one segment-audio pair at a time.
     *
     * @param {Array} segments
     * @param {Buffer[]} audioBuffers
     * @returns {AsyncGenerator}
     */
    async *formatStream(segments, audioBuffers) {
        if (segments.length !== audioBuffers.length) {
            throw new Error(`OutputFormatter: segment/audio length mismatch (${segments.length} vs ${audioBuffers.length})`);
        }

        for (let i = 0; i < segments.length; i++) {
            yield {
                id: segments[i].id || i + 1,
                text: segments[i].text,
                audio: audioBuffers[i],
                voice: segments[i].voice || 'auto',
                duration: segments[i].duration || segments[i].estimatedDuration || null,
            };
        }
    }
}

module.exports = OutputFormatter;
