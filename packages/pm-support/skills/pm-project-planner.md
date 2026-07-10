---
name: pm-project-planner
description: Lập kế hoạch dự án chi tiết — breakdown tasks, ước lượng thời gian, xác định dependencies và milestones. Dùng khi user cần AI lập plan cho dự án mới hoặc phase sắp tới.
---

# Lập Kế Hoạch Dự Án (Project Planner)

Skill này hướng dẫn AI lập kế hoạch dự án từ mô tả tổng quan, bao gồm task breakdown, ước lượng, dependencies, và milestones.

## 📥 Input

- **Project description** — mô tả tổng quan về dự án
- **Scope & constraints** — (optional) ngân sách, deadline, technology stack
- **Team size / roles** — (optional) ai làm gì

## 📤 Output

Bản kế hoạch hoàn chỉnh:

### 1. Tổng quan

```yaml
project:
  name: Tên dự án
  description: Mô tả ngắn
  estimated_duration: "X-Y weeks"
  team_size: N người
```

### 2. Task breakdown

| ID | Task | Effort | Dependencies | Assignee | Status |
|----|------|--------|-------------|----------|--------|
| T1 | Nghiên cứu | 2d | — | AI | done |
| T2 | Thiết kế | 3d | T1 | AI | planned |

### 3. Milestones

- **M1** — hoàn thành nghiên cứu (tuần 1)
- **M2** — MVP sẵn sàng (tuần 3)
- **M3** — release (tuần 5)

### 4. Risks & mitigation

- **Risk:** Phụ thuộc vào API bên thứ ba → **Mitigation:** Có fallback plan

## 🎯 Rules

1. **Mỗi task** phải có effort estimate (giờ hoặc ngày)
2. **Dependencies** phải hợp lý (không circular)
3. **Milestones** cách nhau tối đa 2 tuần
4. **Risk** phải có mitigation — không liệt kê risk mà không có giải pháp
5. **Ước lượng** dùng pessimistic/optimistic range (vd: 2-4 days)
6. **Output** luôn ở định dạng có thể copy vào tracker

## 📋 Template

```
## Dự án: [Tên]

### Mô tả
[2-3 câu]

### Tasks
| ID | Task | Effort | Deps | Assignee |
|====|======|========|======|==========|
| T1 | ...  | ...    | ...  | ...      |

### Milestones
- M1: ...

### Risks
- ...
```

## 📋 Prerequisites

- Project description or goal statement
- Optional: scope constraints, deadline, budget, team size/roles
- For effort estimation: understanding of technology stack and complexity

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Circular dependencies | Poor task sequencing | Review dependency chain, break cycles by reordering |
| Milestone spacing >2 weeks | Missing intermediate milestones | Add checkpoint milestones for long phases |
| Effort estimates too optimistic | Unknown complexity | Apply 1.5x–2x buffer for unfamiliar work |

## 🔗 Integration

- **MCP tools:** `pm_create_project`, `pm_add_task`, `pm_track_time` — execute the plan via PM tools
- **Domain packages:** Plans can be tracked via `TaskTracker` for time logging and invoicing
- **Cross-domain:** Combine with `ba-requirement-gatherer` for requirements-driven planning, or `coding-refactoring-advisor` for technical plans

## 📚 Related Skills

- `pm-meeting-assistant` — discuss plans in meetings
- `pm-support-hub` — overview of all PM tools
- `ba-requirement-gatherer` — gather requirements before planning
- `coding-refactoring-advisor` — technical refactoring plans
- `andy-toolforge` (MCP Bridge) — invoke PM tools via `skill_mcp`
