'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('validateSeries', () => {
    let validateSeries, _listFiles, _checkTocMetadata;
    let validDir, brokenDir;

    before(() => {
        const m = require('./validate-series');
        validateSeries = m.validateSeries;
        _listFiles = m._listFiles;
        _checkTocMetadata = m._checkTocMetadata;

        // Valid series directory
        validDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-val-'));
        fs.writeFileSync(path.join(validDir, '00-muc-luc.md'), [
            '# Test Series',
            '',
            '**Số bài học:** 2',
            '**Ngày tạo:** 2026-07-17',
            '**Slug:** `test-series`',
            '',
            '## Mục lục',
            '',
            '1. [Bài 1](01-bai-1.md)',
            '2. [Bài 2](02-bai-2.md)',
        ].join('\n'), 'utf-8');

        fs.writeFileSync(path.join(validDir, '01-bai-1.md'), '# Bài 1\n\nContent', 'utf-8');
        fs.writeFileSync(path.join(validDir, '02-bai-2.md'), '# Bài 2\n\nContent', 'utf-8');

        // Broken series directory — missing TOC
        brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-broken-'));
        fs.writeFileSync(path.join(brokenDir, '01-lesson.md'), '# Lesson', 'utf-8');
        fs.writeFileSync(path.join(brokenDir, '03-lesson.md'), '# Lesson 3 — gap', 'utf-8');
    });

    after(() => {
        fs.rmSync(validDir, { recursive: true, force: true });
        fs.rmSync(brokenDir, { recursive: true, force: true });
    });

    it('loads the module', () => {
        assert.ok(typeof validateSeries === 'function');
    });

    it('throws if seriesDir is missing', async () => {
        await assert.rejects(
            () => validateSeries({}),
            /seriesDir is required/,
        );
    });

    it('returns error for missing directory', async () => {
        const result = await validateSeries({ seriesDir: '/nonexistent/path' });
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.length > 0);
    });

    it('returns error for non-directory path', async () => {
        const result = await validateSeries({ seriesDir: __filename });
        assert.strictEqual(result.valid, false);
    });

    it('validates a well-formed series directory', async () => {
        const result = await validateSeries({ seriesDir: validDir });
        assert.ok(result.valid, `Expected valid, got errors: ${JSON.stringify(result.errors)}`);
        assert.strictEqual(result.stats.lessons, 2);
        assert.strictEqual(result.errors.length, 0);
    });

    it('detects missing 00-muc-luc.md', async () => {
        const result = await validateSeries({ seriesDir: brokenDir });
        assert.ok(result.errors.some(e => e.includes('00-muc-luc.md')));
    });

    it('detects lesson numbering gaps', async () => {
        const result = await validateSeries({ seriesDir: brokenDir });
        assert.ok(result.errors.some(e => e.includes('numbering gap')));
    });
});

describe('_listFiles', () => {
    const { _listFiles } = require('./validate-series');
    let tmpDir;

    before(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-list-'));
        fs.writeFileSync(path.join(tmpDir, 'a.md'), '', 'utf-8');
        fs.mkdirSync(path.join(tmpDir, 'sub'));
        fs.writeFileSync(path.join(tmpDir, 'sub', 'b.md'), '', 'utf-8');
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('lists all files recursively', () => {
        const files = _listFiles(tmpDir);
        assert.ok(files.some(f => f.endsWith('a.md')));
        assert.ok(files.some(f => f.endsWith('b.md')));
    });
});

describe('_checkTocMetadata', () => {
    const { _checkTocMetadata } = require('./validate-series');

    it('passes for well-formed TOC', () => {
        const content = [
            '# My Series',
            '',
            '**Số bài học:** 5',
            '**Ngày tạo:** 2026-01-01',
            '',
            '## Mục lục',
        ].join('\n');

        const result = _checkTocMetadata(content);
        assert.strictEqual(result.errors.length, 0);
    });

    it('warns for missing metadata', () => {
        const content = '# Title';
        const result = _checkTocMetadata(content);
        assert.ok(result.warnings.length > 0);
    });

    it('flags missing title', () => {
        const content = 'No title';
        const result = _checkTocMetadata(content);
        assert.ok(result.errors.some(e => e.includes('missing title')));
    });
});
