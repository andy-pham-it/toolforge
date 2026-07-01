# Phase 2 Summary — `@andy-toolforge/pm-support`

> **Status:** ✅ Hoàn thành
> **Date:** 2026-07-01
> **Version:** 1.0.0
> **Tests:** 32 tests, 0 fail

---

## Files created/updated (8 files)

| File | Lines | Action |
|------|-------|--------|
| `lib/tracker.js` | 272 | Tạo mới — TaskTracker class |
| `lib/tracker.test.js` | 340 | Tạo mới — 32 tests |
| `lib/index.js` | 5 | Cập nhật — export `TaskTracker` |
| `skills/pm-project-planner.md` | 74 | Tạo mới — skill lập kế hoạch dự án |
| `skills/pm-meeting-assistant.md` | 90 | Tạo mới — skill trợ lý cuộc họp |
| `skills/postinstall.js` | 27 | Cập nhật — thêm logging |
| `templates/env.example` | 9 | Tạo mới |
| `package.json` | 20 | Cập nhật — version 1.0.0, test script, description |

---

## TaskTracker API

```
createProject(name, tasks?)          → { id, name, tasks, createdAt }
addTask(projectId, taskName, opts?)   → { id, name, status, assignee }
updateTaskStatus(taskId, status)       → { id, name, status, ... }
trackTime(taskId, minutes, note?)     → { id, taskId, durationMinutes, note, timestamp }
generateReport(projectId)             → { totalTasks, completedTasks, completionRate, totalHours, taskBreakdown }
calculateInvoice(hours, rate, cur?)   → { totalHours, rate, currency, subtotal }
getTimeEntries(filters?)              → [entry, ...]
listProjects()                        → [{ id, name, taskCount, completedCount }]
getProject(projectId)                 → { id, name, tasks, createdAt }
```

## Test coverage (32 tests)

| Suite | Tests | Coverage |
|-------|-------|----------|
| createProject | 6 | Happy path (no tasks, with tasks), validation (empty name, non-string, non-array tasks, task missing name) |
| addTask | 4 | Happy path, with assignee, non-existent project reject, empty name reject |
| updateTaskStatus | 3 | Happy path, invalid status reject, non-existent task reject |
| trackTime | 5 | Happy path (with note, without note), non-existent task reject, non-positive duration reject, non-numeric duration reject |
| generateReport | 3 | Complete report, task-level breakdown, non-existent project reject |
| calculateInvoice | 5 | Correct calculation, USD default, zero hours, negative hours reject, non-positive rate reject |
| getTimeEntries | 3 | No filter, filter by projectId, filter by taskId |
| listProjects | 1 | Returns all projects with summaries |
| getProject | 2 | Full details, non-existent reject |

Total: 32 tests ✅

---

## Bugs fixed during code review

| # | Issue | Fix |
|---|-------|-----|
| 1 | **Module-level counters shared between instances** (`nextProjectId`, `nextTaskId`) | Moved to instance fields (`this._nextProjectId`, `this._nextTaskId`) |
| 2 | **Test isolation broken** — shared outer `tracker` variable overwritten by each describe block's `before()` | Each describe block now has its own local `const tracker` + own `before()` setup. `getTimeEntries`, `listProjects`, `getProject` now self-contained with their own data setup |

---

## Design decisions

1. **Per-instance ID counters** — tránh shared mutable state ở module level, predict-able IDs trong mỗi instance
2. **Each describe block self-contained** — test data setup riêng, không phụ thuộc side effects từ describe khác
3. **`makeMockLogger()` helper function** — tránh DRY violation, mỗi describe block tạo mock logger riêng
4. **Async/await consistent** — tất cả `before()` dùng async/await, không còn `.then()` pattern

---

## Known debt

| Item | Priority |
|------|----------|
| `calculateInvoice` chưa validate `currency` là string | Low |
| `generateReport` và `createProject` trả về internal reference (không defensive copy) | Low |
| Skill file `pm-project-planner.md` thiếu section "Integration with TaskTracker" | Low |
| Chưa có persistence layer — tất cả data in-memory | Medium |

---

## Dependency tree

```
@andy-toolforge/pm-support
  └── @andy-toolforge/core (Logger)
  
@andy-toolforge/core is the only dependency. No inter-domain coupling.
```

---

## Skill files

### `pm-project-planner.md`
- Hướng dẫn AI lập kế hoạch dự án: task breakdown, dependencies, milestones, risks
- Template output có thể copy vào TaskTracker
- 6 rules rõ ràng (effort estimate, dependencies, milestones, risk mitigation)

### `pm-meeting-assistant.md`
- Hướng dẫn AI chuẩn bị pre-meeting agenda và post-meeting summary
- Template riêng cho pre/post
- 5 rules (agenda goals, action items, deadlines, tone, format)
