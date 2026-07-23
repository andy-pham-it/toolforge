# SDLC Agent Flows — Design Document

> Bản quyền thuộc @andy-toolforge
> Trạng thái: **Refined** | Phiên bản: v2.3 | Ngày: 2026-07-23
> Cập nhật: Thêm retrospective/lessons learned: /sdlc-retro skill riêng + optional Learn phase trong mỗi SDLC skill

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
5. [Quyết định Kiến trúc: Skills-first, MCP later](#5-quyết-định-kiến-trúc-skills-first-mcp-later)
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
- [ ] MCP: Sinh `.opencode/mcp.json` với `@andy-toolforge/sdlc-workflows-mcp` config
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

Mỗi flow là một SKILL.md riêng trong toolforge package:

```
@andy-toolforge/sdlc-workflows/skills/
├── sdlc-prd/
│   ├── SKILL.md              # Trigger: PM cần PRD
│   └── context-rules.md      # Context injected khi skill chạy
├── sdlc-brd/                 [Phase 2]
│   └── SKILL.md
├── sdlc-arch/                [Phase 2]
│   └── SKILL.md
├── sdlc-test-plan/           [Phase 2]
│   └── SKILL.md
├── sdlc-deploy/
│   └── SKILL.md
└── sdlc-retro/               # [Phase 1]
    └── SKILL.md
```

> Lưu ý: Templates không nằm trong skills/ — chúng được serve bởi MCP server (xem Section 5.2).
> AGENTS.md per-skill bị loại bỏ (OpenCode chỉ đọc root AGENTS.md). Thay bằng `context-rules.md` — skill inject nội dung file này vào prompt khi chạy.

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
- `sdlc-plan`: Satisfaction score ✅/⚠️/❌ cho từng feature PRD + use case BRD + component ADR
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

---

## 4. Template Architecture

### 4.1 Package Structure

```
packages/sdlc-workflows/                    # @andy-toolforge/sdlc-workflows
├── package.json
├── index.js                               # Exports (nếu cần)
├── postinstall.js                         # installSkills() — tự động cài skills
└── skills/                                # Skill files (SKILL.md cho mỗi flow)
    ├── project-init/
    │   └── SKILL.md
    ├── sdlc-prd/
    │   └── SKILL.md                       # Phase 1 — Agile PRD + cross-ref
    ├── sdlc-brd/                          # [Phase 2]
    │   └── SKILL.md
    ├── sdlc-arch/                         # [Phase 2]
    │   └── SKILL.md
    ├── sdlc-test-plan/                    # [Phase 2]
    │   └── SKILL.md
    ├── sdlc-deploy/
    │   └── SKILL.md                       # Phase 1 — ITIL + SRE
    └── sdlc-plan/
        └── SKILL.md                       # Phase 1 — Implementation bridge

packages/sdlc-workflows-mcp/                # @andy-toolforge/sdlc-workflows-mcp (server riêng)
├── package.json
├── index.ts                               # MCP server entry
├── tools/
│   ├── get_template.ts
│   ├── list_templates.ts
│   └── get_standard.ts
└── templates/                             # Templates served by MCP
    ├── index.json                         # Manifest
    ├── standards/
    │   ├── agile-scrum.md                 # Phase 1
    │   └── itil-sre.md                    # Phase 1
    └── flows/
        ├── prd/
        │   └── agile-prd.md               # Phase 1 (IEEE reference trong SKILL.md)
        └── deploy/
            ├── itil-runbook.md            # Phase 1
            └── sre-runbook.md             # Phase 1
```

### 4.2 Manifest (Auto-generated)

Thay vì maintain `index.json` tay, `sdlc_list_templates` tool **scan `templates/` directory động**:

```
sdlc_list_templates
  → Glob: templates/**/*.md
  → Parse: path components = {category}/{standard}-{flow}.md or {standard}.md
  → Return: [{ id, name, standard, type, updatedAt }]
```

**Không cần index.json.** Thêm file `.md` mới vào `templates/` → tool thấy ngay lập tức.  
`updatedAt` lấy từ file mtime — đủ cho Phase 1.  
Version pinning dùng `sdlc.templateVersion` trong config (so sánh semver với `updatedAt` nếu cần).

> **Lưu ý:** Nếu sau này số lượng templates > 20, có thể cache manifest vào JSON để tránh glob overhead. Phase 1 chưa cần.

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

## 5. Quyết định Kiến trúc: MCP nhẹ ngay Phase 1

### 5.1 Tại sao chọn MCP nhẹ ngay Phase 1

Sau deep review, quyết định chuyển từ "skills-first, MCP later" → **MCP nhẹ Phase 1** vì:

| Yếu tố | Skills-only (cũ) | MCP nhẹ Phase 1 (mới) |
|---|---|---|
| Template path resolution | ❌ Không khả thi — skill không biết package path | ✅ Skill gọi `sdlc_get_template` tool |
| Template versioning | ❌ Không có | ✅ MCP quản lý version |
| Template caching | ❌ | ✅ Có thể cache |
| Complexity | Zero infra | MCP ~200 dòng code |
| Skill install | Manual copy/symlink | /project-init chạy install |
| Time-to-ship | 1-2 ngày (kèm path bugs) | ~2 ngày (sạch, đúng) |

### 5.2 MCP Server Design

```yaml
name: @andy-toolforge/sdlc-workflows-mcp
type: template-serving (chưa có template engine)
language: TypeScript (Bun)

Tools:
  sdlc_get_template:
    input:
      templateId: string    # "prd/agile" | "deploy/itil" | "deploy/sre"
      version?: string      # Semver range
    output:
      content: string       # Template markdown
      metadata: { standard, version, updatedAt }

  sdlc_list_templates:
    input:
      standard?: string     # "agile" | "ieee" | "iso" | "arc42"
      flow?: string         # "prd" | "brd" | "arch" | "test-plan" | "deploy"
    output:
      templates: [{ id, name, standard, version }]

  sdlc_get_standard:
    input:
      standardId: string    # "ieee-29148" | "iso-29119" | "arc42" | ...
    output:
      sections: string[]    # Required sections for this standard
      guidelines: string    # Reference guide
```

**MCP Config** (`.opencode/mcp.json` — tự sinh bởi `/project-init`):
```json
{
  "mcpServers": {
    "@andy-toolforge/sdlc-workflows": {
      "command": "npx",
      "args": ["@andy-toolforge/sdlc-workflows-mcp"],
      "env": {
        "SDL_CACHE_DIR": ".opencode/sdlc-cache"
      }
    }
  }
}
```

### 5.3 Template Resolution với MCP

```
Skill cần template "prd/agile"
  → gọi sdlc_get_template({ templateId: "prd/agile" })
  → MCP check local override (.opencode/templates/)
  → MCP fallback tới package templates
  → return markdown
```

### 5.4 Config Settings

```jsonc
{
  "sdlc": {
    "templateVersion": "1.0.0",           // Pinned version (MCP validate)
    "standard": "agile",                   // "agile" | "ieee" | "hybrid"
    "mode": "hybrid",                      // Xem định nghĩa bên dưới
    "docPath": "docs/",                    // Output directory
    "language": "vi",                      // "vi" | "en" | "both"
    "validation": {
      "crossRef": true,                    // Gọi /sdlc-validate
      "principleCheck": true,
      "versionHistory": true
    },
    "overridePath": ".opencode/templates/" // Local override (optional)
  }
}
```

**Mode definitions:**
- `template`: AI nhận template từ MCP, điền nội dung theo sections, output đúng format
- `auto`: AI tự generate hoàn toàn từ context + interview (không cần template), dùng khi template quá cứng nhắc
- `hybrid`: Gọi template từ MCP → AI generate theo template → AI tự do mở rộng thêm sections nếu cần (recommended default)

### 5.5 Kế hoạch mở rộng MCP

| Phase | Scope | Tính năng MCP |
|---|---|---|
| **Phase 1** (nay) | 3 templates | `get_template`, `list_templates`, `get_standard` — serving thuần |
| **Phase 2** | ~10 templates | + `validate_document` (structure check theo standard), version manifest |
| **Phase 3** | >15 templates | + Template engine (variables, sections, conditionals), centralized version mgmt |

---

## 6. Lộ trình (Roadmap)

### Phase 1: MVP (2-3 days)

| Task | Người thực hiện | Ước lượng |
|---|---|---|
| **Package**: `@andy-toolforge/sdlc-workflows` struct + `postinstall.js` (dùng `installSkills()`) | Toolforge | 1 giờ |
| **MCP Server**: `@andy-toolforge/sdlc-workflows-mcp` — 3 tools serve template + standard reference (manifest auto-gen từ directory scan, không cần index.json tay) | Toolforge | 4-6 giờ |
| **Templates**: agile-scrum.md, agile-prd.md (Agile-only Phase 1, IEEE reference notes trong SKILL.md) | Toolforge | 2 giờ |
| **Skill**: `project-init/SKILL.md` — quick mode | Toolforge | 3 giờ |
| **Skill**: `project-init/SKILL.md` — detailed mode (+ postinstall skill install) | Toolforge | 3 giờ |
| **Skill**: `project-onboard/SKILL.md` — discovery-based onboard cho existing projects | Toolforge | 4 giờ |
| **Skill**: `project-doc-health/SKILL.md` — scan docs, check frontmatter, cross-ref health | Toolforge | 2 giờ |
| **Skill**: `sdlc-prd/SKILL.md` — Agile PRD (lightweight cross-ref validation built-in) | Toolforge | 3 giờ |
| **Skill**: `sdlc-deploy/SKILL.md` — ITIL + SRE | Toolforge | 3 giờ |
| **Skill**: `sdlc-plan/SKILL.md` — Spec→implementation bridge (+ cross-doc satisfaction score) | Toolforge | 3 giờ |
| **Skill**: `sdlc-retro/SKILL.md` — Retrospective + lessons learned | Toolforge | 2 giờ |
| **Learn phase**: Thêm optional Learn step vào workflow template (tất cả skills) | Toolforge | 1 giờ |
| **Test cases**: YAML test case cho mỗi skill (tay, chưa tự động) | Toolforge | 2 giờ |

**Tổng Phase 1**: ~33 giờ (4 days)

### Phase 2: Expansion (within 2 weeks)

| Task | Ước lượng |
|---|---|
| MCP: `validate_document` tool (structure check theo standard) | 3 giờ |
| **Skill**: `sdlc-brd` + templates (IEEE 29148, Use Case 2.0) | 4-6 giờ |
| **Skill**: `sdlc-arch` + templates (Arc42, C4) | 4-6 giờ |
| **Skill**: `sdlc-test-plan` + templates (ISO 29119, IEEE 829) | 3-4 giờ |
| **Skill**: `/sdlc-validate` — cross-document validation (PRD↔BRD↔ADR↔Test↔Deploy) | 4 giờ |
| MCP: `sdlc_validate_skill` tool + test runner | 4 giờ |
| Templates mở rộng cho BRD, Arch, Test Plan | 4 giờ |

**Tổng Phase 2**: ~26-30 giờ

### Phase 3: MCP Engine (when >15-20 templates)

- Template engine: variables interpolation, conditional sections, reusable blocks
- Centralized version management
- Skill discovery improvement

---

## 7. Bàn giao cho Toolforge Team

### 7.1 Files cần tạo trong `@andy-toolforge/sdlc-workflows`

#### Immediate (Phase 1):

```
packages/
├── sdlc-workflows/                     # @andy-toolforge/sdlc-workflows
│   ├── package.json                    [TASK-001]
│   ├── index.js                        # Exports (nếu cần)
│   ├── postinstall.js                  [TASK-001] — dùng installSkills()
│   └── skills/
│       ├── project-init/SKILL.md       [TASK-002]
│       ├── project-onboard/SKILL.md    [TASK-003]
│       ├── project-doc-health/SKILL.md [TASK-004]
│       ├── sdlc-prd/SKILL.md           [TASK-005]
│       ├── sdlc-plan/SKILL.md          [TASK-006]
│       ├── sdlc-retro/SKILL.md         [TASK-007]
│       └── sdlc-deploy/SKILL.md        [TASK-008]
│           └── test/                   # Test cases cho mỗi skill
│               ├── basic-prd.yaml
│               └── basic-deploy.yaml
│
│   Lessons directory (runtime, tạo bởi skill khi chạy):
│   .opencode/lessons/
│       └── <project>-retro-*.md
│
└── sdlc-workflows-mcp/                 # @andy-toolforge/sdlc-workflows-mcp
    ├── package.json                    [TASK-009]
    ├── index.ts                        # MCP server entry
    ├── tools/
    │   ├── get_template.ts             # Đọc từ templates/, không cần index.json
    │   ├── list_templates.ts           # Auto-scan từ directory glob
    │   └── get_standard.ts
    └── templates/
        ├── standards/
        │   ├── agile-scrum.md          [TASK-010]
        │   └── itil-sre.md
        └── flows/
            ├── prd/agile-prd.md        [TASK-010]
            └── deploy/
                ├── itil-runbook.md     [TASK-010]
                └── sre-runbook.md
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
5. **Get template**: Gọi `sdlc_get_template({ templateId })` qua MCP
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
