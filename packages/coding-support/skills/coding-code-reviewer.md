---
name: coding-code-reviewer
description: Hướng dẫn AI review code theo chuẩn dự án — phát hiện bug, security issues, code smells, convention violations. Dùng khi user yêu cầu review code, audit pull request, hoặc kiểm tra chất lượng code trước khi merge.
---

# Code Reviewer

Skill này hướng dẫn AI review code theo chuẩn của dự án, tập trung vào bug thật sự thay vì style nits.

## 📥 Input

- **Files / diff** — code cần review
- **Language / framework** — (optional) ngôn ngữ lập trình
- **Context** — (optional) chức năng của code

## 📤 Output

Danh sách issues phân loại theo severity:

### Severity levels

| Level | Label | Ý nghĩa | Action |
|-------|-------|---------|--------|
| 🔴 Critical | **critical** | Bug, security hole, logic sai | Phải fix trước merge |
| 🟡 Important | **important** | Code smell, convention violation, thiếu validation | Nên fix |
| 🟢 Suggestion | **suggestion** | Tối ưu, best practice | Có thể để sau |

## 🎯 Rules

1. **Critical** chỉ dùng cho bug/sai logic/security — KHÔNG dùng cho style issues
2. **Luôn propose fix** cho mỗi issue — không chỉ "phát hiện ra vấn đề"
3. **Ưu tiên** bug > performance > readability > style
4. **Không review** file auto-generated, dependency, config không liên quan
5. **Kiểm tra input validation** — thiếu validation là important, không phải critical
6. **Kiểm tra error handling** — catch không xử lý, throw generic error
7. **Kiểm tra async patterns** — Promise không được await, thiếu error handling trong async

## 📋 Template

```
## Review: [file/scope]

### 🔴 Critical (N)
- **Line X:** [vấn đề] → [fix đề xuất]

### 🟡 Important (N)
- **Line Y:** [vấn đề] → [fix đề xuất]

### 🟢 Suggestion (N)
- **Line Z:** [vấn đề] → [fix đề xuất]

### ✅ OK
- [file] — không có issues
```

## 📋 Prerequisites

- Code diff or file content to review
- Language/framework context for accurate pattern detection
- Optional: project conventions or style guide reference

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| False positive | Pattern misidentified as issue | Cross-check with language best practices, downgrade severity |
| Missing security issue | Insufficient context | Query dependencies for known vulnerabilities |
| Review too verbose | Too many low-severity suggestions | Filter to critical/important only per rules |
| Auto-generated file flagged | Pattern not excluded | Skip auto-generated, dependency, and config files |

## 🔗 Integration

- **MCP tools:** `codebase_complexity` — measure code complexity before review; `codebase_dependency_graph` — understand dependencies
- **Domain packages:** Code review issues feed into `coding-refactoring-advisor` for structured fix plans
- **Cross-domain:** Combine with `pm-support`'s `TaskTracker` to create tasks from review findings

## 📚 Related Skills

- `coding-refactoring-advisor` — fix issues found during review
- `coding-support-hub` — overview of all coding support tools
- `pm-support-hub` — track review findings as tasks
- `andy-toolforge` (MCP Bridge) — invoke coding tools via `skill_mcp`
