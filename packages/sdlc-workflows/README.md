# @andy-toolforge/sdlc-workflows

> **SDLC Agent Flows** — AI-driven SDLC document generation for agent workflows.
> Skill files + MCP plugin tools + template engine.

Part of the [@andy-toolforge](https://github.com/andy-toolforge) monorepo.

---

## Features

- **8 MCP tools** — `sdlc_get_template`, `sdlc_list_templates`, `sdlc_render_template`, `sdlc_get_standard`, `validate_document`, `sdlc_validate_skill`, `sdlc_check_version`, `sdlc_search_skills`
- **10 templates** — PRD (Agile), BRD (IEEE 29148), Architecture (arc42, C4), Runbook (ITIL, SRE), Test Plan (IEEE 829, ISO 29119)
- **2 standards** — Agile/Scrum reference, ITIL/SRE reference
- **10 skill files** — Plan, PRD, BRD, Arch, Deploy, Retro, Validate, Test Plan, Project Init, Project Onboard, Project Doc Health
- **Template engine** — Variables `{{ var }}`, defaults `{{ var | default("val") }}`, conditionals `{% if %}`, loops `{% for %}`, includes `{% include "_footer" %}`
- **Version registry** — Postinstall writes `.opencode/manifests/sdlc-workflows.json` for drift detection
- **Skill search** — Keyword index with relevance scoring across all skill files
- **Document validation** — Structure + frontmatter + placeholder checks against Agile, IEEE 29148, IEEE 829, ISO 29119, arc42 standards

---

## Installation

```bash
npm install @andy-toolforge/sdlc-workflows
```

### What happens on install

The `postinstall.js` script runs automatically:

1. **Skill file installation** — Symlinks skill `.md` files into `.opencode/skills/` (via `@andy-toolforge/core`'s `installSkills`), prefixed with `sdlc-workflows-`
2. **Version manifest** — Writes `.opencode/manifests/sdlc-workflows.json` with installed version, timestamp, and template inventory

### Compatibility

- **Node.js** >= 18
- **Package type**: CommonJS (`require()` / `module.exports`)
- **Dependencies**: `@andy-toolforge/core` ^1.0.0, `glob` ^13, `js-yaml` ^5

---

## Quick Start

### 1. Via MCP (recommended for agents)

The package auto-registers 8 tools with `@andy-toolforge/mcp`. If you use the MCP server, they're available immediately:

```
sdlc_get_template("prd/agile-prd")
sdlc_list_templates({ category: "flows" })
sdlc_render_template("prd/agile-prd", { projectName: "My App", vision: "..." })
sdlc_get_standard("agile-scrum")
validate_document({ documentPath: "./PRD.md", standard: "agile" })
sdlc_validate_skill({ skillPath: "./SKILL.md", testCase: "./test.yaml" })
sdlc_check_version()
sdlc_search_skills("deployment runbook")
```

### 2. Via CLI / programmatic

```js
const { getTemplate, renderDocument, validateDocument } = require('@andy-toolforge/sdlc-workflows');

// Read a template
const template = getTemplate('prd/agile-prd');
console.log(template.content);

// Render with context
const doc = renderDocument('prd/agile-prd', {
  projectName: 'My SaaS App',
  vision: 'A platform that automates X for Y',
  features: [
    { name: 'Auth', description: 'OAuth login with Google/GitHub' },
    { name: 'Dashboard', description: 'Real-time analytics dashboard' },
  ],
});
console.log(doc.renderedContent);

// Validate against a standard
const result = validateDocument('./docs/PRD.md', 'agile');
console.log(result.valid ? 'PASS' : 'FAIL', result.errors);
```

---

## MCP Tools Reference

All 8 tools are exported from `mcp-tools.js` and auto-discovered by `@andy-toolforge/mcp`.

| Tool | Description |
|------|-------------|
| `sdlc_get_template` | Read a template file by ID (e.g. `prd/agile-prd`). Optionally pass `context` to also get rendered output |
| `sdlc_list_templates` | List all templates grouped by category (`flows`, `standards`, `all`) |
| `sdlc_render_template` | Render a template with context variables — supports `{{ }}`, `{% if %}`, `{% for %}`, `{% include %}` |
| `sdlc_get_standard` | Read a standard/reference file by ID (e.g. `agile-scrum`, `itil-sre`) |
| `validate_document` | Validate an SDLC document against a standard — checks frontmatter, required sections, placeholders |
| `sdlc_validate_skill` | Validate a SKILL.md against a YAML test case — checks structure, required sections, frontmatter |
| `sdlc_check_version` | Detect version drift between installed package and local manifest |
| `sdlc_search_skills` | Search SDLC skills by keywords or trigger phrases, returns relevance-scored results |

---

## Templates Reference

### Flow Templates (under `templates/flows/`)

| ID | Standard | Description |
|----|----------|-------------|
| `prd/agile-prd` | Agile | Product Requirements Document with vision, audience, features, success metrics |
| `brd/ieee-29148` | IEEE 29148 | Business Requirements Document with stakeholders, use cases, business rules |
| `arch/arc42` | arc42 | Architecture documentation (12-section arc42 template) |
| `arch/c4-model` | C4 | C4 model architecture documentation |
| `deploy/itil-runbook` | ITIL | ITIL-aligned operations runbook |
| `deploy/sre-runbook` | SRE | SRE-aligned site reliability runbook |
| `test-plan/ieee-829` | IEEE 829 | Test Plan document with items, schedule, risks, approvals |
| `test-plan/iso-29119` | ISO 29119 | ISO-aligned test plan |

### Standard References (under `templates/standards/`)

| ID | Description |
|----|-------------|
| `agile-scrum` | Agile & Scrum roles, events, artifacts, principles reference |
| `itil-sre` | ITIL & SRE practices reference |

### Partials (under `templates/partials/`)

| ID | Description |
|----|-------------|
| `_footer` | Standard document footer with version and confidentiality notice |
| `_glossary` | Standard glossary table |

---

## Skills Reference

10 skill files under `skills/`, installed to `.opencode/skills/sdlc-workflows-*` on `npm install`:

| Skill | Purpose |
|-------|---------|
| `sdlc-plan` | Sprint/iteration planning workflow |
| `sdlc-prd` | PRD generation using Agile template |
| `sdlc-brd` | BRD generation using IEEE 29148 template |
| `sdlc-arch` | Architecture documentation using arc42/C4 templates |
| `sdlc-deploy` | Deployment runbook generation |
| `sdlc-retro` | Retrospective facilitation workflow |
| `sdlc-validate` | Document validation workflow |
| `sdlc-test-plan` | Test plan generation |
| `project-init` | New project initialization workflow |
| `project-onboard` | Team onboarding workflow |
| `project-doc-health` | Document health check workflow |

Each skill includes a YAML test case under `skills/<name>/test/`.

---

## Template Engine Syntax

Used by the MCP tools `sdlc_render_template` and `sdlc_get_template` (with `context`).

```
{{ variable }}                          — Variable interpolation
{{ variable | default("fallback") }}    — Variable with default value
{{ user.name }}                         — Dot-notation nested access

{% if showSection %}...{% endif %}               — Conditional
{% if showSection %}...{% else %}...{% endif %}  — Conditional with else

{% for item in items %}
  {{ item.name }} — {{ loop.index }}
{% endfor %}

{% include "_footer" %}                 — Include a registered partial
```

---

## Programmatic API

The package currently exports an empty module (`index.js`). Main functionality is accessed through MCP tools. For programmatic use, require the sub-modules directly:

```js
const { renderTemplate, parseFrontmatter, extractVariables } = require('@andy-toolforge/sdlc-workflows/lib/template-engine');
const { checkManifest } = require('@andy-toolforge/sdlc-workflows/lib/version-registry');
const { buildIndex, searchSkills } = require('@andy-toolforge/sdlc-workflows/lib/skill-index');
```

---

## Migration Guide

### From manual document management

**Before:** You manually create PRDs, BRDs, and architecture docs from scratch or copy-paste old documents. Templates live in random `docs/` folders. No validation, no skills, no version tracking.

**After:** Structured templates + AI-driven generation + validation + skill files.

#### Step 1: Install

```bash
cd your-project
npm install @andy-toolforge/sdlc-workflows
```

This creates:
- `.opencode/skills/sdlc-workflows-<name>.md` (skill files)
- `.opencode/manifests/sdlc-workflows.json` (version manifest)

#### Step 2: Verify installation

```bash
node -e "const pkg = require('@andy-toolforge/sdlc-workflows/package.json'); console.log('SDLC Workflows v' + pkg.version)"
ls .opencode/skills/ | grep sdlc-workflows
```

You should see 10+ skill files with the `sdlc-workflows-` prefix.

#### Step 3: Migrate existing documents

**Scenario A — You have an existing PRD:**

1. Identify which template fits (e.g., `prd/agile-prd` for Agile PRD)
2. Use `sdlc_get_template("prd/agile-prd")` to see the expected structure
3. Run `validate_document({ documentPath: "./legacy/old-prd.md", standard: "agile" })` to check gaps
4. Add frontmatter to match the template's YAML section
5. Migrate sections one-by-one into the template structure

**Scenario B — You're starting fresh:**

1. Call `sdlc_get_template("brd/ieee-29148")` to get the BRD template
2. Fill in variables via `sdlc_render_template("brd/ieee-29148", { projectName: "..." })`
3. Validate with `validate_document`
4. Commit

**Scenario C — You run an agent workflow:**

1. The agent calls `sdlc_search_skills("write a PRD")` to find the right skill
2. Loads `sdlc-prd` skill → follows the workflow
3. Uses `sdlc_get_template("prd/agile-prd")` via MCP
4. Renders with project context
5. Validates before saving

#### Step 4: Standardize conventions

Before — random document formats:
```markdown
# PRD for Project X
...
```

After — structured with frontmatter:
```markdown
---
standard: agile
version: 1.0.0
---
# PRD: Project X
## 1. Vision
...
## 3. Problem Statement
...
## 5. Features
...
```

This enables validation, version tracking, and automated quality checks.

#### Step 5: Integrate into CI (optional)

```yaml
# .github/workflows/doc-validate.yml
name: Validate SDLC Documents
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install @andy-toolforge/sdlc-workflows
      - run: |
          node -e "
            const { validateDocument } = require('@andy-toolforge/sdlc-workflows/lib/validate');
            const glob = require('glob');
            const files = glob.sync('docs/**/*.md');
            let fail = 0;
            for (const f of files) {
              const r = validateDocument(f, 'agile');
              if (!r.valid) { fail++; console.log('FAIL', f, r.errors); }
            }
            process.exit(fail ? 1 : 0);
          "
```

### From another template system

**Keeping existing templates?** Place them in `templates/flows/` alongside the built-in ones:

```
your-project/
  node_modules/@andy-toolforge/sdlc-workflows/templates/
    flows/
      your-custom-template.md   ← will be found by sdlc_get_template
```

Or point agent workflows to a custom directory via MCP configuration.

### Version drift detection

If you upgrade `@andy-toolforge/sdlc-workflows` but forget to re-run `postinstall`:

```bash
node -e "require('@andy-toolforge/sdlc-workflows/mcp-tools')()"
# → calls sdlc_check_version → compares installed package version vs manifest
# → warns if drift detected
```

Run `npm install @andy-toolforge/sdlc-workflows` again to sync.

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.3.0 | 2026-07-24 | Template engine, version registry, skill search, glob scan, CI |
| 0.2.0 | 2026-07-23 | 8 MCP tools, 10 templates, 10 skills, document validation |
| 0.1.0 | 2026-07-22 | Initial release — basic skill files + templates |
