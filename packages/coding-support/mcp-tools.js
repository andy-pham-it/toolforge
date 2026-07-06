/**
 * @andy-toolforge/coding-support MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 *
 * Provides code analysis tools: line counting, dead code detection,
 * dependency graphs, and complexity reports.
 */

const { CodebaseAnalyzer } = require('@andy-toolforge/coding-support');

// ---------------------------------------------------------------------------
// codebase_line_counts
// ---------------------------------------------------------------------------
const countLinesDef = {
    name: 'codebase_line_counts',
    description: 'Count lines of code in files matching a glob pattern',
    inputSchema: {
        type: 'object',
        properties: {
            patterns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob pattern(s) to match files (e.g. ["lib/**/*.js"])',
            },
            rootDir: {
                type: 'string',
                description: 'Root directory for glob resolution (defaults to cwd)',
            },
        },
        required: ['patterns'],
    },
};

async function countLinesHandler(_llm, args) {
    const { patterns, rootDir } = args;
    const analyzer = new CodebaseAnalyzer(rootDir ? { rootDir } : {});
    return analyzer.countLines(patterns);
}

// ---------------------------------------------------------------------------
// codebase_dead_code
// ---------------------------------------------------------------------------
const deadCodeDef = {
    name: 'codebase_dead_code',
    description: 'Find potentially dead exports — modules not required from entry points',
    inputSchema: {
        type: 'object',
        properties: {
            entryPoints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Entry file path(s) to scan from',
            },
            rootDir: {
                type: 'string',
                description: 'Root directory (defaults to cwd)',
            },
        },
        required: ['entryPoints'],
    },
};

async function deadCodeHandler(_llm, args) {
    const { entryPoints, rootDir } = args;
    const analyzer = new CodebaseAnalyzer(rootDir ? { rootDir } : {});
    return analyzer.findDeadCode(entryPoints);
}

// ---------------------------------------------------------------------------
// codebase_dependency_graph
// ---------------------------------------------------------------------------
const depGraphDef = {
    name: 'codebase_dependency_graph',
    description: 'Generate a dependency graph of all JS files in the project',
    inputSchema: {
        type: 'object',
        properties: {
            rootDir: {
                type: 'string',
                description: 'Root directory (defaults to cwd)',
            },
        },
    },
};

async function depGraphHandler(_llm, args) {
    const { rootDir } = args;
    const analyzer = new CodebaseAnalyzer(rootDir ? { rootDir } : {});
    return analyzer.generateDependencyGraph();
}

// ---------------------------------------------------------------------------
// codebase_complexity
// ---------------------------------------------------------------------------
const complexityDef = {
    name: 'codebase_complexity',
    description: 'Generate a complexity report for specific files',
    inputSchema: {
        type: 'object',
        properties: {
            files: {
                type: 'array',
                items: { type: 'string' },
                description: 'File path(s) to analyze',
            },
            rootDir: {
                type: 'string',
                description: 'Root directory (defaults to cwd)',
            },
        },
        required: ['files'],
    },
};

async function complexityHandler(_llm, args) {
    const { files, rootDir } = args;
    const analyzer = new CodebaseAnalyzer(rootDir ? { rootDir } : {});
    return analyzer.complexityReport(files);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: countLinesDef, handler: countLinesHandler },
        { definition: deadCodeDef, handler: deadCodeHandler },
        { definition: depGraphDef, handler: depGraphHandler },
        { definition: complexityDef, handler: complexityHandler },
    ];
};
