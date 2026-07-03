# @andy-toolforge/coding-support — Code Analysis Tools

> Domain package for codebase analysis: line counting, dead code detection, dependency graphs, complexity reports.

## Structure

```
packages/coding-support/
  lib/
    index.js           — Entry: exports { CodebaseAnalyzer }
    codebase-analyzer.js — CodebaseAnalyzer  Line counts, dead code, dep graph, complexity
  skills/
    postinstall.js
    codebase-analyzer.md
  package.json         — deps: @andy-toolforge/core, fast-glob
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `CodebaseAnalyzer` | `lib/codebase-analyzer.js` | Analyze codebase metrics — counts, dead code detection, dependency graph, cyclomatic complexity. |

## Conventions

- Uses `fast-glob` for file pattern matching — not raw `fs.readdir` recursion.
- Skill files prefixed with `coding-support-`.

## Testing

```bash
npm test -w @andy-toolforge/coding-support
```
