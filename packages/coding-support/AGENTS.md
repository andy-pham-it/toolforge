# @andy-toolforge/coding-support — Code Analysis Tools

> Domain package for static codebase analysis: line counting, dead code detection,
> dependency graphs, and cyclomatic complexity reports for JS/TS projects.
> Uses `fast-glob` for file pattern matching and CommonJS-aware parsing.

## Structure

```
packages/coding-support/
  lib/
    index.js           — Entry: exports { CodebaseAnalyzer }
    codebase-analyzer.js — CodebaseAnalyzer — 4 analysis methods
  mcp-tools.js          — MCP tool handlers
  skills/
    postinstall.js
    codebase-analyzer.md
  package.json         — deps: @andy-toolforge/core, fast-glob
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `CodebaseAnalyzer` | `lib/codebase-analyzer.js` | Analyze codebase metrics — counts, dead code, dependency graph, complexity. |

### CodebaseAnalyzer methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `countLines(patterns)` | `(string|string[]) → Promise<object>` | Count lines in files matching glob patterns. Returns `{ files, totalLines, codeLines, commentLines, blankLines, byFile[] }`. |
| `findDeadCode(entryPoints)` | `(string|string[]) → Promise<object[]>` | Find exports not transitively required from entry points. Returns `[{ file, exports[], reason }]`. Handles `module.exports.X` and `module.exports = { X }` patterns. |
| `generateDependencyGraph()` | `() → Promise<object>` | Generate dependency graph of all local JS files. Returns `{ nodes: [{id,path,name}], edges: [{from,to,source}] }`. |
| `complexityReport(files)` | `(string|string[]) → Promise<object[]>` | Complexity metrics for specific files. Returns `[{ file, functions, decisions, maxNestingDepth, maxLineLength, line counts }]`. |

## Conventions

- Uses `fast-glob` for file pattern matching — not raw `fs.readdir` recursion. Falls back to simple walker if ESM import fails.
- `findDeadCode` resolves `require()` calls recursively from entry points to find unreachable files.
- `complexityReport` measures: function count (declarations, expressions, arrows), decision points (if/else/switch/case/for/while/catch/ternary/&&/||), max nesting depth (brace tracking), max line length.
- All methods respect `rootDir` config option (defaults to `process.cwd()`).
- Skill files prefixed with `coding-support-`.
- MCP tools registered via `mcp-tools.js`.

## Testing

```bash
npm test -w @andy-toolforge/coding-support
```
