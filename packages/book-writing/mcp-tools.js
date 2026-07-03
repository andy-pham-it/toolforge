/**
 * @andy-toolforge/book-writing MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 */

const outlineDefinition = {
    name: 'toolforge_book_outline',
    description: 'Generate a detailed book outline from a topic with chapter descriptions and key points',
    inputSchema: {
        type: 'object',
        properties: {
            topic: { type: 'string', description: 'Book topic or title' },
            chapters: { type: 'number', description: 'Number of chapters (1-50)', default: 5 },
        },
        required: ['topic'],
    },
};

const writeDefinition = {
    name: 'toolforge_book_write_chapter',
    description: 'Write a book chapter based on an outline, with optional previous content for continuity',
    inputSchema: {
        type: 'object',
        properties: {
            outline: {
                type: 'object',
                description: 'Book outline object (from toolforge_book_outline)',
            },
            chapterIndex: { type: 'number', description: '1-based chapter index to write' },
            previousContent: { type: 'string', description: 'Previous chapter content for continuity', default: '' },
        },
        required: ['outline', 'chapterIndex'],
    },
};

const reviewDefinition = {
    name: 'toolforge_book_review',
    description: 'Review a manuscript for consistency, contradictions, repetition, tone, and logic gaps',
    inputSchema: {
        type: 'object',
        properties: {
            manuscript: {
                type: 'object',
                description: 'Manuscript object with title and chapters array (each chapter has title + content)',
            },
        },
        required: ['manuscript'],
    },
};

const exportDefinition = {
    name: 'toolforge_book_export',
    description: 'Export a manuscript to markdown, plain text, or HTML format',
    inputSchema: {
        type: 'object',
        properties: {
            manuscript: {
                type: 'object',
                description: 'Manuscript object with title and chapters array',
            },
            format: {
                type: 'string',
                enum: ['markdown', 'plain', 'html'],
                description: 'Export format',
                default: 'markdown',
            },
        },
        required: ['manuscript'],
    },
};

async function outlineHandler(llm, args) {
    const { topic, chapters } = args;
    const { BookWriter } = require('./lib/writer');
    const writer = new BookWriter({ llmClient: llm });
    return writer.generateOutline(topic, chapters || 5);
}

async function writeHandler(llm, args) {
    const { outline, chapterIndex, previousContent } = args;
    const { BookWriter } = require('./lib/writer');
    const writer = new BookWriter({ llmClient: llm });
    return writer.writeChapter(outline, chapterIndex, previousContent || '');
}

async function reviewHandler(llm, args) {
    const { manuscript } = args;
    const { BookWriter } = require('./lib/writer');
    const writer = new BookWriter({ llmClient: llm });
    return writer.reviewConsistency(manuscript);
}

async function exportHandler(llm, args) {
    const { manuscript, format } = args;
    const { BookWriter } = require('./lib/writer');
    const writer = new BookWriter({ llmClient: llm });
    return writer.exportFormat(manuscript, format || 'markdown');
}

module.exports = function () {
    return [
        { definition: outlineDefinition, handler: outlineHandler },
        { definition: writeDefinition, handler: writeHandler },
        { definition: reviewDefinition, handler: reviewHandler },
        { definition: exportDefinition, handler: exportHandler },
    ];
};
