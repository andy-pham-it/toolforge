---
id: sdlc-workflows-sdlc-deploy
version: 1.0.0
---

# SDLC: Deploy Runbook Generator

## Mô tả
Sinh deploy runbook theo ITIL hoặc SRE standard — deployment steps, rollback plan, monitoring, incident response.

## Kích hoạt
Khi user nói: "/sdlc-deploy", "viết runbook", "deploy plan", "tạo deploy document"
Hoặc chạy: `/sdlc-deploy`

## Input
- Service name, architecture overview
- Deployment environment(s)
- Runbook type: ITIL (traditional) or SRE (SLO-based)

## Output
- File: `docs/deploy-<slug>-v1.0.0.md`
- Format: Markdown + YAML frontmatter

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API. Skip nếu không muốn chia sẻ."
2. **Interview**: Hỏi service overview, architecture, CI/CD pipeline, monitoring, on-call rotation
3. **Auto-detect**: Nếu file output tồn tại → hỏi "update (v<N+1>) hay tạo mới?"
4. **Grounding**: Đọc ADR nếu có (component dependencies, infrastructure decisions)
5. **Get template**: Gọi `sdlc_get_template({ templateId: 'deploy/itil-runbook' })` hoặc `deploy/sre-runbook` tùy user chọn. Nếu throws error → dùng inline structure dưới đây
6. **Draft**: Điền template theo ITIL/SRE standard
7. **Validate**: Cross-ref — nếu ADR reference component không có trong runbook → WARNING
8. **Output**: Ghi file + `git add` + `git commit`
9. **(Optional) Learn**: Hỏi user "Có lessons learned từ flow này không?"
   - Có → ghi vào `.opencode/lessons/sdlc-deploy-<date>.md`
   - Không → skip

## Template (inline fallback)
```markdown
# Deploy Runbook: <Service Name>

## 1. Service Overview
## 2. Architecture
## 3. Deployment Steps
## 4. Rollback Plan
## 5. Monitoring & Alerts
## 6. Incident Response
## 7. Backup & Recovery
## 8. Runbook Type Notes
```

## Keywords
- deploy, deployment, runbook, operations, itil, sre, release

## MCP Tools Used
- `sdlc_get_template({ templateId: 'deploy/itil-runbook' })`
- `sdlc_get_template({ templateId: 'deploy/sre-runbook' })`
- `sdlc_get_standard({ standardId: 'itil-sre' })`

## Cross-ref
- Input từ: ADR (component dependencies), user interview
- Output cho: DevOps/SRE team
- Validation: ADR component coverage
