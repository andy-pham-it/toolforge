'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('scaffoldSeries', () => {
    let scaffoldSeries, _buildToc, _buildLessonScaffold;
    let tmpDir;

    before(() => {
        const m = require('./scaffold-series');
        scaffoldSeries = m.scaffoldSeries;
        _buildToc = m._buildToc;
        _buildLessonScaffold = m._buildLessonScaffold;
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'authoring-test-'));
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('loads the module', () => {
        assert.ok(typeof scaffoldSeries === 'function');
    });

    it('throws if topic is missing', async () => {
        await assert.rejects(
            () => scaffoldSeries({ outputDir: tmpDir }),
            /topic is required/,
        );
    });

    it('throws if outputDir is missing', async () => {
        await assert.rejects(
            () => scaffoldSeries({ topic: 'Test' }),
            /outputDir is required/,
        );
    });

    it('creates series structure with explicit lesson titles (no LLM)', async () => {
        const result = await scaffoldSeries({
            topic: 'Python Basics',
            outputDir: tmpDir,
            lessonCount: 3,
            lessonTitles: ['Intro to Python', 'Variables & Types', 'Control Flow'],
            language: 'en',
        });

        assert.ok(fs.existsSync(result.seriesDir));
        assert.ok(fs.existsSync(result.tocFile));
        assert.strictEqual(result.lessonFiles.length, 3);

        // Check images dir exists
        assert.ok(fs.existsSync(path.join(result.seriesDir, 'images')));

        // Check TOC content
        const toc = fs.readFileSync(result.tocFile, 'utf-8');
        assert.ok(toc.includes('# Python Basics'));
        assert.ok(toc.includes('Intro to Python'));
        assert.ok(toc.includes('Variables & Types'));

        // Check lesson files exist
        for (const lf of result.lessonFiles) {
            assert.ok(fs.existsSync(lf), `Missing: ${lf}`);
            const content = fs.readFileSync(lf, 'utf-8');
            assert.ok(content.includes('## Learning Objectives'));
            assert.ok(content.includes('## Main Content'));
        }
    });

    it('rejects existing series directory', async () => {
        // Create a dir to cause conflict
        const slug = 'python-basics';
        const existingDir = path.join(tmpDir, slug);

        await assert.rejects(
            () => scaffoldSeries({ topic: 'Python Basics', outputDir: tmpDir, lessonTitles: ['A'] }),
            /already exists/,
        );
    });

    it('generates lesson titles via LLM when not provided', async () => {
        const mockLLM = {
            chat: async () => ['Intro', 'Functions', 'Classes'].join('\n'),
        };

        const result = await scaffoldSeries({
            topic: 'OOP',
            outputDir: fs.mkdtempSync(path.join(tmpDir, 'oop-')),
            lessonCount: 3,
            language: 'en',
            llm: mockLLM,
        });

        assert.strictEqual(result.lessonFiles.length, 3);
    });
});

describe('_buildToc', () => {
    const { _buildToc } = require('./scaffold-series');

    it('generates Vietnamese TOC', () => {
        const result = _buildToc({
            topic: 'Khoa Học',
            slug: 'khoa-hoc',
            language: 'vi',
            titles: ['Bài 1', 'Bài 2'],
        });

        assert.ok(result.includes('# Khoa Học'));
        assert.ok(result.includes('Số bài học'));
        assert.ok(result.includes('Mục lục'));
        assert.ok(result.includes('Bài 1'));
        assert.ok(result.includes('Bài 2'));
    });

    it('generates English TOC', () => {
        const result = _buildToc({
            topic: 'Science',
            slug: 'science',
            language: 'en',
            titles: ['Lesson 1', 'Lesson 2'],
        });

        assert.ok(result.includes('Lessons:'));
        assert.ok(result.includes('Table of Contents'));
    });
});

describe('_buildLessonScaffold', () => {
    const { _buildLessonScaffold } = require('./scaffold-series');

    it('includes standard sections', () => {
        const result = _buildLessonScaffold({
            index: 1,
            title: 'Getting Started',
            seriesTopic: 'Python',
            slug: 'getting-started',
            language: 'en',
        });

        assert.ok(result.includes('# Getting Started'));
        assert.ok(result.includes('## Learning Objectives'));
        assert.ok(result.includes('## Prerequisites'));
        assert.ok(result.includes('## Main Content'));
        assert.ok(result.includes('## Exercises'));
        assert.ok(result.includes('## Summary'));
        assert.ok(result.includes('## References'));
    });

    it('generates Vietnamese template', () => {
        const result = _buildLessonScaffold({
            index: 1,
            title: 'Bài 1',
            seriesTopic: 'Python',
            slug: 'bai-1',
            language: 'vi',
        });

        assert.ok(result.includes('Mục tiêu bài học'));
        assert.ok(result.includes('Kiến thức nền tảng'));
        assert.ok(result.includes('Nội dung chính'));
        assert.ok(result.includes('Bài tập'));
        assert.ok(result.includes('Tóm tắt'));
    });
});
