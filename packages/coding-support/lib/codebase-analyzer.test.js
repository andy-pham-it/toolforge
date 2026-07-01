const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CodebaseAnalyzer = require('./codebase-analyzer');

function makeMockLogger() {
    return { info: () => {}, warn: () => {}, error: () => {} };
}

describe('CodebaseAnalyzer', async () => {
    describe('countLines', async () => {
        const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: __dirname });

        await it('should return zero summary when no files match', async () => {
            const result = await analyzer.countLines('__nonexistent_glob_match__');
            assert.equal(result.files, 0);
            assert.equal(result.totalLines, 0);
        });

        await it('should reject empty patterns', async () => {
            await assert.rejects(
                () => analyzer.countLines([]),
                { message: 'At least one file pattern is required' },
            );
        });

        await it('should return results for the analyzer file itself', async () => {
            const result = await analyzer.countLines('codebase-analyzer.js');
            assert.ok(result.files >= 1);
            assert.ok(result.totalLines > 100);
            assert.ok(result.codeLines > 80);
            assert.ok(result.byFile.length >= 1);
        });

        await it('should count comments and blanks correctly on known content', async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-test-'));
            const testFile = path.join(tmpDir, 'test-stats.js');
            fs.writeFileSync(testFile, [
                '// this is a comment',
                '',
                'const x = 1;',
                '/* block comment */',
                'const y = 2;',
                '',
                '/**',
                ' * JSDoc block',
                ' */',
                'function foo() { return x + y; }',
                '',
            ].join('\n'));

            const local = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: tmpDir });
            const result = await local.countLines('test-stats.js');

            assert.equal(result.files, 1);
            assert.equal(result.totalLines, 11);
            assert.equal(result.codeLines, 3);
            assert.equal(result.commentLines, 5);
            assert.equal(result.blankLines, 3);

            fs.rmSync(tmpDir, { recursive: true, force: true });
        });
    });

    describe('findDeadCode', async () => {
        let tmpDir;

        before(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-dead-'));
            // Entry point
            fs.writeFileSync(path.join(tmpDir, 'index.js'), [
                "const { alive } = require('./alive');",
                "const helper = require('./helper');",
                'alive();',
                'helper.run();',
            ].join('\n'));

            // Alive module
            fs.writeFileSync(path.join(tmpDir, 'alive.js'), [
                'module.exports.alive = function() { return 1; };',
                'module.exports.alsoUsed = function() { return 2; };',
            ].join('\n'));

            // Helper — transitively required
            fs.writeFileSync(path.join(tmpDir, 'helper.js'), [
                'module.exports.run = function() { return 3; };',
            ].join('\n'));

            // Dead module — not required by any entry
            fs.writeFileSync(path.join(tmpDir, 'dead.js'), [
                'module.exports.deadFunc = function() { return 0; };',
                'module.exports.anotherDead = function() { return -1; };',
            ].join('\n'));

            // Dead module — also not required
            fs.writeFileSync(path.join(tmpDir, 'also-dead.js'), [
                'const x = 1;',
                'module.exports = { x };',
            ].join('\n'));
        });

        after(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        await it('should find files that are not required', async () => {
            const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: tmpDir });
            const dead = await analyzer.findDeadCode(path.join(tmpDir, 'index.js'));

            const deadNames = dead.map(d => path.basename(d.file));
            assert.ok(deadNames.includes('dead.js'));
            assert.ok(deadNames.includes('also-dead.js'));
            assert.ok(!deadNames.includes('alive.js'));
            assert.ok(!deadNames.includes('helper.js'));
            assert.ok(!deadNames.includes('index.js'));
        });
    });

    describe('generateDependencyGraph', async () => {
        let tmpDir;

        before(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-graph-'));
            fs.writeFileSync(path.join(tmpDir, 'main.js'), [
                "const { a } = require('./a');",
                "const b = require('./b');",
                'a(); b();',
            ].join('\n'));

            fs.writeFileSync(path.join(tmpDir, 'a.js'), [
                "const c = require('./c');",
                'module.exports.a = () => c();',
            ].join('\n'));

            fs.writeFileSync(path.join(tmpDir, 'b.js'), [
                'module.exports.b = () => {};',
            ].join('\n'));

            fs.writeFileSync(path.join(tmpDir, 'c.js'), [
                'module.exports.c = () => {};',
            ].join('\n'));
        });

        after(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        await it('should correctly trace local dependencies', async () => {
            const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: tmpDir });
            const graph = await analyzer.generateDependencyGraph();

            const names = graph.nodes.map(n => path.basename(n.path));
            assert.ok(names.includes('main.js'));
            assert.ok(names.includes('a.js'));
            assert.ok(names.includes('b.js'));
            assert.ok(names.includes('c.js'));

            // Verify edges
            const edges = graph.edges.map(e => ({
                from: path.basename(graph.nodes[e.from].path),
                to: path.basename(graph.nodes[e.to].path),
            }));

            assert.ok(edges.some(e => e.from === 'main.js' && e.to === 'a.js'));
            assert.ok(edges.some(e => e.from === 'main.js' && e.to === 'b.js'));
            assert.ok(edges.some(e => e.from === 'a.js' && e.to === 'c.js'));
        });
    });

    describe('complexityReport', async () => {
        let tmpDir;
        let simpleFile;

        before(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-cplx-'));
            simpleFile = path.join(tmpDir, 'simple.js');
            fs.writeFileSync(simpleFile, [
                'function greet(name) {',
                '    return `Hello ${name}`;',
                '}',
                '',
                'const double = x => x * 2;',
                '',
                'module.exports = { greet, double };',
            ].join('\n'));

            const complexFile = path.join(tmpDir, 'complex.js');
            fs.writeFileSync(complexFile, [
                'function process(items) {',
                '    let result = 0;',
                '    for (let i = 0; i < items.length; i++) {',
                '        if (items[i] > 0) {',
                '            try {',
                '                result += items[i];',
                '            } catch (err) {',
                '                console.warn(err);',
                '            }',
                '        } else if (items[i] === 0) {',
                '            // skip zero',
                '        } else {',
                '            result -= items[i];',
                '        }',
                '    }',
                '    return result;',
                '}',
                '',
                'module.exports = { process };',
            ].join('\n'));
        });

        after(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        await it('should report complexity for simple file', async () => {
            const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: tmpDir });
            const reports = await analyzer.complexityReport(simpleFile);

            assert.equal(reports.length, 1);
            assert.ok(reports[0].functions >= 2);  // greet + double (arrow with implicit return)
            assert.equal(reports[0].decisions, 0); // no if/for/while
            assert.ok(reports[0].codeLines > 0);
        });

        await it('should report higher complexity for complex file', async () => {
            const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: tmpDir });
            const reports = await analyzer.complexityReport([
                simpleFile,
                path.join(tmpDir, 'complex.js'),
            ]);

            const simple = reports.find(r => path.basename(r.file) === 'simple.js');
            const complex = reports.find(r => path.basename(r.file) === 'complex.js');

            assert.ok(simple);
            assert.ok(complex);
            assert.ok(complex.decisions > simple.decisions);
            assert.ok(complex.maxNestingDepth >= 3);  // for > if > try
        });

        await it('should include comment and blank line counts', async () => {
            const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger(), rootDir: tmpDir });
            const reports = await analyzer.complexityReport(path.join(tmpDir, 'complex.js'));

            assert.ok(reports[0].commentLines >= 1);
            assert.ok(reports[0].blankLines >= 1);
        });
    });

    describe('_findExports', async () => {
        const analyzer = new CodebaseAnalyzer({ logger: makeMockLogger() });

        await it('should find named exports from module.exports.X', async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-exp-'));
            const file = path.join(tmpDir, 'foo.js');
            fs.writeFileSync(file, [
                'module.exports.foo = 1;',
                'module.exports.bar = function() {};',
            ].join('\n'));

            const exports = analyzer._findExports(file);
            const names = exports.map(e => e.name);
            assert.ok(names.includes('foo'));
            assert.ok(names.includes('bar'));

            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        await it('should find exports from module.exports = { ... }', async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-exp2-'));
            const file = path.join(tmpDir, 'bar.js');
            fs.writeFileSync(file, [
                'module.exports = { alpha, beta: beta, gamma };',
            ].join('\n'));

            const exports = analyzer._findExports(file);
            const names = exports.map(e => e.name);
            assert.ok(names.includes('alpha'));
            assert.ok(names.includes('beta'));
            assert.ok(names.includes('gamma'));

            fs.rmSync(tmpDir, { recursive: true, force: true });
        });
    });
});
