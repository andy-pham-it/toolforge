---
id: sdlc-workflows-project-doc-health
version: 1.0.0
standard: agile
description: Scan docs/ và báo cáo tình trạng SDLC documents — version, cross-ref, template version drift
---

# SDLC: Project Doc Health

## Mô tả
Scan `docs/` và báo cáo tình trạng SDLC documents — version, cross-ref, và template version drift.

## Kích hoạt
Khi user nói: "/project-doc-health", "health check", "kiểm tra tài liệu", "doc audit"
Hoặc chạy: `/project-doc-health`

## Input
- Codebase path (tự động scan)
- Optional: specific doc type to check

## Output
- Terminal report (bảng ngắn)

## Workflow
1. **Warn confidentiality**: Skip nếu không muốn chia sẻ.
2. **Scan docs/**: Tìm files match patterns: `prd*.md`, `brd*.md`, `adr*.md`, `test-plan*.md`, `deploy*.md`
3. **Parse YAML frontmatter**: version, status, updated date
4. **Cross-ref check**: Keyword matching — nếu BRD reference feature không có trong PRD → WARNING
5. **Version drift check**: Đọc `.opencode/manifests/sdlc-workflows.json` → so sánh `installedVersion` với config's `sdlc.templateVersion`. Nếu mismatch → cảnh báo + gợi ý `npm update @andy-toolforge/sdlc-workflows`
6. **Output bảng**:

```
📋 SDLC Doc Health Report — <project>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD: ✅ v1.2.0 (updated 2026-07-22)
BRD: ❌ Missing (gợi ý: chạy /sdlc-brd)
ADR: ⚠️ v1.0.0 nhưng PRD đã update → có thể cần review
Deploy: ❌ Missing

Cross-ref:
  PRD Feature "Auth" → BRD: ❌ không có use case tương ứng

Template drift:
  Installed: 0.1.0 | Config pin: 1.0.0 → ⚠️ Cập nhật package
```

7. **(Optional) Learn**: Hỏi user có lessons learned không?
    - Có → ghi vào `.opencode/lessons/project-doc-health-<date>.md`
    - Không → skip

## Keywords
- document, health, audit, check, quality, drift, version, outdated

## MCP Tools Used
- `sdlc_list_templates` (để so sánh với installed templates)

## Drift Detection (Phase 3)
- Gọi `sdlc_check_version` để kiểm tra version drift
- Nếu driftDetected == true → cảnh báo user: "SDLC Workflows package version mismatch — run 'npm update @andy-toolforge/sdlc-workflows'"

## Cross-ref
- Input từ: `/project-init` (config), `/project-onboard` (baseline)
- Output cho: developer biết cần update doc nào
- Validation: `/sdlc-retro` nếu phát hiện nhiều docs outdated
