'use strict';

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const FLOWS_DIR = path.join(TEMPLATES_DIR, 'flows');
const STANDARDS_DIR = path.join(TEMPLATES_DIR, 'standards');

const definition = {
    name: 'sdlc_list_templates',
    description: 'List all available templates and standards grouped by category. Returns structured info with IDs and descriptions.',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: ['flows', 'standards', 'all'],
                description: 'Filter by category (default: all)',
                default: 'all',
            },
        },
    },
};

function scanMdFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const matches = globSync('**/*.md', { cwd: dir, nodir: true });
    for (const match of matches) {
        const parsed = path.parse(match);
        const templateId = match.slice(0, -3);
        results.push({ id: templateId, category: parsed.dir || '', file: parsed.base });
    }
    return results;
}

async function handler(_llm, args) {
    const cat = (args && args.category) || 'all';
    const flows = (cat === 'all' || cat === 'flows') ? scanMdFiles(FLOWS_DIR) : [];
    const standards = (cat === 'all' || cat === 'standards') ? scanMdFiles(STANDARDS_DIR) : [];
    return {
        templates: { flows, standards },
        totalCount: flows.length + standards.length,
    };
}

module.exports = { definition, handler };
