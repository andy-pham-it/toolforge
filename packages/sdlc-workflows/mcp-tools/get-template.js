'use strict';

const fs = require('fs');
const path = require('path');
const { ToolInputError } = require('../lib/errors');
const { parseFrontmatter, extractVariables } = require('../lib/template-engine');
const { renderTemplate } = require('../lib/template-engine');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const FLOWS_DIR = path.join(TEMPLATES_DIR, 'flows');

const definition = {
    name: 'sdlc_get_template',
    description: 'Read a template file by ID (e.g. "prd/agile-prd", "deploy/itil-runbook"). Returns the full markdown template content.',
    inputSchema: {
        type: 'object',
        properties: {
            templateId: {
                type: 'string',
                description: 'Template identifier — maps to templates/flows/<templateId>.md (e.g. "prd/agile-prd")',
            },
            context: {
                type: 'object',
                description: 'Optional context variables for rendering. When provided, also returns renderedContent and variables.',
            },
        },
        required: ['templateId'],
    },
};

async function handler(_llm, args) {
    const { templateId, context } = args;
    if (!templateId || typeof templateId !== 'string') {
        throw new ToolInputError('templateId is required and must be a string');
    }

    const candidates = [
        path.join(FLOWS_DIR, templateId + '.md'),
        path.join(TEMPLATES_DIR, templateId + '.md'),
    ];

    for (const filePath of candidates) {
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(TEMPLATES_DIR)) {
            throw new ToolInputError('Invalid templateId: path traversal detected');
        }
        if (fs.existsSync(resolved)) {
            const content = fs.readFileSync(resolved, 'utf-8');
            const result = { content, path: path.relative(TEMPLATES_DIR, resolved) };

            if (context && typeof context === 'object') {
                const { frontmatter, body } = parseFrontmatter(content);
                const renderedBody = renderTemplate(body, context);
                result.renderedContent = frontmatter
                    ? `---\n${require('js-yaml').dump(frontmatter).trim()}\n---\n\n${renderedBody}`
                    : renderedBody;
                result.variables = extractVariables(content);
            }

            return result;
        }
    }

    throw new ToolInputError(`Template "${templateId}" not found. Use sdlc_list_templates to see available templates.`);
}

module.exports = { definition, handler };
