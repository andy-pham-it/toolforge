# @andy-toolforge/sdlc-workflows — SDLC Agent Workflows

> SDLC document generation engine: skill file discovery, template rendering,
> version registry, and MCP-based tool registration for AI-driven SDLC workflows.
>
> **MCP-only package** — `index.js` exports `{}` (empty). All capabilities are
> exposed via MCP tool handlers in `mcp-tools/`. Domain packages use the
> SkillIndex to discover skill files at runtime.

## Structure

```
packages/sdlc-workflows/
  index.js              — Entry: exports {} (MCP-only)
  lib/
    skill-index.js      — SkillIndex — Discover skill files for domain packages
    template-engine.js  — TemplateEngine — Nunjucks-like template rendering
    version-registry.js — VersionRegistry — Version check against npm/pypi
  mcp-tools/             — MCP tool handlers (9 modules, split from monolithic mcp-tools.js)
  skills/               — 11+ SDLC skill categories
    arch/               — Architecture design skills
    brd/                — Business requirements document skills
    deploy/             — Deployment runbook skills
    plan/               — Planning skills
    prd/                — Product requirements document skills
    retro/              — Retrospective skills
    test-plan/          — Test plan skills
    validate/           — Validation skills
    project-doc-health/
    project-init/
    project-onboard/
  templates/            — SDLC document templates
  postinstall.js        — Skill file installation
  package.json          — deps: @andy-toolforge/core, glob, js-yaml
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `SkillIndex` | `lib/skill-index.js` | Discover skill files for a domain package. Methods: `findSkills(domain)`, `listAll()`, `search(query)`. |
| `TemplateEngine` | `lib/template-engine.js` | Nunjucks-like template rendering with variables, conditionals, includes. Methods: `render(template, context)`, `renderFile(path, context)`. |
| `VersionRegistry` | `lib/version-registry.js` | Check installed version against npm/pypi registry. Methods: `checkNpm(packageName)`, `checkPypi(packageName)`, `diff(current, latest)`. |

### Tool categories (from mcp-tools/)

The MCP tools cover: document generation, validation, skill search, template rendering,
version checking, and project initialization workflows. Tools invoke domain package logic
or use internal TemplateEngine/SkillIndex.

## Conventions

- **MCP-only pattern**: `index.js` exports `{}`; all functionality is via MCP tools.
- Skill files are YAML+Markdown with frontmatter (trigger phrases, description).
- Template format: Handlebars-like `{{ var }}`, `{% if %}`, `{% for %}`, `{% include %}`.
- Uses `glob` (not `fast-glob`) for file discovery — consistent across toolforge.
- Skill files prefixed with `sdlc-workflows-`.
- MCP tools loaded dynamically by mcp server from `mcp-tools/`.

## Testing

```bash
npm test -w @andy-toolforge/sdlc-workflows
```

## See also

- `packages/sdlc-workflows/skills/` — SDLC skill prompt files
- `packages/sdlc-workflows/templates/` — SDLC document templates
- `packages/mcp/` — MCP server that loads these tools
