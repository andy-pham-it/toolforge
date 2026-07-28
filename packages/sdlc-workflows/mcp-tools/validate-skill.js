'use strict';

const fs = require('fs');
const path = require('path');
const { ToolInputError, ToolNotFoundError } = require('../lib/errors');

const definition = {
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

async function handler(_llm, args) {
    const { skillPath, testCase, mockInterview } = args;

    if (!skillPath || !testCase) {
        throw new ToolInputError('skillPath and testCase are required');
    }

    const resolvedSkill = path.resolve(skillPath);
    if (!fs.existsSync(resolvedSkill)) {
        throw new ToolNotFoundError('Skill file not found: ' + skillPath);
    }

    const skillContent = fs.readFileSync(resolvedSkill, 'utf-8');
    const errors = [];
    const warnings = [];

    // 1. Check YAML frontmatter
    const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) errors.push('SKILL.md missing YAML frontmatter');
    else {
        try {
            const fm = require('js-yaml').load(fmMatch[1]);
            if (!fm.id) errors.push('Frontmatter missing id');
            if (!fm.version) errors.push('Frontmatter missing version');
        } catch (e) {
            errors.push('Invalid YAML frontmatter: ' + e.message);
        }
    }

    // 2. Check required sections
    const requiredSections = [
        '## Mô tả', '## Kích hoạt', '## Input', '## Output',
        '## Workflow', '## MCP Tools Used', '## Cross-ref',
    ];
    for (const section of requiredSections) {
        if (!skillContent.includes(section)) {
            errors.push('SKILL.md missing required section: ' + section);
        }
    }

    // 3. Check inline template fallback exists
    if (!skillContent.includes('## Template (inline fallback)') &&
        !skillContent.includes('**MCP detection:**')) {
        warnings.push('SKILL.md may be missing inline template fallback');
    }

    // 4. Parse test case
    let testData;
    const testPath = path.resolve(testCase);
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

module.exports = { definition, handler };
