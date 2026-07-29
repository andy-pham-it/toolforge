# @andy-toolforge/pm-support — Project Management Support

> Domain package for project management: task tracking, time logging,
> project planning, reporting, and invoice calculation.
> In-memory data store (Map-based, non-persistent across sessions).

## Structure

```
packages/pm-support/
  lib/
    index.js   — Entry: exports { TaskTracker }
    tracker.js — TaskTracker — 9 methods for full project lifecycle
  mcp-tools.js — MCP tool handlers
  skills/
    postinstall.js
    task-tracker.md
  package.json — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `TaskTracker` | `lib/tracker.js` | Project task management — create, update, track, report, invoice. |

### TaskTracker methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createProject(name, tasks?)` | `(string, Array<{name,status?,assignee?}>) → Promise<object>` | Create project with optional task list. Returns project with auto-generated IDs. |
| `addTask(projectId, taskName, options?)` | `(string, string, {assignee?}) → Promise<object>` | Add task to existing project. |
| `updateTaskStatus(taskId, status)` | `(string, 'todo'|'in_progress'|'done') → Promise<object>` | Update a task's status by task ID. |
| `trackTime(taskId, durationMinutes, note?)` | `(string, number, string='') → Promise<object>` | Track time on a task (minutes, must be > 0). Returns time entry with metadata. |
| `generateReport(projectId)` | `(string) → Promise<object>` | Generate project report with task breakdown, completion rate, total hours tracked. |
| `calculateInvoice(hours, rate, currency?)` | `(number, number, string='USD') → Promise<object>` | Calculate invoice from hours and hourly rate. Returns `{ totalHours, rate, currency, subtotal, generatedAt }`. |
| `getTimeEntries(filters?)` | `({projectId?, taskId?}) → Promise<object[]>` | Get time entries, optionally filtered by project or task. |
| `listProjects()` | `() → Promise<object[]>` | List all projects with summary stats (id, name, task count, completed count). |
| `getProject(projectId)` | `(string) → Promise<object>` | Get single project with full task details. |

## Conventions

- **In-memory storage** — `Map<string, Project>`. Data is not persisted between sessions.
- `createProject` validates project name and task array. Auto-generates IDs (`proj-N`, `task-N`).
- Time tracking uses `_findTask(taskId)` that searches across all projects internally.
- Skill files prefixed with `pm-support-`.
- MCP tools registered via `mcp-tools.js`.

## Testing

```bash
npm test -w @andy-toolforge/pm-support
```
