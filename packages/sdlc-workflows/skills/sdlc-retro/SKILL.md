---
id: sdlc-workflows-sdlc-retro
version: 1.0.0
---

# SDLC: Retrospective

## Mô tả
Thực hiện retrospective sau khi hoàn thành phase/project — scan SDLC docs, phỏng vấn user, phân tích lessons learned, đề xuất cải tiến cho AGENTS.md và skills.

## Kích hoạt
Khi user nói: "/sdlc-retro", "retro", "rút kinh nghiệm", "lessons learned", "tổng kết"
Hoặc chạy: `/sdlc-retro`

## Input
- Previous SDLC docs (PRD, BRD, ADR, Test Plan, Deploy)
- Optional: git history, .opencode/lessons/ files

## Output
- File: `docs/retro-<phase>-v1.0.0.md`
- Format: Markdown + YAML frontmatter
- Optional updates: AGENTS.md, skill improvements

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API. Skip nếu không muốn chia sẻ."
2. **Scan context**: Thu thập SDLC docs từ `docs/`, git log, `.opencode/lessons/`
3. **Interview**: Hỏi user:
   - "Điều gì tốt trong phase này?" (Start Doing)
   - "Điều gì chưa tốt?" (Stop Doing)
   - "Cần thay đổi gì?" (Continue Doing)
4. **Analyze**: So sánh plan vs actual — features done/dropped, timeline deviation
5. **Synthesize**: Viết retro report theo format Start/Stop/Continue/Action Items
6. **Recommend**: Đề xuất cập nhật AGENTS.md rules hoặc skill improvements nếu cần
7. **Output**: Ghi file + `git add` + `git commit`
8. **Learn phase**: Ghi lessons vào `.opencode/lessons/<phase>-<date>.md`

## Keywords
- retro, retrospective, lessons, learned, review, improve, continuous

## MCP Tools Used
- `sdlc_list_templates` (để tham khảo template list nếu cần)

## Cross-ref
- Input từ: tất cả SDLC docs, lessons files, git history
- Output cho: AGENTS.md updates, skill improvements, next phase planning
