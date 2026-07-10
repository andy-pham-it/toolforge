# Podcast Project Manager

Quản lý project, tasks, time tracking, và invoices cho sản xuất podcast.

## Workflow

### Bước 1: Tạo project

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_create_project", arguments={
  "name": "Podcast Season 2",
  "tasks": [{"name": "Write script Ep 1"}, {"name": "Record audio Ep 1"}]
})
```

Kết quả: project ID.

### Bước 2: Thêm task (nếu chưa tạo lúc đầu)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_add_task", arguments={
  "projectId": "...", "name": "Edit video", "status": "todo"
})
```

### Bước 3: Track thời gian

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_track_time", arguments={
  "taskId": "...", "durationMinutes": 120, "note": "Script outline"
})
```

### Bước 4: Generate report

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_generate_report", arguments={
  "projectId": "...", "format": "markdown"
})
```

### Bước 5: Tính invoice (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="pm_calculate_invoice", arguments={
  "projectId": "...", "rate": 50
})
```
