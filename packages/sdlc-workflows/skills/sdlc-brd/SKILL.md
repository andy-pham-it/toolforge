---
id: sdlc-workflows-sdlc-brd
version: 1.0.0
standard: ieee-29148
category: flow
---

# SDLC: BRD Generator

## Mô tả
Sinh Business Requirements Document (BRD) theo IEEE 29148 standard. Hỏi về business context, stakeholders, business requirements, use cases.

## Kích hoạt
Khi user nói: "viết BRD", "business requirements", "tạo BRD", "/sdlc-brd"
Hoặc chạy: `/sdlc-brd`

## Input
- Business context, stakeholders, business goals
- BR-F functional requirements, BR-NF non-functional requirements
- Use cases, business rules
- Optional: existing PRD để cross-ref

## Output
- File: `docs/brd-<slug>-v1.0.0.md`
- Format: Markdown + YAML frontmatter (version, changelog, standard: ieee-29148)

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API."
2. **Interview**: Hỏi business context, stakeholders, top business requirements, use cases
3. **Auto-detect**: Nếu file output đã tồn tại → hỏi "update (v<N+1>) hay tạo mới?"
4. **Grounding**: Đọc file PRD nếu có (cross-ref check — BR-F phải trace được từ vision)
5. **Get template**: Gọi `sdlc_get_template({ templateId: 'brd/ieee-29148' })` → nếu throws error, dùng inline structure
6. **Draft**: Điền template theo IEEE 29148 — business context → stakeholders → requirements → use cases → rules → metrics
7. **Validate**:
   - Cross-ref với PRD: mỗi BR-F cần trace đến 1 feature trong PRD
   - Mỗi use case cần có actor, trigger, flow, postcondition
   - Business rules cần có source (regulation/policy)
8. **Output**: Ghi file + `git add` + `git commit`
9. **(Optional) Learn**: Hỏi user có lessons learned không?

## Template (inline fallback)
```markdown
# BRD: <Project Name>

## 1. Business Context
## 2. Stakeholders & Roles
## 3. Business Requirements
### 3.1 Functional (BR-F)
### 3.2 Non-Functional (BR-NF)
## 4. Use Cases
## 5. Business Rules
## 6. Assumptions & Constraints
## 7. Success Metrics
## 8. Glossary
## 9. Open Questions
```

## Principles
- IEEE 29148 format — các section phải đầy đủ
- Mỗi business requirement phải traceable đến business goal
- Use cases phải có pre/post conditions rõ ràng
- Non-functional requirements phải có metric đo được

## MCP Tools Used
- `sdlc_get_template({ templateId: 'brd/ieee-29148' })`
- `validate_document({ documentPath, standard: 'ieee-29148' })`

## Cross-ref
- Input từ: /sdlc-prd, project-init config
- Output cho: /sdlc-arch, /sdlc-test-plan, /sdlc-plan
- Validation: PRD cross-ref (Phase 1), /sdlc-validate (Phase 2)
- Retro: `/sdlc-retro` sau khi hoàn thành phase
