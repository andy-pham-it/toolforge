const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const BookWriter = require('./writer');

function makeMockLLM(returnValue) {
    return {
        chat: async (system, user, jsonMode) => {
            if (typeof returnValue === 'function') return returnValue(system, user, jsonMode);
            return returnValue;
        },
    };
}

function makeMockLogger() {
    return { info: () => {}, warn: () => {}, error: () => {} };
}

describe('BookWriter', async () => {
    describe('constructor', async () => {
        await it('should create instance without LLMClient for non-LLM methods', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            assert.ok(writer);
            assert.equal(writer.llm, undefined);
        });
    });

    describe('generateOutline', async () => {
        await it('should generate an outline from topic', async () => {
            const mockOutline = JSON.stringify({
                title: 'The Art of TypeScript',
                topic: 'TypeScript best practices',
                chapterCount: 3,
                chapters: [
                    { number: 1, title: 'Getting Started', description: 'Intro', keyPoints: ['Basics'] },
                    { number: 2, title: 'Advanced Types', description: 'Deep dive', keyPoints: ['Generics'] },
                    { number: 3, title: 'Testing', description: 'Testing patterns', keyPoints: ['Jest'] },
                ],
                estimatedLength: '100-150 pages',
            });

            const writer = new BookWriter({
                llmClient: makeMockLLM(mockOutline),
                logger: makeMockLogger(),
            });

            const outline = await writer.generateOutline('TypeScript best practices', 3);
            assert.equal(outline.title, 'The Art of TypeScript');
            assert.equal(outline.chapters.length, 3);
            assert.equal(outline.chapters[0].title, 'Getting Started');
            assert.equal(outline.estimatedLength, '100-150 pages');
        });

        await it('should throw for empty topic', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            await assert.rejects(
                () => writer.generateOutline(''),
                { message: 'Topic must be a non-empty string' },
            );
        });

        await it('should throw for out-of-range chapter count', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            await assert.rejects(
                () => writer.generateOutline('AI', 0),
                { message: 'Chapter count must be between 1 and 50' },
            );
        });

        await it('should throw if LLM is not set', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            await assert.rejects(
                () => writer.generateOutline('AI', 3),
                { message: /LLMClient is required/ },
            );
        });

        await it('should use defaults when LLM returns invalid JSON', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('not json'),
                logger: makeMockLogger(),
            });

            const outline = await writer.generateOutline('Test Topic', 2);
            assert.equal(outline.title, 'Test Topic');
            assert.equal(outline.topic, 'Test Topic');
            assert.equal(outline.chapters.length, 0);
        });
    });

    describe('writeChapter', async () => {
        const outline = {
            title: 'Test Book',
            topic: 'Testing',
            chapters: [
                { number: 1, title: 'Intro', description: 'Getting started', keyPoints: ['Setup', 'Config'] },
                { number: 2, title: 'Advanced', description: 'Deep dive', keyPoints: ['Mocking', 'Fixtures'] },
            ],
        };

        await it('should write a chapter', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('## Introduction\n\nThis is the intro chapter.'),
                logger: makeMockLogger(),
            });

            const content = await writer.writeChapter(outline, 1);
            assert.ok(content.includes('Introduction'));
        });

        await it('should include previous content for continuity', async () => {
            let lastPrompt = '';
            const writer = new BookWriter({
                llmClient: makeMockLLM((system, user) => {
                    lastPrompt = user;
                    return '## Advanced Chapter\n\nContent here.';
                }),
                logger: makeMockLogger(),
            });

            await writer.writeChapter(outline, 2, 'End of chapter 1 content here...');

            // Previous content should be mentioned
            assert.ok(lastPrompt.includes('Previous chapter'));
        });

        await it('should reject invalid chapter index', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('content'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => writer.writeChapter(outline, 0),
                { message: /Chapter index must be between 1 and/ },
            );
        });

        await it('should reject chapter index out of range', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('content'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => writer.writeChapter(outline, 99),
                { message: /Chapter index must be between 1 and/ },
            );
        });

        await it('should reject invalid outline', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('content'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => writer.writeChapter({}, 1),
                { message: 'Outline must have a chapters array' },
            );
        });

        await it('should throw if LLM is not set', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            await assert.rejects(
                () => writer.writeChapter(outline, 1),
                { message: /LLMClient is required/ },
            );
        });
    });

    describe('reviewConsistency', async () => {
        const manuscript = {
            title: 'Test Book',
            chapters: [
                { title: 'Intro', content: 'This is the introduction.' },
                { title: 'Body', content: 'This is the body chapter.' },
            ],
        };

        await it('should review a manuscript', async () => {
            const mockReview = JSON.stringify({
                score: 8.5,
                summary: 'Well-written manuscript',
                issues: [
                    {
                        type: 'repetition',
                        chapter: 2,
                        severity: 'low',
                        description: 'Repeated phrase',
                        suggestion: 'Remove duplicate',
                    },
                ],
                strengths: ['Clear structure', 'Good examples'],
            });

            const writer = new BookWriter({
                llmClient: makeMockLLM(mockReview),
                logger: makeMockLogger(),
            });

            const review = await writer.reviewConsistency(manuscript);
            assert.equal(review.score, 8.5);
            assert.equal(review.issues.length, 1);
            assert.equal(review.strengths.length, 2);
        });

        await it('should reject empty manuscript', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => writer.reviewConsistency({ chapters: [] }),
                { message: 'Manuscript must have at least one chapter' },
            );
        });

        await it('should reject invalid manuscript', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('{}'),
                logger: makeMockLogger(),
            });

            await assert.rejects(
                () => writer.reviewConsistency({}),
                { message: 'Manuscript must have a chapters array' },
            );
        });

        await it('should use defaults on invalid JSON from LLM', async () => {
            const writer = new BookWriter({
                llmClient: makeMockLLM('not json at all'),
                logger: makeMockLogger(),
            });

            const review = await writer.reviewConsistency(manuscript);
            assert.equal(review.score, 0);
            assert.equal(review.issues.length, 0);
        });
    });

    describe('exportFormat', async () => {
        const manuscript = {
            title: 'My Book',
            chapters: [
                { title: 'Chapter 1', content: 'Hello world.' },
                { title: 'Chapter 2', content: '**Bold** and *italic* text.' },
            ],
        };

        await it('should export to markdown', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            const md = await writer.exportFormat(manuscript, 'markdown');

            assert.ok(md.includes('# My Book'));
            assert.ok(md.includes('## Chapter 1'));
            assert.ok(md.includes('Hello world.'));
            assert.ok(md.includes('## Chapter 2'));
        });

        await it('should export to plain text', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            const plain = await writer.exportFormat(manuscript, 'plain');

            assert.ok(plain.includes('My Book'));
            assert.ok(plain.includes('Chapter 1'));
            assert.ok(!plain.includes('**'));  // markdown removed
            assert.ok(plain.includes('Bold')); // content preserved
        });

        await it('should export to HTML', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            const html = await writer.exportFormat(manuscript, 'html');

            assert.ok(html.includes('<h1>My Book</h1>'));
            assert.ok(html.includes('<h2>Chapter 1</h2>'));
            assert.ok(html.includes('Hello world.'));
            assert.ok(html.includes('<strong>Bold</strong>'));
            assert.ok(html.includes('<em>italic</em>'));
        });

        await it('should reject invalid format', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            await assert.rejects(
                () => writer.exportFormat(manuscript, 'pdf'),
                { message: 'Format must be one of: markdown, plain, html' },
            );
        });

        await it('should reject invalid manuscript', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            await assert.rejects(
                () => writer.exportFormat({}, 'markdown'),
                { message: 'Manuscript must have a chapters array' },
            );
        });

        await it('should handle untitled manuscript', async () => {
            const writer = new BookWriter({ logger: makeMockLogger() });
            const md = await writer.exportFormat({
                chapters: [{ title: 'Ch1', content: 'X' }],
            }, 'markdown');

            assert.ok(md.includes('# Untitled'));
        });
    });
});
