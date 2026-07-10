---
name: pm-support-hub
description: Use when creating projects, adding tasks, tracking time, generating reports, or calculating invoices.
---

# Project Management Support Hub

## MCP Tools
All tools via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

| Tool | Description |
|------|-------------|
| `pm_create_project` | Create project with optional task list |
| `pm_add_task` | Add task to existing project |
| `pm_track_time` | Track time spent on task |
| `pm_generate_report` | Generate PM report (text/markdown) |
| `pm_calculate_invoice` | Calculate invoice from time entries x rate |

## Workflow
1. `pm_create_project` — set up project + tasks
2. `pm_add_task` — add tasks as work emerges
3. `pm_track_time` — log hours per task
4. `pm_generate_report` — progress report
5. `pm_calculate_invoice` — invoice at billing cycle

## Related Skills
- `pm-meeting-assistant` — meeting notes integration
- `pm-project-planner` — project planning workflow
- `toolforge-podcast-project-manager` — podcast-specific PM workflow

## Integration
- Time tracking feeds into invoices
- Project reports used for stakeholder updates
- Tasks can reference resources from other domains (e.g., "write SEO metadata")
