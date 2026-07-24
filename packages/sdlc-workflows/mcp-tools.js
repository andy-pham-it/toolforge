'use strict';

/**
 * @andy-toolforge/sdlc-workflows MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { checkManifest } = require('./lib/version-registry');
const { buildIndex, searchSkills } = require('./lib/skill-index');
const { renderTemplate, parseFrontmatter, extractVariables } = require('./lib/template-engine');
const pkg = require('./package.json');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const FLOWS_DIR = path.join(TEMPLATES_DIR, 'flows');
const STANDARDS_DIR = path.join(TEMPLATES_DIR, 'standards');
const SKILLS_DIR = path.join(__dirname, 'skills');

let _skillIndex = null;
function getSkillIndex() {
  if (!_skillIndex) _skillIndex = buildIndex(SKILLS_DIR);
  return _skillIndex;
}

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
            context: {
                type: 'object',
                description: 'Optional context variables for rendering. When provided, also returns renderedContent and variables.',
            },
        },
        required: ['templateId'],
    },
};

async function getTemplateHandler(_llm, args) {
    const { templateId, context } = args;
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

    const matches = globSync('**/*.md', { cwd: dir, nodir: true });
    for (const match of matches) {
        const parsed = path.parse(match);
        const templateId = match.slice(0, -3);
        const category = parsed.dir || '';
        results.push({ id: templateId, category, file: parsed.base });
    }
    return results;
}

async function listTemplatesHandler(_llm, args) {
    const { category } = args || {};
    const cat = category || 'all';  // default to 'all' when not specified

    const flows = cat === 'all' || cat === 'flows' ? scanMdFiles(FLOWS_DIR) : [];
    const standards = cat === 'all' || cat === 'standards' ? scanMdFiles(STANDARDS_DIR) : [];

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
// validate_document
// ---------------------------------------------------------------------------
const validateDocDef = {
    name: 'validate_document',
    description: 'Validate an SDLC document against a standard (agile, ieee-829, ieee-29148, arc42, iso-29119). Checks structure, required sections, YAML frontmatter, and cross-ref consistency.',
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

async function validateDocumentHandler(_llm, args) {
    const { documentPath, standard } = args;
    if (!documentPath || !standard) {
        throw new Error('documentPath and standard are required');
    }

    const resolvedPath = path.resolve(documentPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Document not found: ${documentPath}`);
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

    // 2. Check required sections per standard
    var standards = {
        'agile': ['## 1. Vision', '## 3. Problem Statement', '## 5. Features'],
        'ieee-29148': ['## 1. Purpose', '## 3. Stakeholders', '## 5. Functional Requirements'],
        'ieee-829': ['## 1. Test Plan Identifier', '## 3. Test Items', '## 5. Test Schedule'],
        'iso-29119': ['## 1. Purpose', '## 3. Test Strategy', '## 5. Test Completion Criteria'],
        'arc42': ['## 1. Introduction', '## 3. System Scope', '## 5. Building Block View'],
    };

    var requiredSections = standards[standard];
    if (requiredSections) {
        for (var i = 0; i < requiredSections.length; i++) {
            if (!content.includes(requiredSections[i])) {
                errors.push('Missing required section: ' + requiredSections[i]);
            }
        }
    } else {
        warnings.push('Unknown standard "' + standard + '" — skipping section validation');
    }

    // 3. Check [TBD]/TODO placeholders
    var tbdMatches = content.match(/\[TBD\]|TODO/g);
    if (tbdMatches) {
        warnings.push('Contains ' + tbdMatches.length + ' unresolved placeholder(s) ([TBD]/TODO)');
    }

    // 4. Structure health score
    var totalLines = content.split('\n').length;
    var sectionCount = (content.match(/^## /gm) || []).length;
    var structureHealth = errors.length === 0 ? 'good' : errors.length <= 2 ? 'fair' : 'poor';

    return {
        valid: errors.length === 0,
        errors: errors.length ? errors : undefined,
        warnings: warnings.length ? warnings : undefined,
        structureHealth: structureHealth,
        stats: { totalLines: totalLines, sectionCount: sectionCount },
    };
}

// ---------------------------------------------------------------------------
// sdlc_validate_skill
// ---------------------------------------------------------------------------
const validateSkillDef = {
    name: 'sdlc_validate_skill',
    description: 'Validate a skill file (SKILL.md) against a YAML test case. Checks structure, required sections, frontmatter, and generates a preview of expected output format.',
    inputSchema: {
        type: 'object',
        properties: {
            skillPath: {
                type: 'string',
                description: 'Path to the SKILL.md file to validate',
            },
            testCase: {
                type: 'string',
                description: 'Path to YAML test case file (or inline YAML string)',
            },
            mockInterview: {
                type: 'boolean',
                description: 'Use mock answers instead of calling LLM',
                default: false,
            },
        },
        required: ['skillPath', 'testCase'],
    },
};

async function validateSkillHandler(_llm, args) {
    var skillPath = args.skillPath;
    var testCase = args.testCase;
    var mockInterview = args.mockInterview;

    if (!skillPath || !testCase) {
        throw new Error('skillPath and testCase are required');
    }

    var resolvedSkill = path.resolve(skillPath);
    if (!fs.existsSync(resolvedSkill)) {
        throw new Error('Skill file not found: ' + skillPath);
    }

    var skillContent = fs.readFileSync(resolvedSkill, 'utf-8');
    var errors = [];
    var warnings = [];

    // 1. Check YAML frontmatter
    var fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) errors.push('SKILL.md missing YAML frontmatter');
    else {
        try {
            var fm = require('js-yaml').load(fmMatch[1]);
            if (!fm.id) errors.push('Frontmatter missing id');
            if (!fm.version) errors.push('Frontmatter missing version');
        } catch (e) {
            errors.push('Invalid YAML frontmatter: ' + e.message);
        }
    }

    // 2. Check required sections
    var requiredSections = [
        '## Mô tả', '## Kích hoạt', '## Input', '## Output',
        '## Workflow', '## MCP Tools Used', '## Cross-ref',
    ];
    for (var i = 0; i < requiredSections.length; i++) {
        if (!skillContent.includes(requiredSections[i])) {
            errors.push('SKILL.md missing required section: ' + requiredSections[i]);
        }
    }

    // 3. Check inline template fallback exists
    if (!skillContent.includes('## Template (inline fallback)') &&
        !skillContent.includes('**MCP detection:**')) {
        warnings.push('SKILL.md may be missing inline template fallback');
    }

    // 4. Parse test case
    var testData;
    var testPath = path.resolve(testCase);
    if (fs.existsSync(testPath)) {
        testData = require('js-yaml').load(fs.readFileSync(testPath, 'utf-8'));
    } else {
        try { testData = JSON.parse(testCase); }
        catch (e) { testData = require('js-yaml').load(testCase); }
    }

    return {
        name: (testData && testData.name) || 'unnamed',
        skillStructure: errors.length === 0 ? 'valid' : 'invalid',
        errors: errors.length ? errors : undefined,
        warnings: warnings.length ? warnings : undefined,
        preview: mockInterview ? {
            input: (testData && testData.input && testData.input.mockAnswers) || [],
            expectedSections: (testData && testData.expectedOutput && testData.expectedOutput.requiredSections) || [],
        } : undefined,
    };
}

// ---------------------------------------------------------------------------
// sdlc_check_version
// ---------------------------------------------------------------------------
const checkVersionDef = {
    name: 'sdlc_check_version',
    description: 'Check installed SDLC workflows version against package version. Detects drift (outdated manifest) and returns manifest details.',
    inputSchema: {
        type: 'object',
        properties: {
            manifestDir: {
                type: 'string',
                description: 'Path to .opencode/manifests/ directory (default: cwd/.opencode/manifests)',
            },
        },
    },
};

async function checkVersionHandler(_llm, args) {
    const cwd = process.cwd();
    const manifestDir = args.manifestDir || path.join(cwd, '.opencode', 'manifests');
    return checkManifest(manifestDir, pkg.version);
}

// ---------------------------------------------------------------------------
// sdlc_search_skills
// ---------------------------------------------------------------------------
const searchSkillsDef = {
    name: 'sdlc_search_skills',
    description: 'Search SDLC skills by keywords, triggers, or description. Returns matched skills with relevance scores.',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Natural language search query' },
            limit: { type: 'number', description: 'Max results (default: 10)', default: 10 },
        },
        required: ['query'],
    },
};

async function searchSkillsHandler(_llm, args) {
    const { query, limit } = args;
    if (!query) throw new Error('query is required');
    const index = getSkillIndex();
    const results = searchSkills(index, query, { limit: limit || 10 });
    return {
        query,
        totalResults: results.length,
        results: results.map(r => ({
            id: r.skill.id,
            name: r.skill.name,
            score: r.score,
            description: r.skill.description,
            triggers: r.skill.triggers,
        })),
    };
}

// ---------------------------------------------------------------------------
// sdlc_render_template
// ---------------------------------------------------------------------------
const renderTemplateDef = {
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

async function renderTemplateHandler(_llm, args) {
    const { templateId, context } = args;
    if (!templateId) throw new Error('templateId is required');
    if (!context || typeof context !== 'object') throw new Error('context must be an object');

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

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: getTemplateDef, handler: getTemplateHandler },
        { definition: listTemplatesDef, handler: listTemplatesHandler },
        { definition: getStandardDef, handler: getStandardHandler },
        { definition: validateDocDef, handler: validateDocumentHandler },
        { definition: validateSkillDef, handler: validateSkillHandler },
        { definition: checkVersionDef, handler: checkVersionHandler },
        { definition: searchSkillsDef, handler: searchSkillsHandler },
        { definition: renderTemplateDef, handler: renderTemplateHandler },
    ];
};
