# SDLC Agent Flows — Design Document

> Bản quyền thuộc @andy-toolforge
> Trạng thái: **Refined** | Phiên bản: v3.0 | Ngày: 2026-07-24
> Cập nhật: v3.0 — Phase 3 ✅ completed (template engine, version registry, skill discovery, glob scan, CI).

> [!NOTE] **Design Decisions (v2.5)**
> 1. **Package structure** (Issue A/D): Giữ 1 package `@andy-toolforge/sdlc-workflows` thay vì tách riêng MCP server. MCP tools là plugin tools (`mcp-tools.js`), auto-discovered bởi `@andy-toolforge/mcp`. Lý do: giảm config complexity cho end-user (1 `npm install` thay 2), template đọc từ `__dirname + '/templates/'`. **Verified:** `__dirname` hoạt động đúng khi MCP load plugin tools qua `require(mcpToolsPath)`. Fallback: `require.resolve('@andy-toolforge/sdlc-workflows/mcp-tools.js')` nếu path sai.
> 2. **Template fallback** (Issue C): Mỗi SKILL.md nhúng sẵn inline template structure. Nếu MCP tool `sdlc_get_template` không available → dùng inline, không fail. Resolution order: local `.opencode/templates/` → MCP → inline. **Detection:** AI dùng `try-catch` khi gọi MCP tool — nếu throws → fallback ngay. Xem Section 7.2 step 5.
> 3. **Version drift** (Issue B): Approach B — `postinstall.js` copy templates + ghi version manifest `.opencode/manifests/sdlc-workflows.json`. `project-doc-health` detect drift. **Verified `installSkills()` signature:** `installSkills({ domain: string, sourceDir: string })` với `sourceDir` là absolute path. Symlinks .md files thành `.opencode/skills/<domain>-<filename>.md`.
> 4. **Testing** (Issue E): 3 tầng — (1) structural YAML tests (review tay, Phase 1), (2) template correctness JS tests (Phase 2), (3) agent behavior không test trực tiếp, dùng retro feedback loop thay thế.
> 5. **Cross-doc validation**: Dời lên Phase 1 (per-skill lightweight) thay vì đợi Phase 2 riêng.
> 6. **Satisfaction score** (Issue D, new): sdlc-plan's "% requirements coverage" là **rough estimate** — LLM-based semantic comparison không chính xác tuyệt đối. Cần confidence field (high/medium/low) để user biết mức độ tin cậy. Xem Section 3.5.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
   - [SDLC Lifecycle — Thứ tự tự nhiên](#13-sdlc-lifecycle--thứ-tự-tự-nhiên)
2. [Flow 1 — Project Init](#2-flow-1--project-init)
   - [Flow 1b — Project Onboard](#27-flow-1b--project-onboard-dành-cho-existing-projects)
3. [Flow 2 — SDLC Document Flows](#3-flow-2--sdlc-document-flows)
   - [Cross-document Validation](#35-cross-document-validation)
   - [Project Doc Health](#36-project-doc-health)
4. [Template Architecture](#4-template-architecture)
   - [Auto-generated Manifest](#42-manifest-auto-generated)
   - [Skill Test Mechanism](#45-skill-test-mechanism)
5. [Quyết định Kiến trúc: MCP qua plugin tools, inline fallback](#5-quyết-định-kiến-trúc-mcp-qua-plugin-tools-inline-fallback)
6. [Lộ trình (Roadmap)](#6-lộ-trình-roadmap)
7. [Bàn giao cho Toolforge Team](#7-bàn-giao-cho-toolforge-team)

---

## 1. Tổng quan

### 1.1 Vấn đề

Khi bắt đầu một dự án mới hoặc cần viết tài liệu SDLC (PRD, BRD, ADR, Test Plan, Deploy Runbook):

- **Không có chuẩn hóa**: Mỗi lần làm lại từ đầu, thiếu consistency
- **Agent không có context**: Phải hỏi lại những thông tin cơ bản
- **Không có template chuẩn**: Tài liệu không theo IEEE, ISO, Arc42,... gây khó review
- **Không có quy trình**: Bỏ sót bước, thiếu cross-reference giữa các document

### 1.2 Giải pháp

Ba flow agentic, chạy trong OpenCode:

| Flow | Đối tượng | Đầu ra |
|---|---|---|---|
| `/project-init` | Developer khi start project mới | AGENTS.md, config.jsonc, default-flow skill |
| `/project-onboard` | Developer với dự án đã có code | SDLC audit, gap analysis, doc import, context rules |
| SDLC Docs (6 skills) | PM, BA, Architect, QA, DevOps, Developer | Tài liệu chuẩn + Implementation plan bridge |
| `/sdlc-retro` | Whole team / Developer | Lessons learned report, AGENTS.md/skill updates |

### 1.3 SDLC Lifecycle — Thứ tự tự nhiên

Các flow không chạy độc lập — chúng theo lifecycle tự nhiên của dự án:

```
Start Project
  │
  ├─ Chưa có code?       → /project-init     (setup AGENTS.md, config)
  └─ Đã có code?         → /project-onboard  (scan, audit, import)

Init completed
  │
  ├─ PM viết PRD         → /sdlc-prd         (product vision, features)
  ├─ BA refine           → /sdlc-brd         (use cases, business rules)
  ├─ Architect thiết kế  → /sdlc-arch        (system design, ADR)
  ├─ QA lên test plan    → /sdlc-test-plan   (test cases, coverage)
  ├─ Dev implement       → /sdlc-plan → code (spec → implementation bridge)
  └─ Deploy              → /sdlc-deploy      (runbook, rollback plan)

Maintain
  ├─ Thay đổi spec       → /sdlc-prd --update (auto-detect, version bump)
  ├─ Codebase thay đổi   → /project-doc-health (check cross-refs, stale docs)
  ├─ Onboard new member  → /project-onboard   (generate context docs)
  └─ Phase/project done  → /sdlc-retro        (lessons learned, update AGENTS.md/skills)
       │
       └──→ Back to Init/PRD for next iteration (feedback loop)
```

Mỗi giai đoạn output của flow trước là input của flow sau, đảm bảo cross-ref không mâu thuẫn.

### 1.4 Nguyên tắc thiết kế

1. **Principle-first**: Mọi tài liệu phải được validate bởi principles gốc (Agile Manifesto, IEEE, ISO)
2. **Cross-reference**: PRD → BRD → ADR → Test Plan → Deploy không mâu thuẫn
3. **Version history**: Mọi output đều có YAML frontmatter version + git commit
4. **OpenCode-first**: Skills trong toolforge package, templates qua MCP nhẹ
5. **Không over-engineering**: MCP nhẹ ngay Phase 1 (template-serving), mở rộng khi scale
6. **Confidentiality-aware**: Mỗi skill cảnh báo user trước khi hỏi thông tin nhạy cảm (vision, OKRs, architecture). User có thể skip câu hỏi, skill auto-detect từ context có sẵn.

---

## 2. Flow 1 — Project Init

### 2.1 Mục đích

Khi developer chạy `/project-init`, AI sẽ:
1. Hỏi ~6-14 câu (tuỳ mode) để thu thập context
2. Tự động sinh AGENTS.md, .opencode/config.jsonc, AGENTS.md rules
3. Nếu ở Detailed Mode: thêm .opencode/skills/default-flow/SKILL.md + templates cho SDLC flows

### 2.2 Decision Tree

```
                    ┌─────────────────────────────┐
                    │   /project-init              │
                    │   (Quick or Detailed?)        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Project Status?             │
                    │  NEW / EXISTING / MIGRATION   │
                    └─────────────┬───────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
     ┌──────────┐         ┌──────────────┐      ┌──────────────┐
     │  NEW     │         │  EXISTING    │      │  MIGRATION   │
     │         │         │              │      │               │
     │• New repo│         │• Has code    │      │• Từ X sang Y  │
     │• No code │         │• Needs rules │      │• Cần adapter  │
     │• Full    │         │• Scan & gen  │      │• Bridge rules │
     │  setup   │         │  delta       │      │  + delta      │
     └────┬─────┘         └──────┬───────┘      └──────┬────────┘
          │                     │                      │
          └─────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    OUTPUT:            │
                    │ • .opencode/config    │
                    │ • AGENTS.md           │
                    │ • templates/ (Detail) │
                    │ • default-flow skill  │
                    └───────────────────────┘
```

### 2.3 Quick Mode (~6 câu, ~2 phút)

| # | Câu hỏi | Mục đích |
|---|---|---|
| 1 | Tên & mô tả project | Identity |
| 2 | Tech stack chính? | Rules generation |
| 3 | AI agent(s) nào dùng? (OpenCode/ClaudeCode/Codex/Other) | Compat profile |
| 4 | Có dùng CI/CD không? (GitHub Actions, GitLab, Không) | Config gen |
| 5 | Cần SDLC flows không? (Có/Không/Sau) | Template + skill install |
| 6 | Quick hay Detailed cho lần này? | Mode confirm |

**Upgrade path**: User có thể chạy lại `/project-init --upgrade` sau này để chuyển từ Quick → Detailed, hoặc cập nhật config khi tech stack thay đổi.

### 2.4 Detailed Mode (+8 câu, ~5-7 phút)

Thêm các câu:

| # | Câu hỏi | Mục đích |
|---|---|---|
| 7 | Project type? (App/Library/Service/Docs/Monorepo) | Structure gen |
| 8 | Programming language conventions? (TS/JS/Python/Go/Rust) | Lint rules |
| 9 | Project management? (Jira/GitHub Projects/Trello/Không) | Config |
| 10 | Documentation standard? (Agile/IEEE/Hybrid) | SDLC mode |
| 11 | Cần workflow automation? (Commit hooks/PR template/Release) | Hooks |
| 12 | Auth & secrets? (Env vars/Vault/1Password CLI) | Security |
| 13 | Testing strategy? (Unit/Integration/E2E/None) | Test rules |
| 14 | Deployment target? (Vercel/AWS/Docker/K8s/None) | Deploy config |

### 2.5 Outputs (Detailed Mode)

```
<project-root>/
├── AGENTS.md                    # Context + rules cho agent
├── .opencode/
│   ├── config.jsonc             # SDK config + sdlc.* settings
│   └── skills/
│       └── default-flow/
│           └── SKILL.md         # Default workflow skill
└── .opencode/templates/         # Nếu cần override (optional)
    ├── standards/
    └── flows/

> **default-flow skill**: Skill fallback được cài bởi /project-init, xử lý các request không khớp skill cụ thể. Ví dụ user nói "start working" → default-flow chạy interview → xác định đây là feature dev → gợi ý dùng skill phù hợp hoặc chạy workflow mặc định.
```

### 2.6 Handoff Checklist cho Toolforge Team

- [ ] Skill: `project-init/SKILL.md` — cấu trúc interview tree (Quick + Detailed)
- [ ] Skill: `project-init/SKILL.md` — skill install tự động qua `postinstall.js` (dùng `installSkills()` từ core)
- [ ] Skill: `project-init/SKILL.md` — AGENTS.md template variants (NEW / EXISTING / MIGRATION)
- [ ] MCP: Tools auto-discover qua `mcp-tools.js` plugin — không cần sinh `mcp.json`
- [ ] Config: Sinh `.opencode/config.jsonc` với `sdlc.*` settings
- [ ] Fallback: Khi user không trả lời hết câu hỏi → auto-detect từ git/fs/package.json
- [ ] Upgrade: `/project-init --upgrade` cho phép chuyển Quick→Detailed, cập nhật tech stack
- [ ] Large codebase scan: depth=3, exclude node_modules/.git/.next/dist, focus package.json/tsconfig/imports pattern

### 2.7 Flow 1b — Project Onboard (dành cho existing projects)

#### 2.7.1 Mục đích

Khi developer chạy `/project-onboard` trong một repo đã có code, AI sẽ:

1. **Discover**: Scan codebase structure, ngôn ngữ, framework, conventions
2. **Audit**: Kiểm tra SDLC documents hiện có (nếu không có → gap analysis)
3. **Import**: Đọc documents đã tồn tại, tạo YAML frontmatter + version history nếu thiếu
4. **Delta gen**: Chỉ tạo documents còn thiếu (không làm lại cái đã có)
5. **Context rules**: Sinh AGENTS.md rules dựa trên codebase thực tế (không interview)

#### 2.7.2 So sánh với /project-init

| Khía cạnh | `/project-init` | `/project-onboard` |
|---|---|---|
| Target | Repository mới, chưa có code | Repository đã có codebase |
| Cách tiếp cận | Interview-based (hỏi ~6-14 câu) | Discovery-based (scan codebase) |
| Output | AGENTS.md từ câu trả lời | AGENTS.md từ codebase analysis |
| SDLC docs | Tạo mới toàn bộ | Audit + Import + Delta |
| Template install | Có (detailed mode) | Có (nếu thiếu, auto-install) |

#### 2.7.3 Discovery Process

```
/project-onboard
  │
  ├─ 1. Scan structure ──► package.json, tsconfig, Dockerfile, CI config
  │      ├── Ngôn ngữ: TypeScript? Python? Go?
  │      ├── Framework: Next.js? Express? FastAPI?
  │      └── Pattern: Monorepo? Single? Microservices?
  │
  ├─ 2. Convention detection ──► Coding style, branch naming, commit messages
  │      ├── Lint config: ESLint? Ruff? golangci-lint?
  │      ├── Test framework: Jest? pytest? Vitest?
  │      └── Commit style: Conventional Commits? Free-form?
  │
  ├─ 3. SDLC audit ──► Check docs/ directory
  │      ├── PRD? BRD? ADR? Test Plan? Deploy Runbook?
  │      ├── Có YAML frontmatter không? Version history?
  │      └── Gap analysis: còn thiếu document nào?
  │
  ├─ 4. Import existing docs ──► Inject frontmatter + version
  │      └── (không modify nội dung, chỉ metadata)
  │
  ├─ 5. Context rules ──► Sinh AGENTS.md rules
  │      ├── Tech stack rules
  │      ├── Coding conventions
  │      └── SDLC template path
  │
  ├─ 6. Install skills ──► postinstall.js với installSkills()
  │      └── SDLC skills + templates
  │
  └─ 7. Report ──► "Đã onboard. Phát hiện: [...]. Thiếu: [...]. Gợi ý: [...]"
```

#### 2.7.4 Interview (tối thiểu)

Không như `/project-init` hỏi chi tiết, `/project-onboard` chỉ hỏi **1-2 câu confirm**:

1. "Đã phát hiện project `<name>` với stack `<lang> + <framework>`. Có muốn tùy chỉnh rules gì không?" (Nếu không → auto-detect là đủ)
2. "Phát hiện thiếu `<list>` documents. Có muốn tôi sinh không?" (Yes → gọi SDLC skill tương ứng)

#### 2.7.5 Handoff Checklist

- [ ] Skill: `project-onboard/SKILL.md` — discovery + audit + import + delta gen
- [ ] Skill: `project-onboard/SKILL.md` — convention detection (lint, test, commit style)
- [ ] Skill: `project-onboard/SKILL.md` — SDLC gap analysis
- [ ] Skill: `project-onboard/SKILL.md` — AGENTS.md rule generation (từ scan, không interview)
- [ ] Fallback: scan depth=3, exclude node_modules/.git/.next/.venv
- [ ] Import: chỉ thêm metadata, không modify nội dung gốc

---

## 3. Flow 2 — SDLC Document Flows

### 3.1 Kiến trúc tổng thể

Mỗi flow là một SKILL.md riêng trong toolforge package. Toàn bộ package structure:

```
@andy-toolforge/sdlc-workflows/
├── package.json
├── index.js                    # Exports (nếu cần sau này)
├── mcp-tools.js                # Plugin tools cho @andy-toolforge/mcp
├── postinstall.js              # installSkills() — copy skills + sinh manifest
├── lib/                        # Code thật (nếu cần sau này — trống Phase 1)
├── skills/
│   ├── project-init/
│   │   ├── SKILL.md
│   │   └── test/
│   │       └── basic-init.yaml
│   ├── project-onboard/
│   │   └── SKILL.md
│   ├── project-doc-health/
│   │   └── SKILL.md
│   ├── sdlc-prd/
│   │   └── SKILL.md
│   ├── sdlc-deploy/
│   │   └── SKILL.md
│   ├── sdlc-plan/
│   │   └── SKILL.md
│   └── sdlc-retro/
│       └── SKILL.md
├── templates/
│   ├── standards/
│   │   ├── agile-scrum.md
│   │   └── itil-sre.md
│   └── flows/
│       ├── prd/agile-prd.md
│       └── deploy/
│           ├── itil-runbook.md
│           └── sre-runbook.md
└── test/                       # Integration tests (Phase 1+)
    └── templates/
        ├── basic-prd.yaml
        └── basic-deploy.yaml
```

> Lưu ý: AGENTS.md per-skill bị loại bỏ (OpenCode chỉ đọc root AGENTS.md). Thay bằng `context-rules.md` — skill inject nội dung file này vào prompt khi chạy.

### 3.2 Flow chi tiết từng skill

#### 3.2.1 sdlc-prd (Product Requirements Document)

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "cần viết PRD", "/sdlc-prd" |
| **Đối tượng** | PM, Product Owner |
| **Standards** | Agile PRD (light) — IEEE 29148 reference notes chỉ trong SKILL.md |
| **Đầu vào** | Vision statement, user segments, OKRs |
| **Đầu ra** | `docs/prd-v1.md` hoặc theo config |
| **Cross-ref** | → BRD, → ADR |

**Interview questions (tối thiểu):**
1. Product vision? (1-2 câu)
2. Target users / segments?
3. Core problem solving?
4. Success metrics? (OKRs/KPIs)
5. Timeline & milestones?
6. Constraints? (tech/business/regulatory)

**Mẫu output (Agile PRD):**
```markdown
# PRD: <Product Name>
Version: 1 | Status: Draft | Date: YYYY-MM-DD

## 1. Vision
## 2. Target Users
## 3. Problem Statement
## 4. Goals & Success Metrics
## 5. Features (Moscow: M/S/W/C)
## 6. User Stories (Epic → Story → Acceptance)
## 7. Timeline & Milestones
## 8. Risks & Mitigations
## 9. Open Questions
```

#### 3.2.2 sdlc-brd (Business Requirements Document)

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "cần BRD", "/sdlc-brd" |
| **Đối tượng** | BA, Business Analyst |
| **Standards** | IEEE 29148, Use Case 2.0 |
| **Đầu vào** | PRD (cross-ref) |
| **Đầu ra** | `docs/brd-v1.md` |
| **Cross-ref** | ← PRD, → ADR, → Test Plan |

**Interview questions:**
1. Business processes impacted?
2. Stakeholders involved?
3. Current workflow (as-is)?
4. Desired workflow (to-be)?
5. Business rules & policies?
6. Data entities & relationships?
7. Exception scenarios?

#### 3.2.3 sdlc-arch (Architecture Decision Record)

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "cần ADR", "/sdlc-arch" |
| **Đối tượng** | Architect, Tech Lead |
| **Standards** | Arc42, C4 Model |
| **Đầu vào** | PRD, BRD |
| **Đầu ra** | `docs/adr-v1.md` |
| **Cross-ref** | ← PRD, ← BRD |

**C4 Context:**
- Context diagram (system boundary)
- Container diagram (services)
- Component diagram (modules)
- Code diagram (classes, nếu cần)

#### 3.2.4 sdlc-test-plan

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "cần test plan", "/sdlc-test-plan" |
| **Đối tượng** | QA, Test Lead |
| **Standards** | ISO 29119, IEEE 829 |
| **Đầu vào** | PRD, BRD, ADR |
| **Đầu ra** | `docs/test-plan-v1.md` |
| **Cross-ref** | ← BRD, ← ADR |

#### 3.2.5 sdlc-deploy (Deploy Runbook)

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "cần deploy runbook", "/sdlc-deploy" |
| **Đối tượng** | DevOps, SRE |
| **Standards** | ITIL, SRE Best Practices |
| **Đầu vào** | ADR |
| **Đầu ra** | `docs/deploy-runbook-v1.md` |

#### 3.2.6 sdlc-plan (Implementation Plan Bridge) — Phase 1

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "/sdlc-plan" sau khi có PRD/BRD/ADR, hoặc "cần implement" |
| **Đối tượng** | Developer |
| **Standard** | OpenCode implementation workflow |
| **Đầu vào** | PRD, BRD, ADR (auto-detect từ `docs/`) |
| **Đầu ra** | Implementation plan + handoff đến OpenCode skills |
| **Cross-ref** | ← PRD, ← BRD, ← ADR |

**Vai trò:** `/sdlc-plan` là cầu nối duy nhất giữa "có spec" và "bắt đầu code". Nó **không tự viết code** — nó đọc các SDLC documents, tổng hợp thành implementation plan, và gọi các OpenCode skills có sẵn.

**Workflow:**

```
/sdlc-plan
  │
  ├─ 1. Scan docs/ ──► PRD? BRD? ADR? (cảnh báo nếu thiếu)
  │
  ├─ 2. Synthesize ──► Tổng hợp features, use cases, components
  │
  ├─ 3. Assess       ──► Có đủ context để implement không?
  │      │                Nếu thiếu → hỏi thêm
  │      │                Nếu đủ   → proceed
  │
  ├─ 4. Generate plan ──► Implementation plan (theo OpenCode format)
  │
  ├─ 5. Handoff ──► OpenCode skills:
  │      ├── brainstorming  (features khó, chưa rõ)
  │      ├── code-architect (kiến trúc implementation)
  │      ├── writing-plans  (breakdown tasks)
  │      └── executing-plans (chạy implementation)
  │
  └─ 6. Track ──► Cross-doc satisfaction score:
                   Feature X → trong implementation? ✅/❌
                   Use Case Y → trong implementation? ✅/❌
```

**Cross-doc satisfaction score:**
Mỗi feature trong PRD, mỗi use case trong BRD, mỗi component trong ADR được đánh dấu:
- ✅ Covered = có implementation task tương ứng
- ⚠️ Partial = có đề cập nhưng chưa đầy đủ
- ❌ Missing = không có implementation task

**Interview questions (tối thiểu):**
1. Scope: Implement tất cả features trong PRD hay subset?
2. Priority: Feature nào làm trước?
3. Constraints: Budget thời gian? Resource?
4. Approach: Có architectural decision nào cần resolve trước khi code?

**Output example:**
```markdown
# Implementation Plan: <Project/Feature>

## Scope
- PRD v1.2: Features M1, M2, S1 (Must-have + Should-have)
- BRD v1.1: Use Cases UC-01, UC-02, UC-03
- ADR v1.0: Component Auth, Payment, Notifications

## Tasks
1. [Auth] Implement login flow (brainstorming → code-architect → executing-plans)
2. [Payment] Integrate Stripe (code-architect → executing-plans)
3. [Notifications] Email + Push (writing-plans → executing-plans)

## Cross-doc Satisfaction
- PRD: 3/3 features covered ✅
- BRD: 3/3 use cases covered ✅
- ADR: 3/3 components covered ✅

## Handoff
→ Gọi brainstorming cho Task 1
→ Gọi code-architect cho Task 2
...
```

#### 3.2.7 sdlc-retro (Retrospective & Lessons Learned) — Phase 1

| Thuộc tính | Giá trị |
|---|---|
| **Trigger** | User: "cần retrospective", "/sdlc-retro", sau khi hoàn thành project phase |
| **Đối tượng** | Whole team / Developer |
| **Standard** | Agile Retrospective (Start/Stop/Continue), After Action Review (US Army) |
| **Đầu vào** | Git log, SDLC docs (`docs/`), optionally user reflection |
| **Đầu ra** | `.opencode/lessons/<project>-retro-v1.md` + optional AGENTS.md/skill updates |
| **Cross-ref** | ← PRD, ← BRD, ← ADR, ← Plan, ← Deploy (tất cả flows) |

**Vai trò:** `/sdlc-retro` đóng vòng lặp học hỏi. Sau khi một phase/project hoàn thành, nó tổng hợp:
1. **Điều gì đã tốt?** (cần giữ lại)
2. **Điều gì cần cải thiện?** (thay đổi cách làm)
3. **Hành động cụ thể** (sửa AGENTS.md? Cập nhật skill? Thay đổi template?)
4. **Cập nhật knowledge base** (Serena memory, `.opencode/lessons/`)

**Workflow:**
```
/sdlc-retro
  │
  ├─ 1. Scan context: git log (recent commits), SDLC docs (versions), 
  │      .opencode/lessons/ (previous retros)
  │
  ├─ 2. Interview (tối thiểu):
  │      - "Phase/project nào cần retro?"
  │      - "Có điều gì cần đặc biệt lưu ý không?"
  │      (Nếu user không trả lời → auto-detect từ git log)
  │
  ├─ 3. Analyze:
  │      - Git log pattern: frequent reverts? long PR cycles? many review iterations?
  │      - SDLC doc health: cross-ref drift? version churn?
  │      - So sánh với retro trước (nếu có)
  │
  ├─ 4. Synthesize ──► Lessons learned report (Start/Stop/Continue)
  │
  ├─ 5. Recommend actions:
  │      - "Cập nhật AGENTS.md với pattern X"
  │      - "Thêm check Y vào skill workflow"
  │      - "Sửa template Z cho rõ hơn"
  │
  └─ 6. Output ──► Ghi `.opencode/lessons/<project>-retro-v1.md`
                   + git commit
                   + (optional) update skill files
```

**Output example:**
```markdown
---
title: Retrospective - Podcast Platform v1
version: 1.0.0
status: Completed
phase: Post-Phase 1
created: 2026-07-23
---

## Start Doing
- Viết skill test cases trước khi implement skill
- Dùng /project-onboard cho existing codebases

## Stop Doing
- Hardcode template path trong SKILL.md (luôn gọi MCP tool)
- Bỏ qua cross-ref validation khi tạo doc mới

## Continue Doing
- postinstall.js pattern cho skill install
- YAML frontmatter versioning

## Action Items
- [ ] Cập nhật skill workflow: add validate step trước output
- [ ] Fix template path trong sdlc-deploy SKILL.md
```

**Optional: Learn phase trong mỗi skill**
Ngoài skill riêng, mỗi SDLC skill có thể kết thúc với optional **Learn** step:
- Sau khi output, hỏi user: "Có lessons learned từ lần tạo document này không?"
- Nếu có → append vào `.opencode/lessons/` hoặc ghi retro nhanh
- Nếu không → skip (mặc định)

---

### 3.3 Doc Update Flow

Khi skill phát hiện file output đã tồn tại:

1. **Auto-detect**: Kiểm tra `docs/<flow>-v<version>.md` hoặc file match theo pattern
2. **Confirm**: Hỏi user "Update document hiện tại hay tạo bản mới?"
3. **Nếu Update**: 
   - Đọc file cũ, lấy version từ YAML frontmatter
   - Diff với context mới
   - Chỉ hỏi những câu cần thiết (không hỏi lại thông tin không đổi)
   - Tăng version: `1.2.0` (minor) hoặc `2.0.0` (major nếu breaking)
4. **Nếu tạo mới**: Tạo file mới với version `1.0.0`, không ảnh hưởng file cũ

### 3.4 Version History Spec

Mỗi document output có format:

```markdown
---
title: PRD - Product Name
version: 1.2.0
status: Draft
standard: ieee-29148
created: 2026-07-23
updated: 2026-07-23
changeLog:
  - version: 1.0.0
    date: 2026-07-22
    change: Initial draft
  - version: 1.1.0
    date: 2026-07-23
    change: Added security requirements per stakeholder review
  - version: 1.2.0
    date: 2026-07-23
    change: Updated timeline, added risk mitigations
---

# PRD: <Product Name>

...
```

**Rules:**
- Version spec: Semver (`major.minor.patch`)
  - `major`: Breaking changes (scope, architecture, timeline)
  - `minor`: Additions (new features, sections)
  - `patch`: Fixes (typos, clarifications, formatting)
- Git commit tự động sau khi ghi file (nếu project đã có git)

### 3.5 Cross-document Validation

```
PRD Feature X ──────► BRD Use Case Y ──────► ADR Component Z
                        │
                        ▼
                   Test Plan: Test Case W
                        │
                        ▼
                   Deploy Runbook: Deployment Step V
```

**Implementation (Phase 1 — lightweight per-skill):** Mỗi skill tự kiểm tra cross-ref ngay tại output:
- `sdlc-prd`: Kiểm tra BRD đã tồn tại chưa → ghi chú `↗ BRD reference` nếu có
- `sdlc-plan`: Satisfaction score ✅/⚠️/❌ cho từng feature PRD + use case BRD + component ADR. **Lưu ý:** Đây là **rough estimate** dựa trên LLM semantic comparison, không chính xác tuyệt đối. Kèm `confidence: high|medium|low` cho mỗi score để user biết mức độ tin cậy.
- `sdlc-deploy`: Kiểm tra ADR đã tồn tại chưa → cảnh báo nếu thiếu context

**Phase 2** (future): Skill riêng `/sdlc-validate` cho validation toàn chuỗi full.

Nếu BRD reference một feature không có trong PRD → WARNING
Nếu ADR reference một use case không có trong BRD → WARNING
Nếu Test Plan test một component không có trong ADR → WARNING

### 3.6 Project Doc Health

#### 3.6.1 Mục đích

Khi gọi `/project-doc-health`, AI scan `docs/` và báo cáo tình trạng SDLC documents.

#### 3.6.2 Output

```
📋 SDLC Doc Health Report — <project>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD: ✅ v1.2.0 (updated 2026-07-22)
BRD: ❌ Missing (gợi ý: chạy /sdlc-brd)
ADR: ⚠️ v1.0.0 nhưng PRD đã update → có thể cần review
Test Plan: ⚠️ Missing (chưa có QA phase?)
Deploy: ❌ Missing (gợi ý: chạy /sdlc-deploy)

Cross-ref:
  PRD Feature "Auth"  → BRD: ❌ không có use case tương ứng
  ADR Component "API" → Test Plan: ❌ không có test case
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 3.6.3 Cách hoạt động

1. Scan `docs/` tìm files match patterns: `prd*.md`, `brd*.md`, `adr*.md`, `test-plan*.md`, `deploy*.md`
2. Parse YAML frontmatter → version, status, updated date
3. Nếu không có frontmatter → ⚠️ "No versioning"
4. Nếu cross-ref (keyword matching) không khớp → ❌
5. Output 1 bảng ngắn

#### 3.6.4 Handoff Checklist

- [ ] Skill: `project-doc-health/SKILL.md` — scan docs, parse frontmatter, cross-ref check
- [ ] Tool: `sdlc_health_check` MCP tool (optional — có thể làm trong skill trực tiếp)
- [ ] Limit: scan depth=3, chỉ đọc files < 50KB để tránh context flooding
- [ ] **Version drift check**: Đọc `.opencode/manifests/sdlc-workflows.json` → so sánh `installedVersion` với config's `sdlc.templateVersion`. Nếu mismatch → cảnh báo + gợi ý chạy `npm update @andy-toolforge/sdlc-workflows`

---

## 4. Template Architecture

### 4.1 Package Structure

> [!NOTE] **Issue A/D: Tại sao 1 package?**
> Ban đầu design tách riêng `@andy-toolforge/sdlc-workflows-mcp` (TypeScript, Express server) + `@andy-toolforge/sdlc-workflows` (skills + templates). Lý do: separation of concerns, independent deploy.
>
> **Vấn đề:** Tách làm 2 package gây config complexity — user phải npm install 2 packages, cấu hình MCP riêng, và template path resolution giữa 2 packages phức tạp (`require.resolve()` cross-package). Đây là anti-pattern với Toolforge monorepo conventions.
>
> **Quyết định:** Hợp nhất vào 1 package. MCP tools là plugin tools (`mcp-tools.js`) auto-discovered bởi `@andy-toolforge/mcp`, template đọc từ `__dirname + '/templates/'`. Khi sau này cần MCP server riêng (scale), có thể tách ra — design pattern vẫn cho phép.

```
packages/sdlc-workflows/                    # @andy-toolforge/sdlc-workflows (single package)
├── package.json
├── index.js                               # Exports (nếu cần sau này)
├── mcp-tools.js                           # Plugin tools — auto-discover bởi @andy-toolforge/mcp
│                                          # Tools: sdlc_get_template, sdlc_list_templates, sdlc_get_standard
├── postinstall.js                         # installSkills() + copy templates + sinh version manifest
│                                          # Signature: installSkills({ domain: 'sdlc-workflows', sourceDir: path.join(__dirname, 'skills') })
│                                          # Symlinks .md files → .opencode/skills/sdlc-workflows-<filename>.md
│                                          # Copy templates: COPY-IF-NOT-EXISTS (additive merge) — không overwrite user's local edits
│                                          # Manifest: overwrite mỗi lần (metadata luôn fresh)
│                                          # Phiên bản mới: user chạy `npm update` → manifest version bump → project-doc-health detect drift
├── lib/                                   # Code thật (nếu cần — trống Phase 1)
├── skills/
│   ├── project-init/
│   │   └── SKILL.md
│   ├── project-onboard/
│   │   └── SKILL.md
│   ├── project-doc-health/
│   │   └── SKILL.md
│   ├── sdlc-prd/
│   │   └── SKILL.md                       # Phase 1 — Agile PRD + cross-ref
│   ├── sdlc-deploy/
│   │   └── SKILL.md                       # Phase 1 — ITIL + SRE
│   ├── sdlc-plan/
│   │   └── SKILL.md                       # Phase 1 — Implementation bridge
│   └── sdlc-retro/
│       └── SKILL.md
├── templates/                             # Templates — serve trực tiếp từ mcp-tools.js
│   ├── standards/
│   │   ├── agile-scrum.md                 # Phase 1
│   │   └── itil-sre.md                    # Phase 1
│   └── flows/
│       ├── prd/
│       │   └── agile-prd.md               # Phase 1 (IEEE reference trong SKILL.md)
│       └── deploy/
│           ├── itil-runbook.md            # Phase 1
│           └── sre-runbook.md             # Phase 1
└── test/                                  # Integration tests
    └── templates/
        ├── basic-prd.yaml
        └── basic-deploy.yaml
```

### 4.2 Manifest (Auto-generated bởi postinstall.js)

`postinstall.js` sinh file `.opencode/manifests/sdlc-workflows.json`:

```json
{
  "package": "@andy-toolforge/sdlc-workflows",
  "installedVersion": "1.0.0",
  "installedAt": "2026-07-24T10:00:00Z",
  "templates": [
    { "id": "prd/agile", "name": "Agile PRD", "standard": "agile", "type": "flow" },
    { "id": "deploy/itil", "name": "ITIL Runbook", "standard": "itil", "type": "flow" },
    { "id": "deploy/sre", "name": "SRE Runbook", "standard": "sre", "type": "flow" },
    { "id": "standards/agile-scrum", "name": "Agile Scrum", "standard": "agile", "type": "standard" },
    { "id": "standards/itil-sre", "name": "ITIL SRE", "standard": "itil", "type": "standard" }
  ]
}
```

**`sdlc_list_templates` tool** đọc manifest này (không glob).  
Thêm template mới → cần chạy `postinstall.js` lại (hoặc `npm update`).

**Copy strategy — Additive merge:**
- `postinstall.js` copy templates từ `packages/sdlc-workflows/templates/` vào `.opencode/templates/sdlc-workflows/`
- **COPY-IF-NOT-EXISTS:** Chỉ copy nếu file đích chưa tồn tại. Nếu user đã modify template ở local override → không overwrite.
- Manifest luôn **regenerate** (overwrite) — metadata không phải user content.
- **Để restore fresh templates:** `rm -rf .opencode/templates/sdlc-workflows/ && npm install`
- **Khi package update:** `npm update` → manifest version bump → `project-doc-health` detect drift → user quyết định có sync lại templates không.  

**Version drift detection:** `project-doc-health` so sánh `installedVersion` trong manifest với config's `sdlc.templateVersion`. Nếu mismatch → cảnh báo.

> **Phase 3:** Có thể chuyển sang glob-based dynamic scan khi templates > 20 và cần real-time. Phase 1 manifest-based đơn giản và đủ dùng.

### 4.3 Template Config trong OpenCode Config

`.opencode/config.jsonc`:

```jsonc
{
  "sdlc": {
    "templateVersion": "1.0.0",
    "standard": "agile",        // "agile" | "ieee" | "hybrid"
    "mode": "hybrid",           // "template" | "auto" | "hybrid"
    "docPath": "docs/",         // Output directory
    "language": "vi",           // "vi" | "en" | "both"
    "validation": {
      "crossRef": true,
      "principleCheck": true,
      "versionHistory": true
    },
    "overridePath": ".opencode/templates/"  // Local override (optional)
  }
}
```

### 4.4 Template Resolution Order

Khi skill cần một template:

```
1. <project>/.opencode/templates/<path>    (local override — ưu tiên cao nhất)
2. @andy-toolforge/sdlc-workflows/templates/<path>   (package default)
3. <project>/.opencode/config.jsonc → sdlc.templateVersion (version pin)
```

### 4.5 Skill Test Mechanism

#### 4.5.1 Vấn đề

Skill files (SKILL.md) là markdown instructions cho AI agent. Không có cách test chúng trước khi ship. Rủi ro: skill bị lỗi instruction → AI hiểu sai → tài liệu sai format.

#### 4.5.2 Giải pháp: Mỗi skill kèm test case

```
skills/
├── sdlc-prd/
│   ├── SKILL.md             # Skill instructions
│   └── test/
│       ├── basic-prd.yaml   # Test case: Agile PRD basic
│       └── existing-doc.yaml# Test case: update existing doc
└── project-init/
    └── SKILL.md
```

**Test case format (YAML):**

```yaml
# test/basic-prd.yaml
name: "Agile PRD — product vision basic"
input:
  mockAnswers:
    - q: "Product vision?"
      a: "Một nền tảng học online cho người Việt"
    - q: "Target users?"
      a: "Sinh viên đại học, người đi làm muốn học kỹ năng mới"
    - q: "Core problem?"
      a: "Thiếu nội dung tiếng Việt chất lượng cao"
  templateId: "prd/agile"
expectedOutput:
  hasFrontmatter: true
  requiredSections:
    - "## 1. Vision"
    - "## 3. Problem Statement"
    - "## 5. Features"
  mustNotContain:
    - "[TBD]"
    - "TODO"
  crossRefValid: true
```

#### 4.5.3 Cách chạy test

MCP tool `sdlc_validate_skill` (optional — Phase 1 có thể bỏ qua, dùng manual review):

```
sdlc_validate_skill
  input:
    skillPath: string       # Path tới SKILL.md
    testCase: TestCase      # Test case YAML
    mockInterview: bool     # Dùng mock answers thay vì gọi LLM
  output:
    valid: boolean
    errors: string[]
    warnings: string[]
    generatedPreview: string  # Preview kết quả (nếu mock LLM)
```

**Phase 1:** Test cases là YAML files để review tay. `sdlc_validate_skill` là Phase 2.  
**Phase 3:** Có thể chạy test tự động trong CI (GitHub Actions).

#### 4.5.4 Handoff Checklist

- [ ] Test case YAML cho mỗi skill (Phase 1 — tay)
- [ ] `sdlc_validate_skill` MCP tool (Phase 2)
- [ ] CI integration (Phase 3)

---

## 5. Quyết định Kiến trúc: MCP qua plugin tools, inline fallback

### 5.1 Kiến trúc tổng thể

Thay vì tách riêng MCP server + mcp.json config, 3 template tools được implement như **plugin tools** trong `mcp-tools.js`:

```
@andy-toolforge/sdlc-workflows/mcp-tools.js
  → sdlc_get_template({ templateId })
  → sdlc_list_templates({ standard?, flow? })
  → sdlc_get_standard({ standardId })
```

**Cách hoạt động:**
1. `@andy-toolforge/mcp` auto-discover `mcp-tools.js` khi load plugin tools
2. 3 tools trở thành MCP tools sẵn có — không cần `.opencode/mcp.json`
3. Tools đọc templates/ trực tiếp từ package filesystem (runtime path = `__dirname + '/templates/'`). **Verified:** `__dirname` hoạt động đúng khi MCP load plugin tools qua `require(mcpToolsPath)` — vì file được require trực tiếp từ chính package source. **Fallback:** Nếu path sai vì lý do runtime, dùng `require.resolve('@andy-toolforge/sdlc-workflows/mcp-tools.js')` để lấy đường dẫn chính xác.
4. Installation giảm còn 1 package duy nhất: `@andy-toolforge/sdlc-workflows`

**Inline fallback (khi MCP không available):**
Mỗi SKILL.md nhúng sẵn **inline template structure** ngay trong skill file. Inline template là phiên bản **minimal** — chỉ có section headers + 1-2 câu mô tả mỗi section. Đủ để AI agent tạo ra document có cấu trúc khi không có MCP tools.

**Scope của "minimal" inline template:**
| Thuộc tính | Inline (SKILL.md) | Standalone (templates/) |
|---|---|---|
| Nội dung | Section headers + 1-2 câu mô tả mỗi section | Full template: example text, formatting instructions, placeholders có mô tả |
| Dùng khi | MCP tool `sdlc_get_template` unavailable | MCP tool available (ưu tiên), hoặc user muốn template chi tiết |
| Maintenance | Thay đổi khi skill workflow thay đổi | Thay đổi template độc lập với skill logic |
| Fallback | Là chính nó | Nếu unavailable → AI fallback về inline |

```
## Template (inline fallback)

Nếu không gọi được sdlc_get_template, dùng structure sau:

# <Product Name> PRD

> **Section mô tả:** 3-5 câu per section, tập trung vào mục đích của section đó, AI tự suy luận nội dung.

## 1. Vision
Mô tả tầm nhìn sản phẩm — problem space, target outcome, business alignment.

## 2. Target Users
User segments, personas, use cases. Ai là người dùng chính? Họ cần gì?
...
```
Skill dùng inline template làm default, gọi MCP tool để lấy template đầy đủ nếu available.

### 5.2 MCP Tools Design

```yaml
source: @andy-toolforge/sdlc-workflows/mcp-tools.js
type: plugin tools (auto-discovered)
language: JavaScript (CommonJS — phù hợp project convention)

Tools:
  sdlc_get_template:
    input:
      templateId: string    # "prd/agile" | "deploy/itil" | "deploy/sre"
    output:
      content: string       # Template markdown
      metadata: { standard, updatedAt }

  sdlc_list_templates:
    input:
      standard?: string     # "agile" | "itil"
      flow?: string         # "prd" | "deploy"
    output:
      templates: [{ id, name, standard, type }]

  sdlc_get_standard:
    input:
      standardId: string    # "agile-scrum" | "itil-sre"
    output:
      sections: string[]    # Required sections
      guidelines: string    # Reference guide
```

**Không cần MCP config**. Package chỉ cần `npm install @andy-toolforge/sdlc-workflows` và postinstall.js tự chạy.  
`@andy-toolforge/mcp` auto-discover tools từ `node_modules/@andy-toolforge/*/mcp-tools.js`.

### 5.3 Template Resolution Order

```
Skill cần template "prd/agile"
  │
  ├─ 1. local override? (.opencode/templates/<path>)
  │      └─ Có → dùng file local
  │
  ├─ 2. MCP available? (@andy-toolforge/mcp đang chạy)
  │      └─ Có → gọi sdlc_get_template({ templateId: "prd/agile" })
  │
  └─ 3. Inline fallback (SKILL.md có inline sections)
         └─ Dùng cấu trúc mặc định trong SKILL.md
```

### 5.4 Config Settings

```jsonc
{
  "sdlc": {
    "templateVersion": "1.0.0",           // Pinned version (so sánh với manifest)
    "standard": "agile",                   // "agile" | "ieee" | "hybrid"
    "mode": "hybrid",                      // Xem định nghĩa bên dưới
    "docPath": "docs/",                    // Output directory
    "language": "vi",                      // "vi" | "en" | "both"
    "validation": {
      "crossRef": true,                    // Cross-ref check khi output
      "principleCheck": true,
      "versionHistory": true
    },
    "overridePath": ".opencode/templates/" // Local override (optional)
  }
}
```

**Mode definitions:**
- `template`: AI nhận template từ MCP tool, điền nội dung theo sections, output đúng format
- `auto`: AI tự generate hoàn toàn từ context + interview (không cần template), dùng khi template quá cứng nhắc
- `hybrid`: Gọi template từ MCP tool → AI generate theo template → AI tự do mở rộng thêm sections nếu cần (recommended default)

**Version drift detection:** `project-doc-health` so sánh `sdlc.templateVersion` (config) với `installedVersion` (manifest). Nếu mismatch → cảnh báo user update package.

### 5.5 Kế hoạch mở rộng

| Phase | Scope | Tính năng MCP tools |
|---|---|---|
| **Phase 1** (nay) | 5 templates | `get_template`, `list_templates`, `get_standard` — serving thuần + inline fallback |
| **Phase 2** | ~10 templates | + `validate_document` (structure check theo standard), manifest version check |
| **Phase 3** | >15 templates | + Template engine (variables, sections, conditionals), centralized version mgmt |

---

## 6. Lộ trình (Roadmap)

### Phase 1: MVP (2-3 days)

| Task | Status | Người thực hiện | Ước lượng |
|---|---|---|---|
| **Package**: struct + `postinstall.js` + version manifest | ✅ Done | Toolforge | 1.5 giờ |
| **MCP tools**: `mcp-tools.js` — 3 tools | ✅ Done | Toolforge | 3 giờ |
| **Templates**: agile-scrum.md, agile-prd.md, itil-sre.md, itil-runbook.md, sre-runbook.md | ✅ Done | Toolforge | 2.5 giờ |
| **Skill**: `project-init/SKILL.md` | ✅ Done | Toolforge | 4 giờ |
| **Skill**: `project-onboard/SKILL.md` | ✅ Done | Toolforge | 4 giờ |
| **Skill**: `project-doc-health/SKILL.md` | ✅ Done | Toolforge | 2.5 giờ |
| **Skill**: `sdlc-prd/SKILL.md` | ✅ Done | Toolforge | 3 giờ |
| **Skill**: `sdlc-deploy/SKILL.md` | ✅ Done | Toolforge | 3 giờ |
| **Skill**: `sdlc-plan/SKILL.md` | ✅ Done | Toolforge | 3 giờ |
| **Skill**: `sdlc-retro/SKILL.md` | ✅ Done | Toolforge | 2 giờ |
| **Learn phase**: Optional Learn step + inline template fallback | ✅ Done | Toolforge | 1.5 giờ |
| **Test cases**: YAML test cases cho mỗi skill | ✅ Done | Toolforge | 2 giờ |

**Tổng Phase 1**: ~32 giờ (4 days) — ✅ Completed

### Phase 2: Expansion (within 2 weeks)

| Task | Status | Ước lượng |
|---|---|---|
| MCP: `validate_document` tool (structure check theo standard) | ✅ Done | 3 giờ |
| MCP: `sdlc_validate_skill` tool | ✅ Done | 4 giờ |
| **Skill**: `sdlc-brd` + test | ✅ Done | 4-6 giờ |
| **Skill**: `sdlc-arch` + test | ✅ Done | 4-6 giờ |
| **Skill**: `sdlc-test-plan` + test | ✅ Done | 3-4 giờ |
| **Skill**: `/sdlc-validate` — cross-document validation | ✅ Done | 4 giờ |
| Templates: BRD (IEEE 29148), Arch (Arc42, C4), Test Plan (ISO 29119, IEEE 829) | ✅ Done | 4 giờ |

**Tổng Phase 2**: ~26-30 giờ — ✅ Completed

### Phase 3: MCP Engine ✅ Completed

| Task | Status | Ước lượng |
|---|---|---|
| Template engine (`lib/template-engine.js`) — variables `{{var}}`, `|default()`, conditionals `{% if %}`, loops `{% for %}`, includes `{% include %}` | ✅ Done | 8 giờ |
| Version registry (`lib/version-registry.js`) — `checkManifest`, `diffTemplates`, `sdlc_check_version` MCP tool | ✅ Done | 4 giờ |
| Skill discovery (`lib/skill-index.js`) — `buildIndex`, `searchSkills`, `sdlc_search_skills` MCP tool + keywords in all 11 skills | ✅ Done | 4 giờ |
| MCP integration — `sdlc_render_template` tool, context-aware `sdlc_get_template` | ✅ Done | 3 giờ |
| Template migration — all 10 templates to `{{var}}` syntax + YAML frontmatter + `{% include %}` partials | ✅ Done | 6 giờ |
| Glob-based dynamic template scan — `globSync` replaces manual `readdirSync` recursion | ✅ Done | 2 giờ |
| CI integration — `.github/workflows/sdlc-tests.yml` runs tests on PR | ✅ Done | 1 giờ |
| Version bump 0.2.0→0.3.0 + design doc update | ✅ Done | 0.5 giờ |

**Tổng Phase 3**: ~28.5 giờ — ✅ Completed

---

## 7. Bàn giao cho Toolforge Team

### 7.1 Files cần tạo trong `@andy-toolforge/sdlc-workflows`

#### Immediate (Phase 1):

```
packages/sdlc-workflows/                    # @andy-toolforge/sdlc-workflows (single package)
├── package.json                            [TASK-001]
├── index.js                                # Exports (nếu cần sau này)
├── mcp-tools.js                            [TASK-002] — plugin tools (3 → 5 in Phase 2)
├── postinstall.js                          [TASK-001] — installSkills() + sinh manifest
├── lib/                                    # Code thật (trống Phase 1)
├── skills/
│   ├── project-init/SKILL.md              [TASK-003]
│   ├── project-onboard/SKILL.md           [TASK-004]
│   ├── project-doc-health/SKILL.md        [TASK-005]
│   ├── sdlc-prd/SKILL.md                  [TASK-006]
│   ├── sdlc-plan/SKILL.md                 [TASK-007]
│   ├── sdlc-retro/SKILL.md                [TASK-008]
│   ├── sdlc-deploy/SKILL.md               [TASK-009]
│   ├── sdlc-brd/SKILL.md                  [Phase 2]
│   ├── sdlc-arch/SKILL.md                 [Phase 2]
│   ├── sdlc-test-plan/SKILL.md            [Phase 2]
│   └── sdlc-validate/SKILL.md             [Phase 2]
├── templates/                              [TASK-010]
│   ├── standards/
│   │   ├── agile-scrum.md
│   │   └── itil-sre.md
│   └── flows/
│       ├── prd/agile-prd.md
│       ├── brd/ieee-29148.md               [Phase 2]
│       ├── arch/arc42.md                    [Phase 2]
│       ├── arch/c4-model.md                 [Phase 2]
│       ├── test-plan/iso-29119.md           [Phase 2]
│       ├── test-plan/ieee-829.md            [Phase 2]
│       └── deploy/
│           ├── itil-runbook.md
│           └── sre-runbook.md
└── test/                                   [TASK-011] — YAML test cases
    ├── basic-init.yaml
    ├── basic-prd.yaml
    ├── basic-brd.yaml                       [Phase 2]
    ├── basic-arch.yaml                      [Phase 2]
    ├── basic-test-plan.yaml                 [Phase 2]
    ├── basic-validate.yaml                  [Phase 2]
    └── basic-deploy.yaml

Lessons directory (runtime, tạo bởi skill khi chạy):
.opencode/lessons/
    └── <project>-retro-*.md
```

### 7.2 SKILL.md Structure Template

Mỗi SKILL.md theo format:

```markdown
# SDLC: <Flow Name>

## Mô tả
<1-2 câu trigger description>

## Kích hoạt
Khi user nói: "<trigger phrases>"
Hoặc chạy: `/<command-name>`

## Input
- <Các thông tin cần từ user>
- <Cross-ref documents>

## Output
- File: `<output path>` (theo config `sdlc.docPath`)
- Format: Markdown + YAML frontmatter (version, changelog)

## Workflow
1. **Warn confidentiality**: "Thông tin bạn cung cấp sẽ được gửi lên LLM API. Skip nếu không muốn chia sẻ."
2. **Interview**: <các câu hỏi để gather context>
3. **Auto-detect**: Nếu file output đã tồn tại → hỏi "update (v<N+1>) hay tạo mới?"
4. **Grounding**: <codebase scan để lấy context thực tế>
5. **Get template**: Gọi `sdlc_get_template({ templateId })` qua MCP tool
   - **MCP detection:** Dùng `try-catch` khi gọi MCP tool. Nếu throws → fallback ngay. Không đoán availability — chỉ gọi và bắt lỗi.
   - Nếu MCP không available (throw) → dùng **inline template sections** trong SKILL.md
   - Nếu có local override ở `.opencode/templates/` → dùng local file (ưu tiên cao nhất)
6. **Draft**: <viết document theo template>
7. **Validate**: <kiểm tra principles, format, YAML frontmatter>
8. **Output**: Ghi file + `git add` + `git commit` (nếu có git)
9. **(Optional) Learn**: Hỏi user "Có lessons learned từ flow này không?"
   - Có → ghi vào `.opencode/lessons/<flow>-<date>.md`
   - Không → skip (mặc định)

## Templates
- `<template-id>` (lấy từ MCP: `sdlc_get_template`) — dùng khi `<condition>`

## Principles
- <Các nguyên tắc bắt buộc>

## MCP Tools Used
- `sdlc_get_template`
- `sdlc_get_standard` (nếu cần reference)

## Cross-ref
- Input từ: <other flows>
- Output cho: <other flows>
- Retro: `/sdlc-retro` sau khi hoàn thành
- Validation: `/sdlc-validate` (Phase 2)
```

### 7.3 Yêu cầu kỹ thuật

| Yêu cầu | Bắt buộc |
|---|---|
| SKILL.md trigger description chính xác, không over-trigger | ✅ |
| Interview questions tối thiểu, đủ để gen document | ✅ |
| Template đúng standard (Agile PRD format; IEEE/ISO là reference notes cho Phase 2) | ✅ |
| Template accuracy: phải được review bởi người biết standard | ✅ |
| MCP integration: gọi `sdlc_get_template` để lấy template | ✅ |
| Doc update: auto-detect file tồn tại, hỏi "update or new?" | ✅ |
| YAML frontmatter version + changelog trong mỗi output | ✅ |
| Cross-document validation (qua `/sdlc-validate` ở Phase 2) | Phase 2 |
| OpenCode config integration (`sdlc.*` settings) | ✅ |
| Local override support (`.opencode/templates/`) | ✅ |
| Skip confidential: user có thể skip câu hỏi, auto-detect từ context | ✅ |
| Large codebase scan: depth limit + exclude pattern | ✅ |

### 7.4 Non-goals (Phase 1)

- ❌ Template engine (variables, conditionals) — Phase 3
- ❌ Full project scaffold (chỉ OpenCode setup)
- ❌ Integration với Jira/GitHub Projects (future)
- ❌ Multi-language template engine — Phase 3
- ❌ Cross-ref validation toàn chuỗi — Phase 2 (`/sdlc-validate`)

### 7.5 Rủi ro & Giảm thiểu

| Rủi ro | Mitigation |
|---|---|
| Skill bị over-trigger (chạy nhầm flow) | Trigger description phải narrow, dùng exact phrase match |
| Template quá cứng nhắc | User có mode selection (template/auto/hybrid) |
| Cross-ref lỗi thời | Validation khi output, warning chứ không block |
| User không muốn trả lời interview | Auto-detect từ git history, file system, package.json |
| Template version mismatch | `sdlc.templateVersion` pin, cảnh báo nếu outdated |

---

*Design approved 2026-07-23. Bàn giao cho @andy-toolforge team để implement.*
