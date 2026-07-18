'use strict';

/**
 * @andy-toolforge/authoring MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 *
 * Tools:
 *   generate_lesson           — Generate a complete lesson plan via LLM
 *   scaffold_series           — Create series directory structure with outline
 *   embed_images_to_markdown  — Replace image placeholders with generated images
 *   validate_series           — Validate series structure, metadata, images, links
 */

const { generateLesson, scaffoldSeries, embedImagesToMarkdown, validateSeries } = require('./lib');

// ---------------------------------------------------------------------------
// generate_lesson
// ---------------------------------------------------------------------------
const generateLessonDef = {
    name: 'generate_lesson',
    description: 'Generate a complete lesson plan from topic and audience using LLM. Returns structured Markdown with objectives, sections, exercises, and summary.',
    inputSchema: {
        type: 'object',
        properties: {
            topic: { type: 'string', description: 'Lesson topic (e.g. "JavaScript Promises")' },
            audience: { type: 'string', description: 'Target audience (e.g. "beginner developers")' },
            objectives: {
                type: 'array', items: { type: 'string' },
                description: 'Optional specific learning objectives',
            },
            language: { type: 'string', description: 'Output language (vi or en, default vi)', default: 'vi' },
        },
        required: ['topic', 'audience'],
    },
};

async function generateLessonHandler(_llm, args) {
    const { topic, audience, objectives, language } = args;
    return await generateLesson({ topic, audience, objectives, language });
}

// ---------------------------------------------------------------------------
// scaffold_series
// ---------------------------------------------------------------------------
const scaffoldSeriesDef = {
    name: 'scaffold_series',
    description: 'Create a series directory with table of contents and lesson scaffolds. Generates 00-muc-luc.md, numbered lesson files, and images/ directory.',
    inputSchema: {
        type: 'object',
        properties: {
            topic: { type: 'string', description: 'Series topic (e.g. "Python for Data Science")' },
            outputDir: { type: 'string', description: 'Parent directory to create the series in' },
            lessonCount: { type: 'number', description: 'Number of lessons (default 5)', default: 5 },
            language: { type: 'string', description: 'Language (vi or en, default vi)', default: 'vi' },
        },
        required: ['topic', 'outputDir'],
    },
};

async function scaffoldSeriesHandler(_llm, args) {
    const { topic, outputDir, lessonCount, language } = args;
    return await scaffoldSeries({ topic, outputDir, lessonCount, language });
}

// ---------------------------------------------------------------------------
// embed_images_to_markdown
// ---------------------------------------------------------------------------
const embedImagesDef = {
    name: 'embed_images_to_markdown',
    description: 'Replace image placeholders (![alt](placeholder:description)) in markdown with actual generated images using Gemini Images API.',
    inputSchema: {
        type: 'object',
        properties: {
            markdown: { type: 'string', description: 'Markdown content with image placeholders' },
            outputDir: { type: 'string', description: 'Directory to save generated images (default: ./images)' },
        },
        required: ['markdown'],
    },
};

async function embedImagesHandler(_llm, args) {
    const { markdown, outputDir } = args;
    return await embedImagesToMarkdown({ markdown, outputDir });
}

// ---------------------------------------------------------------------------
// validate_series
// ---------------------------------------------------------------------------
const validateSeriesDef = {
    name: 'validate_series',
    description: 'Validate a series directory — checks metadata, file structure, image references, internal links, and reports errors/warnings/stats.',
    inputSchema: {
        type: 'object',
        properties: {
            seriesDir: { type: 'string', description: 'Path to the series directory to validate' },
        },
        required: ['seriesDir'],
    },
};

async function validateSeriesHandler(_llm, args) {
    const { seriesDir } = args;
    return await validateSeries({ seriesDir });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: generateLessonDef, handler: generateLessonHandler },
        { definition: scaffoldSeriesDef, handler: scaffoldSeriesHandler },
        { definition: embedImagesDef, handler: embedImagesHandler },
        { definition: validateSeriesDef, handler: validateSeriesHandler },
    ];
};
