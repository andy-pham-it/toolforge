'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const OutputFormatter = require('./output');

const SAMPLE_SEGMENTS = [
    { id: 1, text: 'First segment.', voice: 'Charon', duration: 10 },
    { id: 2, text: 'Second segment.', voice: 'Kore', duration: 8 },
];

const SAMPLE_AUDIO = [
    Buffer.from('audio-data-1'),
    Buffer.from('audio-data-2'),
];

describe('OutputFormatter', () => {
    describe('formatBatch()', () => {
        it('should return array of segment + audio pairs', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatBatch(SAMPLE_SEGMENTS, SAMPLE_AUDIO);

            assert.ok(result, 'result should be returned');
            assert.ok(Array.isArray(result.segments), 'result.segments should be array');
            assert.equal(result.segments.length, 2);

            assert.equal(result.segments[0].text, 'First segment.');
            assert.equal(result.segments[0].voice, 'Charon');
            assert.ok(Buffer.isBuffer(result.segments[0].audio));
            assert.equal(result.segments[0].audio.toString(), 'audio-data-1');

            assert.equal(result.segments[1].text, 'Second segment.');
            assert.equal(result.segments[1].voice, 'Kore');
        });

        it('should handle empty arrays', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatBatch([], []);
            assert.ok(result);
            assert.equal(result.segments.length, 0);
        });

        it('should throw if arrays have different lengths', () => {
            const formatter = new OutputFormatter();
            assert.throws(
                () => formatter.formatBatch(SAMPLE_SEGMENTS, [Buffer.from('only-one')]),
                { message: /mismatch/i },
            );
        });
    });

    describe('formatSingle()', () => {
        it('should concatenate audio buffers into one', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatSingle(SAMPLE_AUDIO);

            assert.ok(Buffer.isBuffer(result), 'result should be a Buffer');
            assert.equal(result.toString(), 'audio-data-1audio-data-2');
        });

        it('should return empty buffer for empty input', () => {
            const formatter = new OutputFormatter();
            const result = formatter.formatSingle([]);
            assert.ok(Buffer.isBuffer(result));
            assert.equal(result.length, 0);
        });
    });

    describe('formatStream()', () => {
        it('should yield each segment audio sequentially', async () => {
            const formatter = new OutputFormatter();
            const stream = formatter.formatStream(SAMPLE_SEGMENTS, SAMPLE_AUDIO);

            const items = [];
            for await (const item of stream) {
                items.push(item);
            }

            assert.equal(items.length, 2);
            assert.equal(items[0].text, 'First segment.');
            assert.equal(items[1].text, 'Second segment.');
            assert.ok(Buffer.isBuffer(items[0].audio));
        });

        it('should yield from empty input without error', async () => {
            const formatter = new OutputFormatter();
            const stream = formatter.formatStream([], []);
            const items = [];
            for await (const item of stream) {
                items.push(item);
            }
            assert.equal(items.length, 0);
        });
    });
});
