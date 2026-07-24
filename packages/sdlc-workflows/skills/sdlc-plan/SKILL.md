---
id: sdlc-workflows-sdlc-plan
version: 1.0.0
standard: agile
---

# SDLC: Implementation Plan Bridge

## Mô tả
Từ PRD/BRD/ADR, sinh implementation plan chi tiết — tasks, dependencies, test strategy. Là cầu nối giữa SDLC documents và code.

## Kích hoạt
Khi user nói: "/sdlc-plan", "lên plan implement", "tạo implementation plan", "spec → code"
Hoặc chạy: `/sdlc-plan`

## Input
- PRD (features), BRD (use cases), ADR (components)
- Optional: existing implementation plan để update

## Output
- File: `docs/plan-<slug>-v1.0.0.md`
- Format: Markdown + YAML frontmatter + satisfaction score

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API. Skip nếu không muốn chia sẻ."
2. **Interview**: Hỏi về implementation priorities, timeline, constraints
3. **Gather docs**: Đọc PRD, BRD, ADR từ `docs/`
4. **Cross-ref satisfaction score**: Với mỗi feature PRD → đánh giá ✅/⚠️/❌
   - **Lưu ý**: Đây là rough estimate dựa trên LLM semantic comparison, không chính xác tuyệt đối
   - Kèm confidence field: `high` (có mapping rõ ràng), `medium` (suy luận), `low` (đoán)
   - Nếu confidence=low → ghi chú cho user kiểm tra lại
5. **Get template**: Gọi `sdlc_get_template` nếu MCP available; nếu throws error → dùng inline structure dưới đây
6. **Task decomposition**: Chia features thành implementation tasks với estimate
7. **Dependency analysis**: Xác định task dependencies
8. **Draft**: Viết implementation plan
9. **Output**: Ghi file + `git add` + `git commit`
10. **(Optional) Learn**: Hỏi user "Có lessons learned từ flow này không?"
    - Có → ghi vào `.opencode/lessons/sdlc-plan-<date>.md`
    - Không → skip

## Template (inline fallback)
```markdown
# Implementation Plan: <Feature>

## Tasks
### Task 1: <Name>
- Files: <paths>
- Dependencies: <none/task-X>
- Estimate: <hours>

## Test Strategy
- <approach>

## Risks
- <list>
```

## MCP Tools Used
- `sdlc_list_templates`
- `sdlc_get_template`

## Cross-ref
- Input từ: PRD (features), BRD (use cases), ADR (components)
- Output cho: code implementation, /sdlc-deploy
- Validation: `/project-doc-health` sau implementation
