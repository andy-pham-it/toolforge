'use strict';

const { ToolInputError } = require('../lib/errors');
const { parseFrontmatter, extractVariables } = require('../lib/template-engine');
const { renderTemplate } = require('../lib/template-engine');
const getTemplateHandler = require('./get-template').handler;

const definition = {
    name: 'sdlc_render_template',
    description: 'Render a template with context variables. Supports {{ var }}, {% if %}, {% for %}, {% include %}. Returns rendered markdown.',
    inputSchema: {
        type: 'object',
        properties: {
            templateId: {
                type: 'string',
                description: 'Template identifier (e.g. "prd/agile-prd", "brd/ieee-29148")',
            },
            context: {
                type: 'object',
                description: 'Variables to inject into the template',
            },
        },
        required: ['templateId', 'context'],
    },
};

async function handler(_llm, args) {
    const { templateId, context } = args;
    if (!templateId) throw new ToolInputError('templateId is required');
    if (!context || typeof context !== 'object') throw new ToolInputError('context must be an object');

    const rawResult = await getTemplateHandler(_llm, { templateId });
    const rawContent = rawResult.content;

    const { frontmatter, body } = parseFrontmatter(rawContent);
    const renderedBody = renderTemplate(body, context);

    const renderedContent = frontmatter
        ? `---\n${require('js-yaml').dump(frontmatter).trim()}\n---\n\n${renderedBody}`
        : renderedBody;

    return {
        templateId,
        originalContent: rawContent,
        renderedContent,
        variables: extractVariables(rawContent),
    };
}

module.exports = { definition, handler };
