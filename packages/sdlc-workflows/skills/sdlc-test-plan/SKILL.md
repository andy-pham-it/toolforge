---
id: sdlc-workflows-sdlc-test-plan
version: 1.0.0
standard: iso-29119
category: flow
---

# SDLC: Test Plan Generator

## Mô tả
Sinh Test Plan theo ISO/IEC 29119 hoặc IEEE 829 standard. Hỏi về scope, strategy, environment, schedule, risks.

## Kích hoạt
Khi user nói: "viết test plan", "test strategy", "tạo test plan", "/sdlc-test-plan"
Hoặc chạy: `/sdlc-test-plan`

## Input
- Test scope, levels (unit/integration/system/acceptance)
- Test types (functional/performance/security)
- Environment requirements, schedule
- Optional: PRD, BRD, Architecture, Deploy runbook

## Output
- File: `docs/test-plan-<slug>-v1.0.0.md`
- Format: Markdown + YAML frontmatter (version, changelog, standard: iso-29119)

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API."
2. **Interview**: Hỏi project scope, test levels, environment, schedule, risk tolerance
3. **Auto-detect**: Nếu file output đã tồn tại → hỏi "update (v<N+1>) hay tạo mới?"
4. **Grounding**: Đọc PRD (features), BRD (business reqs), Arch (components) — map các đầu mục cần test
5. **Get template**: Gọi `sdlc_get_template({ templateId: 'test-plan/iso-29119' })` → nếu throws, dùng inline
6. **Draft**: Điền ISO 29119 template với test levels, strategy, environment, schedule
7. **Validate**: Mỗi feature trong PRD phải có test item tương ứng. Test schedule phải realistic. Entry/exit criteria phải measurable.
8. **Output**: Ghi file + `git add` + `git commit`
9. **(Optional) Learn**: Hỏi user có lessons learned không?

## Template (inline fallback)
```markdown
# Test Plan: <Project/Feature>

## 1. Test Plan Identifier
## 2. Test Items & Features
## 3. Test Strategy
### 3.1 Test Levels
### 3.2 Test Types
## 4. Test Environment
## 5. Test Data
## 6. Test Schedule
## 7. Roles & Responsibilities
## 8. Test Completion Criteria
## 9. Risks & Mitigation
## 10. Approvals
```

## Principles
- ISO/IEC 29119 hoặc IEEE 829 format
- Mỗi test level có entry + exit criteria rõ ràng
- Test items phải traceable đến features trong PRD
- Risks phải được prioritize (Impact × Probability)

## Keywords
- test, plan, strategy, iso-29119, ieee-829, quality, assurance, environment

## MCP Tools Used
- `sdlc_get_template({ templateId: 'test-plan/iso-29119' })`
- `sdlc_get_template({ templateId: 'test-plan/ieee-829' })`
- `validate_document({ documentPath, standard: 'iso-29119' })`

## Cross-ref
- Input từ: /sdlc-prd, /sdlc-brd, /sdlc-arch
- Output cho: /sdlc-deploy, /sdlc-plan
- Validation: /sdlc-validate (Phase 2)
- Retro: `/sdlc-retro` sau khi hoàn thành phase
