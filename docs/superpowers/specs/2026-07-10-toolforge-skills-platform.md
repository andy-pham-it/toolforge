# Toolforge Skills Platform — Design Specification

## Overview

Standardize and expand the toolforge skills system across all 11 packages. The MCP skills (6 files) were the pilot; this project generalizes that pattern to the entire monorepo.

**Current state:** 32 skill files across 10 domain packages, each with a duplicate `postinstall.js`. Skills are self-contained without cross-references, error recovery, or MCP tool integration notes.

**Desired state:** Shared postinstall infrastructure in core, domain hub skills for every package, quality-assured skill files with cross-domain references and error recovery.

---

## Phase 1: Infrastructure — Extract postinstall.js to core

### Problem

Every domain package has an identical `postinstall.js` (27 lines, only `DOMAIN` variable differs). MCP's copy lives at `scripts/postinstall.js` instead of `skills/postinstall.js`. Total: 11 copies of the same code.

### Solution

Add `lib/postinstall-skills.js` to `@andy-toolforge/core` with a single exported function:

```js
// lib/postinstall-skills.js
const fs = require('fs');
const path = require('path');

/**
 * Install skill .md files from a package's skills/ directory
 * to .opencode/skills/ with a domain prefix.
 * Designed to be called from a package's postinstall script.
 */
function installSkills(domain) {
  const projectRoot = process.cwd();
  const targetDir = path.join(projectRoot, '.opencode', 'skills');
  const sourceDir = path.join(__dirname, '..', '..', domain, 'skills');
  // ... same logic as current postinstall.js
}
```

Wait — that won't work because `__dirname` in core won't resolve to the calling package's skills dir. Core is at `node_modules/@andy-toolforge/core/lib/`. The calling package is at `packages/<name>/skills/`.

Actually, let me reconsider. The postinstall script lives IN the package that's being installed. When a postinstall runs, `process.cwd()` is the package directory. So the domain package's postinstall.js:

```js
const { installSkills } = require('@andy-toolforge/core/lib/postinstall-skills');
installSkills({ domain: 'footage-generation', skillsDir: __dirname });
```

Core's function:
```js
function installSkills({ domain, skillsDir }) {
  const targetDir = path.join(process.cwd(), '.opencode', 'skills');
  // read from skillsDir, symlink with domain- prefix
}
```

This keeps the logic in core (single source of truth) while the calling package only passes its domain name and directory.

### Files changed

| File | Action |
|------|--------|
| `packages/core/lib/postinstall-skills.js` | **Create** — exported `installSkills({ domain, skillsDir })` |
| `packages/core/lib/index.js` | **Modify** — re-export `installSkills` |
| `packages/*/skills/postinstall.js` (10 packages) | **Modify** — 1-liner call to core |
| `packages/mcp/skills/postinstall.js` | **Create** (move from scripts/postinstall.js) |
| `packages/mcp/scripts/postinstall.js` | **Delete** |
| `packages/mcp/package.json` | **Modify** — update `files[]` paths |

### Risk

- Core must be installed before postinstall runs. npm handles this: workspace dependencies are installed in dependency order.
- Symlinks may fail on some platforms → fallback to copy (already handled).

---

## Phase 2: Domain Hub Skills

### Problem

Each domain package exposes 4-7 tools via MCP, but there is no single skill file that lists ALL of a domain's capabilities. Agents using toolforge tools need to discover what's available per domain.

### Solution

Add one hub skill per domain in `packages/<domain>/skills/<domain>-hub.md`, following `andy-toolforge.md` pattern:

- YAML frontmatter with `name` and `description`
- List of all tools the domain provides
- Common workflow patterns
- Integration with MCP server (`skill_mcp(mcp_name="andy-toolforge", tool_name="...")`)
- Cross-reference to related domains

### New hub skills (10)

| Domain | Hub Skill | Current skills count |
|--------|-----------|---------------------|
| `footage-generation` | `footage-generation-hub.md` | 4 existing + hub |
| `content-research` | `content-research-hub.md` | 4 existing + hub |
| `content-operations` | `content-operations-hub.md` | 7 existing + hub |
| `seo-generation` | `seo-generation-hub.md` | 3 existing + hub |
| `ba-support` | `ba-support-hub.md` | 2 existing + hub |
| `book-writing` | `book-writing-hub.md` | 2 existing + hub |
| `coding-support` | `coding-support-hub.md` | 2 existing + hub |
| `pm-support` | `pm-support-hub.md` | 2 existing + hub |
| `tts-generator` | `tts-generator-hub.md` | 2 existing + hub |
| `voice-assistant` | `voice-assistant-hub.md` | 1 existing + hub |

**Format example:**

```markdown
---
name: footage-generation-hub
description: Use when creating images, overlays, prompts, BGM maps, or cover art for podcast/video content.
---

# Footage Generation Hub

## MCP Server
All tools available via: `skill_mcp(mcp_name="andy-toolforge", tool_name="<name>")`

## Tools

| Tool | What it does |
|------|-------------|
| `analyze_script` | Analyze script → visual segments with prompts |
| `generate_prompts` | Generate image prompts per segment |
| ... | ... |

## Workflow

[Short workflow: analyze → prompts → images → BGM → cover]

## Related skills
...
```

---

## Phase 3: Quality Pass + Fill Gaps

### Quality pass on all 32 existing skills

Each skill file receives:

1. **Prerequisites section** — what inputs/tools/API keys needed
2. **Error recovery** — "if X fails, try Y"
3. **Cross-domain references** — "this integrates with content-operations for workflow"
4. **MCP tool integration note** — `skill_mcp(mcp_name="andy-toolforge", ...)` alternative
5. **YAML frontmatter** if missing (some existing skills lack it)

### Fill gaps in sparse domains

| Domain | Current skills | Gap to fill |
|--------|---------------|-------------|
| `voice-assistant` | 1 (workflow) | Add voice-session-management skill |
| `tts-generator` | 2 | Adequate |
| `pm-support` | 2 | Add timeline-tracking or milestone skill |
| `ba-support` | 2 | Adequate |
| `book-writing` | 2 | Adequate |
| `coding-support` | 2 | Add architecture-analyzer skill |

---

## Execution Order

```
Phase 1 (Infra)
  └─ Phase 2 (Hubs) — independent of Phase 1, could be parallel
       └─ Phase 3 (Quality) — needs Phase 2 for cross-refs
```

---

## Rollback

- Each phase produces a commit; rollback per commit
- Phase 1: `git revert` the postinstall extraction commit → copy back old postinstall.js
- Phase 2: `git revert` hub skill creation
- Phase 3: `git revert` quality pass commit
