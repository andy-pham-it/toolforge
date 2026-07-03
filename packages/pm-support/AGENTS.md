# @andy-toolforge/pm-support — Project Management Support

> Domain package for project management: task tracking, meeting assistance, project planning, time logging, invoicing.

## Structure

```
packages/pm-support/
  lib/
    index.js  — Entry: exports { TaskTracker }
    tracker.js — TaskTracker  Track tasks, time, generate reports and invoices
  skills/
    postinstall.js
    task-tracker.md
  package.json — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `TaskTracker` | `lib/tracker.js` | Project task management — create, update, report, invoice generation. |

## Conventions

- Skill files prefixed with `pm-support-`.
- Uses core LLMClient for report/invoice generation.

## Testing

```bash
npm test -w @andy-toolforge/pm-support
```
