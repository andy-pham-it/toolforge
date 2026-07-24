---
id: sdlc-workflows-project-init
version: 1.0.0
standard: agile
flow: init
type: skill
---

# SDLC: Project Init

## Mô tả
Khởi tạo project context cho AI agent — sinh AGENTS.md, .opencode/config.jsonc, và optional SDLC skills. Dùng khi bắt đầu dự án mới chưa có code.

## Kích hoạt
Khi user nói: "/project-init", "bắt đầu dự án mới", "init project", "setup project"
Hoặc chạy: `/project-init` hoặc `/project-init --upgrade`

## Input
- Project name, description, tech stack
- Project status: NEW / EXISTING / MIGRATION

## Output
- File: `.opencode/config.jsonc` (theo config `sdlc.*`)
- File: `AGENTS.md` (project rules)
- Format: Markdown + JSONC

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API. Skip nếu không muốn chia sẻ."
2. **Xác định mode**: Quick (~6 câu) hay Detailed (~14 câu)
3. **Interview**: Hỏi theo decision tree:
   - Quick: name, description, tech stack, AI agent, CI/CD, need SDLC flows?
   - Detailed: thêm project type, lang conventions, PM tool, doc standard, workflow automation, auth, testing, deploy target
4. **Auto-detect**: Nếu có file output → hỏi "update hay tạo mới?"
5. **Grounding**: Đọc package.json, tsconfig, docker-compose nếu có
6. **Get template**: Gọi `sdlc_get_template` nếu MCP available, nếu throws error → dùng inline structure dưới đây
7. **Draft**: Sinh AGENTS.md (NEW / EXISTING / MIGRATION variant), .opencode/config.jsonc với `sdlc.*` settings
8. **Validate**: Kiểm tra YAML frontmatter version, các trường bắt buộc
9. **Output**: Ghi file + `git add` + `git commit`
10. **(Optional) Learn**: Hỏi user "Có lessons learned từ flow này không?"
    - Có → ghi vào `.opencode/lessons/project-init-<date>.md`
    - Không → skip

## Template (inline fallback)

### AGENTS.md template
```markdown
# <Project Name>

## Tech Stack
- <list>

## AI Agent Rules
- <project-specific rules>
```

### .opencode/config.jsonc template
```jsonc
{
  "sdlc": {
    "templateVersion": "1.0.0",
    "standard": "agile",
    "mode": "hybrid",
    "docPath": "docs/",
    "language": "vi",
    "validation": {
      "crossRef": true,
      "principleCheck": true,
      "versionHistory": true
    }
  }
}
```

## Keywords
- project, init, initialization, setup, repository, dự án, khởi tạo

## MCP Tools Used
- `sdlc_get_template` (nếu available)
- `sdlc_list_templates` (để liệt kê templates cho user)

## Cross-ref
- Input từ: user requirements
- Output cho: tất cả SDLC skills (config)
- Validation: `/project-doc-health` sau khi init
