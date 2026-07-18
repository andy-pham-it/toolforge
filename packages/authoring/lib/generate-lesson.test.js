'use strict';
const { describe, it, mock } = require('node:test');
const assert = require('node:assert');

describe('generateLesson', () => {
    let generateLesson;

    it('loads the module', () => {
        generateLesson = require('./generate-lesson').generateLesson;
        assert.ok(typeof generateLesson === 'function');
    });

    it('throws if topic is missing', async () => {
        await assert.rejects(
            () => generateLesson({ audience: 'beginners' }),
            /topic is required/,
        );
    });

    it('throws if audience is missing', async () => {
        await assert.rejects(
            () => generateLesson({ topic: 'JS' }),
            /audience is required/,
        );
    });

    it('returns structured lesson plan with mock LLM', async () => {
        // Mock LLMClient
        const mockLLM = {
            chat: async () => [
                '# Understanding JavaScript Promises',
                '',
                '## Learning Objectives',
                '- Objective 1',
                '',
                '## Prerequisites',
                '- Basic JS',
                '',
                '## Main Content',
                'Content here',
                '',
                '## Exercises',
                'Exercise 1',
                '',
                '## Summary',
                'Key points',
            ].join('\n'),
        };

        const result = await generateLesson({
            topic: 'JavaScript Promises',
            audience: 'beginner developers',
            language: 'en',
            llm: mockLLM,
        });

        assert.ok(result.title);
        assert.ok(result.markdown);
        assert.ok(result.sections > 0);
        assert.strictEqual(result.title, 'Understanding JavaScript Promises');
    });

    it('works with Vietnamese language', async () => {
        const mockLLM = {
            chat: async () => [
                '# JavaScript Promises Cơ Bản',
                '',
                '## Mục tiêu bài học',
                '- Hiểu Promise',
                '',
                '## Nội dung',
                'Giải thích',
            ].join('\n'),
        };

        const result = await generateLesson({
            topic: 'JavaScript Promises',
            audience: 'người mới bắt đầu',
            language: 'vi',
            llm: mockLLM,
        });

        assert.ok(result.title);
        assert.ok(result.markdown);
    });

    it('includes specific objectives when provided', async () => {
        let capturedPrompt = '';
        const mockLLM = {
            chat: async (prompt) => {
                capturedPrompt = prompt;
                return '# Test\n\n## Section 1\nContent';
            },
        };

        await generateLesson({
            topic: 'React',
            audience: 'beginners',
            objectives: ['Understand components', 'Build a Todo app'],
            language: 'en',
            llm: mockLLM,
        });

        assert.ok(capturedPrompt.includes('Understand components'));
        assert.ok(capturedPrompt.includes('Build a Todo app'));
    });
});
