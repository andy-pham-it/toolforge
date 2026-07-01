# Phase 3 Summary — `@andy-toolforge/coding-support`

> **Status:** ✅ Hoàn thành
> **Date:** 2026-07-01
> **Version:** 1.0.0
> **Tests:** 11 tests (99 tổng toàn bộ monorepo), 0 fail

---

## Files created/updated (9 files)

| File | Lines | Action |
|------|-------|--------|
| `lib/codebase-analyzer.js` | 439 | Tạo mới — CodebaseAnalyzer class |
| `lib/codebase-analyzer.test.js` | 298 | Tạo mới — 11 tests |
| `lib/index.js` | 5 | Cập nhật — export `CodebaseAnalyzer` |
| `skills/coding-code-reviewer.md` | 60 | Tạo mới — skill review code |
| `skills/coding-refactoring-advisor.md` | 74 | Tạo mới — skill đề xuất refactoring |
| `skills/postinstall.js` | 27 | Cập nhật — thêm logging |
| `templates/env.example` | 6 | Tạo mới |
| `package.json` | 21 | Cập nhật — version 1.0.0, test script, description |
| `package-lock.json` | Tự động | `npm install` (thêm `fast-glob`) |

---

## CodebaseAnalyzer API

```
countLines(patterns)              → { files, totalLines, codeLines, commentLines, blankLines, byFile[] }
findDeadCode(entryPoints)         → [{ file, exports[], reason }]
generateDependencyGraph()         → { nodes: [{id, path, name}], edges: [{from, to, source}] }
complexityReport(files)           → [{ file, totalLines, codeLines, commentLines, blankLines,
                                       functions, decisions, maxNestingDepth, maxLineLength }]
```

### Chi tiết từng method

**`countLines(patterns)`**
- Nhận 1 hoặc nhiều glob pattern
- Trả về tổng hợp lines code, comment, blank theo file và toàn bộ
- Dùng `fast-glob` để match files

**`findDeadCode(entryPoints)`**
- Tìm tất cả file `.js` không được require từ entry points
- Parse `require('./...')` từ entry points, resolve transitive dependencies
- Parse `module.exports.X` và `module.exports = { ... }` để tìm exports
- Trả về danh sách file + exports không được dùng

**`generateDependencyGraph()`**
- Quét tất cả `.js` files, parse `require()` statements
- Resolve relative paths → absolute
- Trả về adjacency list (nodes + edges)

**`complexityReport(files)`**
- Đếm số functions (function, arrow, method shorthand)
- Đếm decision points (if/for/while/switch/case/catch/&&/||/ternary)
- Đo max nesting depth (từ brace indentation)
- Đo max line length

---

## Test coverage (11 tests)

| Suite | Tests | Coverage |
|-------|-------|----------|
| countLines | 4 | No match, empty pattern reject, self-analysis, known content (temp file) |
| findDeadCode | 1 | 5-file mini project (entry + alive + helper + 2 dead) |
| generateDependencyGraph | 1 | 4-file mini project (main → a, main → b, a → c) |
| complexityReport | 3 | Simple file (no decisions), higher complexity, comment/blank counts |
| _findExports | 2 | `module.exports.X`, `module.exports = { ... }` |

---

## Bugs encountered & fixed

| Issue | Root cause | Fix |
|-------|-----------|-----|
| **`*.js` trong JSDoc block comment gây SyntaxError** | Node.js v22.22.0: `*/` trong string `"lib/**/*.js"` đóng block comment sớm | Đổi example string thành `all ".js" files under "lib/"` |
| **`fast-glob` không có trong dependencies** | Code dùng glob nhưng fallback walker không hiểu glob patterns | Thêm `fast-glob@^3.3.0` vào dependencies |
| **Test expectations sai** | Đếm sai số dòng code/comment/blank trong test file | Sửa assertions: codeLines 3, commentLines 5, blankLines 3 |
| **complexity test comment count sai** | Test expect `>= 2` nhưng complex.js chỉ có 1 comment line | Sửa thành `>= 1` |

---

## Skill files

### `coding-code-reviewer.md`
- 3 severity levels: Critical / Important / Suggestion
- 7 rules: ưu tiên bug > performance > readability, luôn propose fix
- Template output với file/scope + issues theo severity

### `coding-refactoring-advisor.md`
- Output 3 phần: current analysis → plan → target state
- 6 rules: không refactor vì thích, each step có effort estimate, ưu tiên God functions

---

## Known debt

| Item | Priority |
|------|----------|
| `findDeadCode` chỉ phân tích CommonJS `require()` — chưa hỗ trợ ESM `import` | Low |
| `countDecisions` dùng regex-based — có false positives (e.g., `&&` trong string literals) | Low |
| `_maxNesting` dùng brace counting — không handle ternary/switch nesting | Low |
| Chưa hỗ trợ TypeScript (`.ts`, `.tsx`) — chỉ phân tích `.js` | Medium |

---

## Dependency tree

```
@andy-toolforge/coding-support
  ├── @andy-toolforge/core (Logger)
  └── fast-glob ^3.3.0
```
