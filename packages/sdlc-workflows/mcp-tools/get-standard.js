'use strict';

const fs = require('fs');
const path = require('path');
const { ToolInputError, ToolNotFoundError } = require('../lib/errors');

const STANDARDS_DIR = path.join(__dirname, '..', 'templates', 'standards');

const definition = {
    name: 'sdlc_get_standard',
    description: 'Read a standard/reference file by ID (e.g. "agile-scrum", "itil-sre"). Returns the full markdown reference content.',
    inputSchema: {
        type: 'object',
        properties: {
            standardId: {
                type: 'string',
                description: 'Standard identifier — maps to templates/standards/<standardId>.md (e.g. "agile-scrum")',
            },
        },
        required: ['standardId'],
    },
};

async function handler(_llm, args) {
    const { standardId } = args;
    if (!standardId || typeof standardId !== 'string') {
        throw new ToolInputError('standardId is required and must be a string');
    }

    const filePath = path.resolve(STANDARDS_DIR, standardId + '.md');
    if (!filePath.startsWith(STANDARDS_DIR)) {
        throw new ToolInputError('Invalid standardId: path traversal detected');
    }
    if (!fs.existsSync(filePath)) {
        throw new ToolNotFoundError(`Standard "${standardId}" not found. Use sdlc_list_templates to see available standards.`);
    }

    return { content: fs.readFileSync(filePath, 'utf-8'), path: path.relative(STANDARDS_DIR, filePath) };
}

module.exports = { definition, handler };
