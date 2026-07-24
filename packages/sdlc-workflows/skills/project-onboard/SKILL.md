---
id: sdlc-workflows-project-onboard
version: 1.0.0
standard: agile
description: Phân tích codebase đã có, audit SDLC documents, detect conventions, sinh context rules cho AI agent
---

# SDLC: Project Onboard

## Mô tả
Phân tích codebase đã có, audit SDLC documents, detect conventions, sinh context rules cho AI agent. Dùng cho dự án đã có code, khác với `/project-init` (dành cho dự án mới chưa có code).

## Kích hoạt
Khi user nói: "/project-onboard", "onboard dự án", "phân tích codebase", "audit dự án"
Hoặc chạy: `/project-onboard`

Khi nào dùng /project-onboard thay vì /project-init:
- Đã có code, cần AI understand codebase → /project-onboard
- Chưa có code, cần setup từ đầu → /project-init

## Input
- Codebase path (current directory)
- Optional: project description

## Output
- File: `.opencode/config.jsonc` (nếu chưa có)
- File: `AGENTS.md` (codebase conventions audit)
- File: SDLC audit report (`docs/onboard-audit-<date>.md`)

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API. Bạn có thể skip nếu không muốn chia sẻ."
2. **Scan codebase**:
   - Độ sâu scan: depth=3, exclude node_modules/.git/.next/dist
   - Focus: package.json, tsconfig, imports pattern, file structure
   - Detect: tech stack, framework, testing, linting, CI/CD
3. **SDLC audit**:
   - Scan `docs/` cho SDLC documents (PRD, BRD, ADR, test plan, deploy)
   - Ghi chú: thiếu document nào, document nào outdated
   - Kiểm tra cross-ref: PRD feature → BRD? ADR → Test Plan?
4. **Gap analysis**: So sánh codebase complexity vs SDLC doc coverage
5. **Import existing docs**: Đọc SDLC docs có sẵn, parse YAML frontmatter
6. **Delta generation**: Sinh AGENTS.md rules dựa trên codebase conventions
7. **Get template**: Gọi MCP `sdlc_get_template` nếu available, nếu throws error → dùng inline structure dưới đây
8. **Output**: Ghi audit report + config + AGENTS.md
9. **Validate**: Kiểm tra cross-ref không mâu thuẫn
10. **(Optional) Learn**: Hỏi user "Có lessons learned từ flow này không?"
    - Có → ghi vào `.opencode/lessons/project-onboard-<date>.md`
    - Không → skip

## Template (inline fallback)
### SDLC Audit Report
```markdown
# SDLC Audit Report — <Project>

## Tech Stack
- <detected>

## SDLC Documents
- PRD: ✅/❌/⚠️ vX.Y.Z
- BRD: ✅/❌
- ADR: ✅/❌ vW.X.Y
- Test Plan: ✅/❌
- Deploy Runbook: ✅/❌

## Gap Analysis
- <findings>

## Recommendations
- <actions>
```

## Keywords
- onboard, onboarding, existing, legacy, setup, orient, documentation

## MCP Tools Used
- `sdlc_get_template` (nếu available)

## Cross-ref
- Input từ: codebase scan, existing docs
- Output cho: AGENTS.md, config
- Validation: `/project-doc-health` sau onboard
