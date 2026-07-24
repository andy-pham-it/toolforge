'use strict';

/**
 * @andy-toolforge/sdlc-workflows MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 *
 * Tools:
 *   sdlc_get_template      — Read a template file by ID
 *   sdlc_list_templates    — List available templates
 *   sdlc_get_standard      — Read a standard/reference file by ID
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const FLOWS_DIR = path.join(TEMPLATES_DIR, 'flows');
const STANDARDS_DIR = path.join(TEMPLATES_DIR, 'standards');

// ---------------------------------------------------------------------------
// sdlc_get_template
// ---------------------------------------------------------------------------
const getTemplateDef = {
    name: 'sdlc_get_template',
    description: 'Read a template file by ID (e.g. "prd/agile-prd", "deploy/itil-runbook"). Returns the full markdown template content.',
    inputSchema: {
        type: 'object',
        properties: {
            templateId: {
                type: 'string',
                description: 'Template identifier — maps to templates/flows/<templateId>.md (e.g. "prd/agile-prd")',
            },
        },
        required: ['templateId'],
    },
};

async function getTemplateHandler(_llm, args) {
    const { templateId } = args;
    if (!templateId || typeof templateId !== 'string') {
        throw new Error('templateId is required and must be a string');
    }

    // Resolve: try templates/flows/<id>.md first, then templates/<id>.md
    const candidates = [
        path.join(FLOWS_DIR, templateId + '.md'),
        path.join(TEMPLATES_DIR, templateId + '.md'),
    ];

    for (const filePath of candidates) {
        // Security: ensure resolved path stays within TEMPLATES_DIR
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(TEMPLATES_DIR)) {
            throw new Error('Invalid templateId: path traversal detected');
        }
        if (fs.existsSync(resolved)) {
            return { content: fs.readFileSync(resolved, 'utf-8'), path: path.relative(TEMPLATES_DIR, resolved) };
        }
    }

    throw new Error(`Template "${templateId}" not found. Use sdlc_list_templates to see available templates.`);
}

// ---------------------------------------------------------------------------
// sdlc_list_templates
// ---------------------------------------------------------------------------
const listTemplatesDef = {
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

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const subDir = entry.name;
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const sub of subEntries) {
                if (sub.isFile() && sub.name.endsWith('.md')) {
                    const templateId = subDir + '/' + sub.name.slice(0, -3);
                    results.push({ id: templateId, category: subDir, file: sub.name });
                }
            }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const templateId = entry.name.slice(0, -3);
            results.push({ id: templateId, category: '', file: entry.name });
        }
    }
    return results;
}

async function listTemplatesHandler(_llm, args) {
    const { category } = args || {};

    const flows = category === 'all' || category === 'flows' ? scanMdFiles(FLOWS_DIR) : [];
    const standards = category === 'all' || category === 'standards' ? scanMdFiles(STANDARDS_DIR) : [];

    return {
        templates: { flows, standards },
        totalCount: flows.length + standards.length,
    };
}

// ---------------------------------------------------------------------------
// sdlc_get_standard
// ---------------------------------------------------------------------------
const getStandardDef = {
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

async function getStandardHandler(_llm, args) {
    const { standardId } = args;
    if (!standardId || typeof standardId !== 'string') {
        throw new Error('standardId is required and must be a string');
    }

    const filePath = path.resolve(STANDARDS_DIR, standardId + '.md');
    if (!filePath.startsWith(STANDARDS_DIR)) {
        throw new Error('Invalid standardId: path traversal detected');
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Standard "${standardId}" not found. Use sdlc_list_templates to see available standards.`);
    }

    return { content: fs.readFileSync(filePath, 'utf-8'), path: path.relative(STANDARDS_DIR, filePath) };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: getTemplateDef, handler: getTemplateHandler },
        { definition: listTemplatesDef, handler: listTemplatesHandler },
        { definition: getStandardDef, handler: getStandardHandler },
    ];
};
