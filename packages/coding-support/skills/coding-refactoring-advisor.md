---
name: coding-refactoring-advisor
description: Đề xuất refactoring dựa trên code patterns và best practices — phân tích code hiện tại, đề xuất cấu trúc mới, ước lượng effort. Dùng khi user cần refactor module, giảm technical debt, hoặc cải thiện maintainability.
---

# Refactoring Advisor

Skill này hướng dẫn AI phân tích code và đề xuất refactoring plan.

## 📥 Input

- **File / Module** — code cần refactor
- **Goal** — giảm complexity, tăng testability, cải thiện performance, v.v.
- **Constraints** — (optional) không được thay đổi API public, phải backward compatible, v.v.

## 📤 Output

### 1. Current analysis

- **File size** — total / code / comment / blank lines
- **Complexity** — số functions, số decision points, max nesting depth
- **Dependencies** — module này phụ thuộc vào gì
- **Code smells** — cụ thể từng vấn đề

### 2. Refactoring plan

| Step | Task | Effort | Risk |
|------|------|--------|------|
| 1 | Tách function X | 30m | Low |
| 2 | Extract class Y | 1h | Medium |

### 3. Target state

Mô tả cấu trúc mới, file nào thay đổi, file nào tạo mới.

## 🎯 Rules

1. **Không refactor** code đang hoạt động mà không có lý do — phải chỉ rõ benefit
2. **Mỗi bước** phải có effort estimate và risk level
3. **Ưu tiên** small steps → có thể merge từng phần
4. **Luôn giữ** backward compatibility trừ khi được yêu cầu khác
5. **Có thể skip** nếu code đã clean — đừng refactor vì thích
6. **Ưu tiên** xử lý God functions / God classes trước

## 📋 Template

```
## Refactoring: [module]

### Current state
- LOC: N (code: N, comment: N, blank: N)
- Functions: N
- Max nesting: N
- Code smells: ...

### Plan
| # | Step | Effort | Risk |
|---|------|--------|------|
| 1 | ...  | ...    | ...  |

### Target structure
[file tree/class diagram]

### Risks
- ...
```
