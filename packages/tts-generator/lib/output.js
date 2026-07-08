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
            tagsInjected: seg.tagsInjected || false,
            originalText: seg.originalText || null,
            sourceRef: seg.sourceRef || null,
        }));

        return { segments: paired };
    }

    /**
     * Concatenate all audio buffers into a single buffer.
     *
     * For WAV files: strips the 44-byte RIFF header from all buffers except
     * the first, so raw audio data is properly concatenated without header
     * corruption. Updates the resulting WAV header's RIFF size field.
     *
     * For non-WAV formats: falls back to naive Buffer.concat with a warning.
     *
     * @param {Buffer[]} audioBuffers
     * @returns {Buffer}
     */
    formatSingle(audioBuffers) {
        if (audioBuffers.length === 0) {
            return Buffer.alloc(0);
        }
        if (audioBuffers.length === 1) {
            return audioBuffers[0];
        }

        // Check if all buffers are WAV (starts with "RIFF" and "WAVE")
        const isWav = audioBuffers.every(
            b => b.length >= 44 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE'
        );

        if (!isWav) {
            console.warn('OutputFormatter: non-WAV format detected, using naive buffer concatenation');
            return Buffer.concat(audioBuffers);
        }

        // WAV-aware concatenation:
        // Keep the full first buffer (header + data), then append only the
        // audio data chunk from subsequent buffers (skip the 44-byte header).
        const chunks = [audioBuffers[0]];
        for (let i = 1; i < audioBuffers.length; i++) {
            chunks.push(audioBuffers[i].subarray(44));
        }

        const combined = Buffer.concat(chunks);

        // Update the RIFF chunk size field at byte 4 (little-endian 32-bit)
        // Value = total file size - 8 (everything after the size field itself)
        const totalSize = combined.length - 8;
        combined.writeUInt32LE(totalSize, 4);

        // For subchunk2Size at byte 40: total data = combined.length - 44
        // (for standard PCM WAV with 44-byte header)
        const dataSize = combined.length - 44;
        combined.writeUInt32LE(dataSize, 40);

        return combined;
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
                tagsInjected: segments[i].tagsInjected || false,
                originalText: segments[i].originalText || null,
                sourceRef: segments[i].sourceRef || null,
            };
        }
    }
}

module.exports = OutputFormatter;
