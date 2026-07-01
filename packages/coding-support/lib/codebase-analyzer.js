/**
 * CodebaseAnalyzer — Static code analysis for JS/TS projects.
 *
 * Counts lines, finds dead code, generates dependency graphs,
 * and reports complexity metrics. Uses CommonJS conventions.
 */
const fs = require('fs');
const path = require('path');
const { Logger } = require('@andy-toolforge/core');

class CodebaseAnalyzer {
    constructor(config = {}) {
        this.logger = config.logger || new Logger('CodebaseAnalyzer');
        this.rootDir = config.rootDir || process.cwd();
    }

    /**
     * Count lines in files matching glob patterns.
     * @param {string|string[]} patterns - Glob pattern(s) to match (e.g. all ".js" files under "lib/")
     * @returns {Promise<object>} Line count summary
     */
    async countLines(patterns) {
        if (!patterns || (Array.isArray(patterns) && patterns.length === 0)) {
            throw new Error('At least one file pattern is required');
        }

        const normalized = Array.isArray(patterns) ? patterns : [patterns];
        const { globSync } = await importFastGlob();
        const files = [];

        for (const pattern of normalized) {
            const matched = globSync(pattern, { cwd: this.rootDir, nodir: true });
            files.push(...matched.map(f => path.resolve(this.rootDir, f)));
        }

        if (files.length === 0) {
            return { files: 0, totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0, byFile: [] };
        }

        const byFile = files.map(filePath => this._analyzeFile(filePath));

        const summary = {
            files: byFile.length,
            totalLines: byFile.reduce((s, f) => s + f.totalLines, 0),
            codeLines: byFile.reduce((s, f) => s + f.codeLines, 0),
            commentLines: byFile.reduce((s, f) => s + f.commentLines, 0),
            blankLines: byFile.reduce((s, f) => s + f.blankLines, 0),
            byFile,
        };

        this.logger.info(`countLines: ${summary.files} files, ${summary.codeLines} code lines`);
        return summary;
    }

    /**
     * Find exports that no entry point transitively requires.
     * Handles both `module.exports.X = ...` and `module.exports = { X }` patterns.
     * @param {string|string[]} entryPoints - Entry file paths
     * @returns {Promise<Array<object>>} List of potentially dead exports
     */
    async findDeadCode(entryPoints) {
        const normalized = Array.isArray(entryPoints) ? entryPoints : [entryPoints];
        const entryAbs = normalized.map(e => path.resolve(this.rootDir, e));

        // 1. Scan all JS files for exports
        const { globSync } = await importFastGlob();
        const allJsFiles = globSync('**/*.js', {
            cwd: this.rootDir,
            nodir: true,
            ignore: ['node_modules/**'],
        }).map(f => path.resolve(this.rootDir, f));

        const exportMap = new Map(); // filePath -> [{ name, type }]

        for (const file of allJsFiles) {
            const exports = this._findExports(file);
            if (exports.length > 0) {
                exportMap.set(file, exports);
            }
        }

        // 2. Find all transitively required files from entry points
        const required = new Set();
        const queue = [...entryAbs];

        while (queue.length > 0) {
            const current = queue.shift();
            if (required.has(current)) continue;
            required.add(current);

            const deps = this._findRequires(current);
            for (const dep of deps) {
                const resolved = this._resolvePath(current, dep);
                if (resolved && !required.has(resolved)) {
                    queue.push(resolved);
                }
            }
        }

        // 3. Report exports NOT in the required set
        const dead = [];
        for (const [filePath, exports] of exportMap.entries()) {
            if (!required.has(filePath)) {
                // Entire file is unreachable
                dead.push({
                    file: path.relative(this.rootDir, filePath),
                    exports: exports.map(e => e.name),
                    reason: 'File is not required by any entry point',
                });
            }
        }

        this.logger.info(`findDeadCode: found ${dead.length} potentially dead file(s)`);
        return dead;
    }

    /**
     * Generate a dependency graph of all JS files (local requires only).
     * @returns {Promise<object>} Graph with nodes and edges
     */
    async generateDependencyGraph() {
        const { globSync } = await importFastGlob();
        const allJsFiles = globSync('**/*.js', {
            cwd: this.rootDir,
            nodir: true,
            ignore: ['node_modules/**'],
        });

        const nodes = [];
        const edges = [];
        const fileIndex = new Map(); // absPath -> nodeId

        for (const file of allJsFiles) {
            const absPath = path.resolve(this.rootDir, file);
            const nodeId = nodes.length;
            const name = path.relative(this.rootDir, absPath);
            nodes.push({ id: nodeId, path: name, name: path.basename(name) });
            fileIndex.set(absPath, nodeId);
        }

        for (const file of allJsFiles) {
            const absPath = path.resolve(this.rootDir, file);
            const fromId = fileIndex.get(absPath);
            if (fromId === undefined) continue;

            const requires = this._findRequires(absPath);
            for (const dep of requires) {
                const resolved = this._resolvePath(absPath, dep);
                if (resolved && fileIndex.has(resolved)) {
                    edges.push({
                        from: fromId,
                        to: fileIndex.get(resolved),
                        source: dep,
                    });
                }
            }
        }

        this.logger.info(`generateDependencyGraph: ${nodes.length} nodes, ${edges.length} edges`);
        return { nodes, edges };
    }

    /**
     * Generate a complexity report for given files.
     * Measures: LOC, function count, decision points, max nesting depth.
     * @param {string|string[]} files - File paths to analyze
     * @returns {Promise<object>} Complexity report
     */
    async complexityReport(files) {
        const normalized = Array.isArray(files) ? files : [files];

        const results = normalized.map(file => {
            const absPath = path.resolve(this.rootDir, file);
            const content = fs.readFileSync(absPath, 'utf-8');
            const lines = content.split('\n');

            const lineInfo = this._analyzeFile(absPath);
            const functions = this._countFunctions(content);
            const decisions = this._countDecisions(content);
            const maxNesting = this._maxNesting(lines);
            const maxLineLength = Math.max(...lines.map(l => l.length));

            return {
                file: path.relative(this.rootDir, absPath),
                totalLines: lineInfo.totalLines,
                codeLines: lineInfo.codeLines,
                commentLines: lineInfo.commentLines,
                blankLines: lineInfo.blankLines,
                functions,
                decisions,
                maxNestingDepth: maxNesting,
                maxLineLength,
            };
        });

        this.logger.info(`complexityReport: analyzed ${results.length} file(s)`);
        return results;
    }

    // ---- Private helpers ----

    /** Analyze a single file for line counts */
    _analyzeFile(filePath) {
        let totalLines = 0;
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        let inBlockComment = false;

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            totalLines = lines.length;

            for (const line of lines) {
                const trimmed = line.trim();

                if (trimmed === '') {
                    blankLines++;
                    continue;
                }

                if (inBlockComment) {
                    commentLines++;
                    if (trimmed.includes('*/')) inBlockComment = false;
                    continue;
                }

                if (trimmed.startsWith('//')) {
                    commentLines++;
                    continue;
                }

                if (trimmed.startsWith('/*')) {
                    commentLines++;
                    if (!trimmed.includes('*/')) {
                        inBlockComment = true;
                    }
                    continue;
                }

                // Count multi-line block comment start mid-line
                const blockStart = trimmed.indexOf('/*');
                if (blockStart !== -1) {
                    if (trimmed.indexOf('*/', blockStart + 2) === -1) {
                        inBlockComment = true;
                        commentLines++;
                        continue;
                    }
                }

                codeLines++;
            }
        } catch {
            // File doesn't exist or can't be read — return zeros
        }

        return { totalLines, codeLines, commentLines, blankLines };
    }

    /** Find all `module.exports.X` and `module.exports = { X }` patterns */
    _findExports(filePath) {
        const exports = [];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');

            // pattern: module.exports.X = ...
            const namedRe = /module\.exports\.(\w+)\s*=/g;
            let match;
            while ((match = namedRe.exec(content)) !== null) {
                exports.push({ name: match[1], type: 'named' });
            }

            // pattern: module.exports = { X, Y }
            const objRe = /module\.exports\s*=\s*\{([^}]*)\}/g;
            while ((match = objRe.exec(content)) !== null) {
                const inner = match[1];
                const items = inner.split(',');
                for (const item of items) {
                    const trimmed = item.trim();
                    if (trimmed && !trimmed.startsWith('...')) {
                        // Handle `X: Y` or just `X` or `X as Y`
                        const name = trimmed.split(':')[0].trim().split(/\s+as\s+/)[0].trim();
                        if (name) exports.push({ name, type: 'named' });
                    }
                }
            }
        } catch {
            // ignore unreadable files
        }
        return exports;
    }

    /** Find all `require('...')` calls in a file */
    _findRequires(filePath) {
        const deps = [];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const re = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            let match;
            while ((match = re.exec(content)) !== null) {
                deps.push(match[1]);
            }
        } catch {
            // ignore
        }
        return deps;
    }

    /** Try to resolve a relative require to an absolute path */
    _resolvePath(fromFile, dep) {
        if (!dep.startsWith('.')) return null; // not a local dep

        const fromDir = path.dirname(fromFile);
        const resolved = path.resolve(fromDir, dep);

        // Try .js extension
        for (const ext of ['', '.js']) {
            const withExt = resolved + ext;
            if (fs.existsSync(withExt)) return withExt;
        }

        // Try index.js in directory
        const index = path.join(resolved, 'index.js');
        if (fs.existsSync(index)) return index;

        return null;
    }

    /** Count function declarations and expressions */
    _countFunctions(content) {
        const patterns = [
            /function\s+\w+\s*\(/g,       // function name() {}
            /function\s*\(/g,              // function() {} (anonymous)
            /=>\s*\{/g,                    // () => { }
            /=>[^\{]*$/gm,                 // () => expr (arrow with implicit return)
            /(\w+)\s*:\s*function\s*\(/g,  // method: function() {}
        ];

        let count = 0;
        for (const re of patterns) {
            const matches = content.match(re);
            if (matches) count += matches.length;
        }

        return count;
    }

    /** Count decision points (cyclomatic complexity factors) */
    _countDecisions(content) {
        const patterns = [
            /\bif\s*\(/g,
            /\belse\s+if\s*\(/g,
            /\bswitch\s*\(/g,
            /\bcase\s+/g,
            /\bfor\s*\(/g,
            /\bwhile\s*\(/g,
            /\bcatch\s*\(/g,
            /\b ternary \s*\?/g,   // Will be handled differently
            /\?\s*[^:]+:/g,         // ternary ?
            /&&/g,                  // logical AND
            /\|\|/g,                // logical OR
        ];

        let count = 0;
        for (const re of patterns) {
            const matches = content.match(re);
            if (matches) count += matches.length;
        }

        return count;
    }

    /** Estimate max nesting depth from indentation */
    _maxNesting(lines) {
        let maxDepth = 0;
        let currentDepth = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Decrease depth for closing braces
            const closeCount = (trimmed.match(/\}/g) || []).length;
            currentDepth -= closeCount;
            if (currentDepth < 0) currentDepth = 0;

            // Track max
            if (currentDepth > maxDepth) maxDepth = currentDepth;

            // Increase depth for opening braces (but not empty blocks)
            const stripped = trimmed.replace(/\{[^}]*\}/g, ''); // remove inline blocks
            const openCount = (stripped.match(/\{/g) || []).length;
            currentDepth += openCount;
        }

        return maxDepth;
    }
}

/**
 * Dynamic import for fast-glob (ESM → CJS bridge).
 * Falls back to a simple fs.readdirSync-based walker if unavailable.
 */
async function importFastGlob() {
    try {
        const fg = await import('fast-glob');
        return { globSync: fg.globSync || fg.default?.globSync || fg.sync || fg.default?.sync || (() => []) };
    } catch {
        // Fallback: simple directory walker (no glob patterns)
        return { globSync: (pattern, opts) => simpleGlobFallback(pattern, opts) };
    }
}

function simpleGlobFallback(pattern, opts = {}) {
    const cwd = opts.cwd || process.cwd();
    const results = [];

    function walk(dir) {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch { return; }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    walk(fullPath);
                }
            } else if (entry.isFile()) {
                results.push(path.relative(cwd, fullPath));
            }
        }
    }

    walk(cwd);
    return results;
}

module.exports = CodebaseAnalyzer;
