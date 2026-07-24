---
id: sdlc-workflows-sdlc-arch
version: 1.0.0
standard: arc42
category: flow
---

# SDLC: Architecture Document Generator

## Mô tả
Sinh Architecture Document theo arc42 template (kèm C4 Model diagrams). Hỏi về system context, building blocks, runtime view, deployment.

## Kích hoạt
Khi user nói: "viết architecture", "kiến trúc hệ thống", "tạo architecture doc", "/sdlc-arch"
Hoặc chạy: `/sdlc-arch`

## Input
- System context, constraints, quality goals
- Technology stack, deployment strategy
- Key architectural decisions (ADRs)
- Optional: existing BRD, PRD để grounding

## Output
- File: `docs/arch-<slug>-v1.0.0.md`
- Format: Markdown + YAML frontmatter (version, changelog, standard: arc42)

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API."
2. **Interview**: Hỏi system purpose, tech stack, key design decisions, deployment model
3. **Auto-detect**: Nếu file output đã tồn tại → hỏi "update (v<N+1>) hay tạo mới?"
4. **Grounding**: Đọc PRD + BRD nếu có — lấy business requirements ảnh hưởng architecture (scale, security, integration)
5. **Get template**: Gọi `sdlc_get_template({ templateId: 'arch/arc42' })` → nếu throws, dùng inline
6. **Draft**: Điền arc42 template — context → constraints → building blocks → runtime → deployment → cross-cutting
7. **Validate**: Mỗi ADR có rationale + status. Chất lượng goal phải measurable
8. **Output**: Ghi file + `git add` + `git commit`
9. **(Optional) Learn**: Hỏi user có lessons learned không?

## Template (inline fallback)
```markdown
# Architecture: <System Name>

## 1. Introduction & Goals
## 2. Constraints
## 3. System Scope & Context
## 4. Solution Strategy
## 5. Building Block View
## 6. Runtime View
## 7. Deployment View
## 8. Cross-cutting Concepts
## 9. Architecture Decisions
## 10. Quality Requirements
## 11. Risks & Technical Debt
## 12. Glossary
```

## Principles
- arc42 format — 12 sections
- Mỗi architectural decision phải có rationale rõ ràng
- C4 diagrams phải consistent với building blocks
- Deployment view phải khả thi với tech stack

## MCP Tools Used
- `sdlc_get_template({ templateId: 'arch/arc42' })`
- `sdlc_get_template({ templateId: 'arch/c4-model' })`
- `validate_document({ documentPath, standard: 'arc42' })`

## Cross-ref
- Input từ: /sdlc-prd, /sdlc-brd, project-init config
- Output cho: /sdlc-test-plan, /sdlc-deploy, /sdlc-plan
- Validation: /sdlc-validate (Phase 2)
- Retro: `/sdlc-retro` sau khi hoàn thành phase
