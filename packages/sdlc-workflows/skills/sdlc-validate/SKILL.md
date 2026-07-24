---
id: sdlc-workflows-sdlc-validate
version: 1.0.0
standard: agile
category: flow
---

# SDLC: Cross-document Validator

## Mô tả
Validate consistency giữa các SDLC documents: PRD ↔ BRD ↔ ADR ↔ Test Plan ↔ Deploy. Phát hiện gaps, contradictions, outdated references.

## Kích hoạt
Khi user nói: "validate documents", "kiểm tra consistency", "cross-ref check", "/sdlc-validate"
Hoặc chạy: `/sdlc-validate`

## Input
- Paths đến các SDLC documents cần validate
- Optional: standard(s) để validate từng document

## Output
- Validation report in chat (Markdown table)
- Không ghi file — chỉ báo cáo

## Workflow
1. **Warn confidentiality**: "Thông tin docs bạn cung cấp sẽ được gửi lên LLM API để analyze."
2. **Discover documents**: Scan `docs/` directory tìm SDLC docs (PRD, BRD, Arch, Test Plan, Deploy)
3. **Auto-detect**: Nếu user không specify paths → tự detect tất cả SDLC docs trong docs/
4. **Grounding**: Đọc từng document, extract key info (features, requirements, components, test items)
5. **Validate individually**: Gọi `validate_document` cho mỗi document → collect errors/warnings
6. **Cross-ref check**: Dùng LLM để check consistency:
   - **PRD ↔ BRD**: Mỗi feature trong PRD có business requirement trong BRD không?
   - **BRD ↔ Arch**: Mỗi BR-F có architectural component đáp ứng không?
   - **Arch ↔ Test Plan**: Mỗi component có test item tương ứng không?
   - **Arch ↔ Deploy**: Deploy runbook có cover tất cả components không?
7. **Score**: Tính consistency score = (số cặp consistent / tổng số cặp) × 100
8. **Report**: Output validation report
9. **(Optional) Learn**: Hỏi user có lessons learned không?

## Template (inline fallback)
```markdown
# Cross-document Validation Report

## Summary
- **Documents analyzed**: <list>
- **Individual validation**: <pass/fail per doc>
- **Cross-ref consistency**: <score>%
- **Issues found**: <count>

## Per-document Results
| Document | Status | Errors | Warnings | Structure |
|---|---|---|---|---|
| PRD | ✅/❌ | <count> | <count> | good/fair/poor |

## Cross-ref Issues
| Pair | Issue | Severity |
|---|---|---|
| PRD → BRD | Feature X không có BR-F tương ứng | High |

## Score Breakdown
| Trace Pair | Consistent | Total | % |
|---|---|---|---|
| PRD ↔ BRD | <N> | <M> | <N/M*100> |

## Recommendations
- <Concrete action items>
```

## Principles
- Không sửa document — chỉ báo cáo
- Mỗi issue phải có severity (High/Med/Low)
- Score là rough estimate — dùng LLM semantic comparison
- Recommendations phải actionable

## Keywords
- validate, cross-ref, consistency, check, audit, document, review

## MCP Tools Used
- `validate_document({ documentPath, standard })`
- `sdlc_get_template` (nếu cần template để so sánh format)

## Cross-ref
- Input từ: tất cả SDLC docs (PRD, BRD, Arch, Test Plan, Deploy)
- Output cho: báo cáo — user tự sửa
- Retro: `/sdlc-retro` sau khi validate xong
