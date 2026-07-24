---
id: sdlc-workflows-sdlc-prd
version: 1.0.0
standard: agile
category: flow
---

# SDLC: PRD Generator

## Mô tả
Sinh Product Requirements Document (PRD) theo Agile standard. Hỏi về product vision, target users, features, success metrics.

## Kích hoạt
Khi user nói: "viết PRD", "product requirements", "tạo PRD", "/sdlc-prd"
Hoặc chạy: `/sdlc-prd`

## Input
- Product vision, target users, core problem
- Success metrics, epics/features hi-level
- Optional: existing BRD để cross-ref

## Output
- File: `docs/prd-<slug>-v1.0.0.md`
- Format: Markdown + YAML frontmatter (version, changelog)

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API."
2. **Interview**: Hỏi product vision, target users, problem, metrics, features
3. **Auto-detect**: Nếu file output đã tồn tại → hỏi "update (v<N+1>) hay tạo mới?"
4. **Grounding**: Đọc file BRD nếu có (cross-ref check)
5. **Get template**: Gọi `sdlc_get_template({ templateId: 'prd/agile-prd' })` → nếu throws error, dùng inline structure
6. **Draft**: Điền template theo Agile standard
7. **Validate**: Cross-ref — nếu BRD có use case không tương ứng feature PRD → WARNING. Kiểm tra principle (Agile Manifesto)
8. **Output**: Ghi file + `git add` + `git commit`
9. **(Optional) Learn**: Hỏi user có lessons learned không?

## Template (inline fallback)
```markdown
# PRD: <Product Name>

## 1. Vision
## 2. Target Audience
## 3. Problem Statement
## 4. Success Metrics
## 5. Epics & Features
## 6. User Stories (optional)
## 7. Release Criteria
## 8. Risks & Dependencies
## 9. Open Questions
```

## Principles
- Agile Manifesto principles apply — working software over comprehensive documentation
- Each feature must trace to a business goal
- Success metrics must be measurable

## MCP Tools Used
- `sdlc_get_template({ templateId: 'prd/agile-prd' })`
- `sdlc_get_standard({ standardId: 'agile-scrum' })`

## Cross-ref
- Input từ: user interview, project-init config
- Output cho: /sdlc-brd (Phase 2), /sdlc-plan
- Validation: Kiểm tra BRD reference nếu có
- Retro: `/sdlc-retro` sau khi hoàn thành phase
