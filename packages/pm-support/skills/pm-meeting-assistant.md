---
name: pm-meeting-assistant
description: Chuẩn bị và follow-up meeting — tạo agenda từ mô tả, ghi chú meeting, tóm tắt và action items. Dùng khi user cần chuẩn bị meeting hoặc xử lý ghi chú sau cuộc họp.
---

# Trợ Lý Cuộc Họp (Meeting Assistant)

Skill này hướng dẫn AI hỗ trợ chuẩn bị trước meeting và tạo follow-up sau meeting.

## 📥 Input

- **Meeting type** — 1:1, sprint review, client meeting, all-hands, v.v.
- **Context** — dự án / vấn đề cần thảo luận
- **Attendees** — (optional) ai tham gia
- **Previous notes** — (optional) ghi chú từ meeting trước

## 📤 Output

### A. Pre-Meeting: Agenda

```markdown
# Agenda: [Meeting Title]
📅 Date: ...
👥 Attendees: ...

## Mục tiêu
[1-2 câu]

## Agenda
1. **Khởi động** (5 phút) — kiểm tra nhanh
2. **Chủ đề chính** (20 phút) — [mô tả]
3. **Action items tuần trước** (10 phút) — review
4. **Kết luận** (5 phút) — next steps
```

### B. Post-Meeting: Summary & Action Items

```markdown
# Meeting Summary: [Title]

## Key Decisions
- Quyết định 1: ...
- Quyết định 2: ...

## Action Items
| # | Task | Owner | Deadline |
|---|------|-------|----------|
| 1 | ...  | @user | 2026-07-10 |
```

## 🎯 Rules

1. **Trước meeting:** Luôn tạo agenda với mục tiêu rõ ràng — "bàn về X" không đủ
2. **Sau meeting:** Luôn extract action items với owner rõ ràng
3. **Deadline:** Mỗi action item phải có deadline hoặc next check-in
4. **Tone:** Chuyên nghiệp, ngắn gọn, không dùng từ hoa mỹ
5. **Format:** Markdown, ưu tiên bảng cho action items

## 📋 Template

### Pre-Meeting
```
# Agenda: [Title]
📅 Date: YYYY-MM-DD
⏱ Duration: N phút
👥 Attendees: [list]

## Goals
...

## Topics
1. [Topic] ([N] phút) — [mô tả ngắn]
```

### Post-Meeting
```
# Summary: [Title]
📅 Date: YYYY-MM-DD

## Decisions
- ...

## Action Items
| Task | Owner | Deadline |
|------|-------|----------|
| ...  | ...   | ...      |

## Next Meeting
📅 ...
```

## 📋 Prerequisites

- Meeting type and context (what project/topic)
- Optional: attendee list, previous meeting notes, duration
- For post-meeting: raw notes or transcript to process

## ⚠️ Error Recovery

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| Agenda too vague | Insufficient context | Ask clarifying questions about meeting purpose |
| Action items missing owners | Notes don't specify who | Flag explicitly: "Owner not specified in notes" |
| Duplicate action items | Same task mentioned multiple times | Deduplicate and merge with latest update |

## 🔗 Integration

- **MCP tools:** `pm_create_project`, `pm_add_task`, `pm_track_time`, `pm_generate_report`, `pm_calculate_invoice`
- **Domain packages:** Action items can be created as tasks via `TaskTracker`
- **Cross-domain:** Meeting summaries can feed `content-operations`'s editorial calendar for content strategy meetings

## 📚 Related Skills

- `pm-project-planner` — plan projects discussed in meetings
- `pm-support-hub` — overview of all PM tools
- `content-operations-editorial-calendar` — schedule content from meetings
- `andy-toolforge` (MCP Bridge) — invoke PM tools via `skill_mcp`
