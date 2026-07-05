# @andy-toolforge/coding-support

[![npm](https://img.shields.io/npm/v/@andy-toolforge/coding-support)](https://npmjs.com/package/@andy-toolforge/coding-support)
[![License](https://img.shields.io/npm/l/@andy-toolforge/coding-support)](https://github.com/andy-pham-it/toolforge)

**Static code analysis: line counts, dead code, dependency graphs, complexity.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Đếm dòng code (total, code, comment, blank) theo glob patterns
- Tìm code chết — exports không được require từ entry points
- Sinh dependency graph của JS/TS project
- Báo cáo complexity: số functions, decisions, nesting depth, max line length

## Installation

```bash
npm install @andy-toolforge/coding-support
```

Yêu cầu `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const { CodebaseAnalyzer } = require('@andy-toolforge/coding-support');
```

---

### CodebaseAnalyzer

**Constructor:** `new CodebaseAnalyzer({ rootDir?, logger? })`

Mặc định `rootDir` là `process.cwd()`.

---

#### countLines(patterns)

Đếm dòng code cho files matching glob patterns.

| Param | Type | Mô tả |
|-------|------|-------|
| `patterns` | string \| string[] | Glob pattern(s) (vd: `'lib/**/*.js'`) |

**Return:**
```javascript
{
  files: 10,
  totalLines: 500,
  codeLines: 350,
  commentLines: 80,
  blankLines: 70,
  byFile: [
    { file: 'lib/index.js', totalLines: 50, codeLines: 35, commentLines: 10, blankLines: 5 },
    // ...
  ]
}
```

```javascript
const { CodebaseAnalyzer } = require('@andy-toolforge/coding-support');

const analyzer = new CodebaseAnalyzer();
const counts = await analyzer.countLines('lib/**/*.js');
console.log(`📊 ${counts.files} files, ${counts.codeLines} LOC`);
```

---

#### findDeadCode(entryPoints)

Tìm exports không được require từ entry points.

| Param | Type | Mô tả |
|-------|------|-------|
| `entryPoints` | string \| string[] | Entry file path(s) |

**Return:**
```javascript
[
  { file: 'src/utils/old.js', exports: ['helper1', 'helper2'], reason: 'File is not required' },
  // ...
]
```

```javascript
const dead = await analyzer.findDeadCode('src/index.js');
if (dead.length > 0) {
    console.log(`🗑️  ${dead.length} potentially dead files:`);
    dead.forEach(d => console.log(`  - ${d.file}: ${d.exports.join(', ')}`));
}
```

Hoạt động: quét tất cả `require()` trong project → build graph → so sánh với exports. Hỗ trợ cả `module.exports.X =` và `module.exports = { X }`.

---

#### generateDependencyGraph()

Sinh dependency graph của tất cả JS files.

**Return:**
```javascript
{
  nodes: [{ id: 0, path: 'src/index.js', name: 'index.js' }, ...],
  edges: [{ from: 0, to: 1, source: './utils' }, ...]
}
```

```javascript
const graph = await analyzer.generateDependencyGraph();
console.log(`${graph.nodes.length} files, ${graph.edges.length} dependencies`);
```

Dùng được với `d3-force` hoặc cytoscape để visualize.

---

#### complexityReport(files)

Báo cáo complexity metrics cho từng file.

| Param | Type | Mô tả |
|-------|------|-------|
| `files` | string \| string[] | File paths |

**Return:**
```javascript
[
  {
    file: 'src/index.js',
    totalLines: 100,
    codeLines: 70,
    commentLines: 15,
    blankLines: 15,
    functions: 5,
    decisions: 12,
    maxNestingDepth: 3,
    maxLineLength: 80
  }
]
```

```javascript
const report = await analyzer.complexityReport(['src/index.js', 'src/utils.js']);
report.forEach(r => {
    const flag = r.maxNestingDepth > 4 ? '⚠️' : '✅';
    console.log(`${flag} ${r.file}: ${r.functions} funcs, depth ${r.maxNestingDepth}`);
});
```

---

## Tutorial: Codebase Health Check

```javascript
const analyzer = new CodebaseAnalyzer();

async function healthCheck() {
    // Bước 1: Size
    const counts = await analyzer.countLines(['lib/**/*.js', 'src/**/*.js']);
    console.log(`📊 Codebase: ${counts.codeLines} LOC in ${counts.files} files`);

    // Bước 2: Dead code
    const dead = await analyzer.findDeadCode('src/index.js');
    if (dead.length > 0) console.log(`🗑️  ${dead.length} dead file(s)`);

    // Bước 3: Complexity hotspots
    const allFiles = counts.byFile.map(f => f.file);
    const complexity = await analyzer.complexityReport(allFiles);
    const hotspots = complexity.filter(c => c.maxNestingDepth > 4);
    if (hotspots.length > 0) console.log(`⚠️  ${hotspots.length} complex file(s)`);

    return { counts, dead, hotspots };
}
```

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — Logger
- [@andy-toolforge/pm-support](https://npmjs.com/package/@andy-toolforge/pm-support) — Track code task progress
