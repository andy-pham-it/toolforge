---
name: hermes-opencode-bridge
description: Run coding tasks in local opencode sessions, read files, check git status, and manage allowed models through the hermes-opencode-mcp-bridge MCP tools (opencode_run/opencode_task/opencode_read/opencode_status/opencode_set_models).
---

# Using the opencode bridge (opencode_* tools)

Bridge từ Hermes Agent / MCP client sang **opencode CLI** cục bộ: chạy task coding trong session opencode, đọc file, xem git status, quản lý danh sách model được phép.

## Why this exists

Khi bạn (agent) cần code thật — sửa bug, thêm test, refactor — nhưng không chạy trong chính môi trường opencode của project đó. Bridge mở một session opencode riêng (subprocess), để opencode làm việc với codebase, rồi trả về kết quả có cấu trúc (`files_changed`, `diff`, `summary`, `tool_calls`). Bạn giữ vai trò điều phối: giao task, đọc kết quả, quyết định bước tiếp.

## Tools

| Tool | Purpose | Key params |
|------|---------|-----------|
| `opencode_run` | Run một task trong opencode session | `task`* , `project_dir`, `model`, `agent`, `conversation_id` |
| `opencode_task` | Như `opencode_run` nhưng **luôn auto-commit** sau khi thành công | giống `opencode_run` |
| `opencode_read` | Đọc file hoặc liệt kê directory tree | `path`* , `depth` (mặc định 2), `max_lines` (mặc định 500) |
| `opencode_status` | Git status của một project directory | `project_dir` |
| `opencode_set_models` | Set/add/remove/list danh sách model được phép | `models`[], `action` (`set`\|`add`\|`remove`\|`list`) |

`*` = required. Các param còn lại đều optional (fallback về config, xem bên dưới).

## Workflow

1. **Xác định project** — luôn truyền `project_dir` tường minh (root của git repo). Nếu bỏ trống, bridge dùng `default_project_dir` từ config (mặc định `~/projects`).
2. **Chạy task** — `opencode_run({ task, project_dir })`. Kết quả trả về `conversation_id` + `session_id` + `files_changed` + `diff` + `summary`.
3. **Tiếp tục session (multi-step)** — task sau truyền `conversation_id` của lần chạy trước để tiếp tục *cùng* session opencode (bridge fork session qua `--session <id> --fork`). Hữu ích cho "sửa bug" → "thêm test cho fix" → "verify".
4. **Đọc / kiểm tra** — `opencode_read({ path })` để xem file đã đổi; `opencode_status({ project_dir })` để xem git state trước/sau.
5. **opencode_task khi muốn commit ngay** — dùng `opencode_task` khi client muốn thay đổi được commit (auto-commit `git add -A && git commit -m "feat: auto-commit after opencode run"`). Dùng `opencode_run` khi muốn xem `diff` trước, commit sau (thủ công).

## Rules

- **Chỉ truyền `conversation_id` nhận được từ một lần chạy trước** — id lạ trả về `MISSING_CONVERSATION`. Nếu cần session mới, bỏ trống field.
- **`project_dir` phải là root của git repo** — `opencode_status` và auto-commit đều chạy `git -C <project_dir>`.
- **`opencode_task` sẽ commit thay client** — đừng dùng khi client cần review diff trước; dùng `opencode_run` rồi tự commit.
- **Model phải nằm trong danh sách cho phép** — nếu config `models` không rỗng, `model` không có trong list → `INVALID_ARGS`.
- **Timeout mặc định 300s** (`session_timeout` trong config) — task quá lâu trả về `TIMEOUT` (bridge kill process). Task nặng nên tăng `session_timeout`.
- **Errors có thể gặp:** `INVALID_ARGS` (thiếu `task` / model không được phép), `MISSING_CONVERSATION`, `TIMEOUT`, `TASK_ERROR` (spawn fail), `PARSE_ERROR` (output opencode không parse được, exit ≠ 0).
- **Kết quả chuẩn:** mỗi tool trả về `{ status: 'success'|'error', data|error }`. Đọc `data.summary` + `data.files_changed` trước khi quyết định bước tiếp.

## Config reference (optional)

File: `~/.config/hermes-opencode/config.json` (hoặc env `HERMES_OPENCODE_CONFIG`). Toàn bộ optional:

```json
{
  "opencode_bin": "~/.opencode/bin/opencode",
  "default_project_dir": "~/projects",
  "default_agent": "fixer",
  "default_model": "opencode/deepseek-v4-flash-free",
  "models": [],
  "session_timeout": 300,
  "auto_commit": false,
  "verbose": false
}
```

- `models` non-empty → `opencode_run` chỉ cho phép model trong list.
- `session_timeout` = giây idle trước khi session bị quên (sweep).
- `auto_commit` true → mọi `opencode_run` thành công đều auto-commit (không cần dùng `opencode_task`).
