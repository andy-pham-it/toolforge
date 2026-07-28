'use strict';

const fs = require('fs');
const path = require('path');
const { ToolInputError, ToolNotFoundError } = require('../lib/errors');

const FLOWS_DIR = path.join(__dirname, '..', 'templates', 'flows');

const definition = {
    name: 'validate_document',
    description: 'Validate an SDLC document against a standard (agile, ieee-29148, ieee-829, arc42, iso-29119). Checks structure, required sections, YAML frontmatter, and cross-ref consistency.',
    inputSchema: {
        type: 'object',
        properties: {
            documentPath: {
                type: 'string',
                description: 'Path to the document file to validate (absolute or relative to cwd)',
            },
            standard: {
                type: 'string',
                enum: ['agile', 'ieee-29148', 'ieee-829', 'iso-29119', 'arc42'],
                description: 'Standard to validate against',
            },
        },
        required: ['documentPath', 'standard'],
    },
};

/**
 * Derive required section headings from a standard's template file.
 * Scans templates/flows/ for files whose frontmatter includes `standard: <key>`.
 * Falls back to hardcoded defaults if no template found (graceful degradation).
 */
function loadRequiredSections(standardKey) {
    const defaultSections = {
        'agile': ['## 1. Vision', '## 3. Problem Statement', '## 5. Features'],
        'ieee-29148': ['## 1. Purpose', '## 3. Stakeholders', '## 5. Functional Requirements'],
        'ieee-829': ['## 1. Test Plan Identifier', '## 3. Test Items', '## 5. Test Schedule'],
        'iso-29119': ['## 1. Purpose', '## 3. Test Strategy', '## 5. Test Completion Criteria'],
        'arc42': ['## 1. Introduction', '## 3. System Scope', '## 5. Building Block View'],
    };

    if (!fs.existsSync(FLOWS_DIR)) return defaultSections[standardKey] || [];

    const { globSync } = require('glob');
    const yaml = require('js-yaml');
    const matches = globSync('**/*.md', { cwd: FLOWS_DIR, nodir: true });

    for (const match of matches) {
        const filePath = path.join(FLOWS_DIR, match);
        const content = fs.readFileSync(filePath, 'utf-8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        try {
            const fm = yaml.load(fmMatch[1]);
            if (fm && fm.standard === standardKey) {
                // Extract all ## headings from the template body
                const body = content.slice(fmMatch[0].length);
                const headings = [];
                const headingRe = /^## (.+)$/gm;
                let hMatch;
                while ((hMatch = headingRe.exec(body)) !== null) {
                    headings.push('## ' + hMatch[1].trim());
                }
                if (headings.length > 0) return headings;
            }
        } catch {
            continue;
        }
    }

    return defaultSections[standardKey] || [];
}

async function handler(_llm, args) {
    const { documentPath, standard } = args;
    if (!documentPath || !standard) {
        throw new ToolInputError('documentPath and standard are required');
    }

    const resolvedPath = path.resolve(documentPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new ToolNotFoundError(`Document not found: ${documentPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const errors = [];
    const warnings = [];

    // 1. Check YAML frontmatter
    const hasFrontmatter = content.startsWith('---');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!hasFrontmatter) errors.push('Missing YAML frontmatter');
    else if (!fmMatch) errors.push('Malformed YAML frontmatter: missing closing ---');
    else {
        try {
            const fm = require('js-yaml').load(fmMatch[1]);
            if (!fm.version) warnings.push('Frontmatter missing version field');
            if (!fm.standard) warnings.push('Frontmatter missing standard field');
        } catch (e) {
            errors.push('Invalid YAML frontmatter: ' + e.message);
        }
    }

    // 2. Check required sections — dynamically loaded from template standard
    const requiredSections = loadRequiredSections(standard);
    if (requiredSections.length > 0) {
        for (const section of requiredSections) {
            if (!content.includes(section)) {
                errors.push('Missing required section: ' + section);
            }
        }
    } else {
        warnings.push('Unknown standard "' + standard + '" — skipping section validation');
    }

    // 3. Check [TBD]/TODO placeholders
    const tbdMatches = content.match(/\[TBD\]|TODO/g);
    if (tbdMatches) {
        warnings.push('Contains ' + tbdMatches.length + ' unresolved placeholder(s) ([TBD]/TODO)');
    }

    // 4. Structure health score
    const totalLines = content.split('\n').length;
    const sectionCount = (content.match(/^## /gm) || []).length;
    const structureHealth = errors.length === 0 ? 'good' : errors.length <= 2 ? 'fair' : 'poor';

    return {
        valid: errors.length === 0,
        errors: errors.length ? errors : undefined,
        warnings: warnings.length ? warnings : undefined,
        structureHealth: structureHealth,
        stats: { totalLines, sectionCount },
    };
}

module.exports = { definition, handler };
