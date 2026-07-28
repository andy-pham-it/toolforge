# Improve sdlc-workflows: split, cache, typed errors, tests, elif, debug

## Goal
Refactor the sdlc-workflows package to reduce maintenance debt, eliminate data duplication, improve reliability, and enable CI integration — all while keeping existing tests green and the MCP tool API unchanged.

## Constraints
- All existing tests must continue to pass
- CommonJS (require/module.exports) — no ESM
- The module.exports signature from mcp-tools must remain: `function()` returning array of `{definition, handler}`
- New `{% elif %}` syntax is additive — does not break existing templates

## Acceptance criteria
- [ ] mcp-tools.js is split into 9 files under mcp-tools/ (index.js + 8 tool files)
- [ ] validate_document reads required sections from template standards files (not hardcoded)
- [ ] buildIndex has a 30-second TTL cache
- [ ] Template engine supports `{% elif var %}` syntax
- [ ] lib/errors.js exports ToolInputError, ToolNotFoundError, ToolInternalError
- [ ] All handlers throw typed errors with correct MCP error codes
- [ ] mcp-server.test.js has 6+ integration tests (tools/list, tools/call for each tool, error cases)
- [ ] MCP server accepts --debug flag and logs per-call duration
- [ ] npm test -w @andy-toolforge/sdlc-workflows passes

## File-level changes

### new: packages/sdlc-workflows/lib/errors.js
- Create ToolInputError(code=-32602), ToolNotFoundError(code=-32602), ToolInternalError(code=-32000)
- All extend Error with numeric `code` property

### edit: packages/sdlc-workflows/lib/template-engine.js
- Add `{% elif var %}` parsing in renderTemplate (between if and else/endif)
- Support chained: {% if %}...{% elif %}...{% elif %}...{% else %}...{% endif %}

### modified: packages/sdlc-workflows/mcp-tools.js → packages/sdlc-workflows/mcp-tools/
- Delete mcp-tools.js (single file)
- Create mcp-tools/ directory with 9 files:
  - index.js — imports all tools, exports the function() returning the array
  - get-template.js — getTemplateDef + getTemplateHandler
  - list-templates.js — listTemplatesDef + listTemplatesHandler
  - get-standard.js — getStandardDef + getStandardHandler
  - validate-document.js — validateDocDef + validateDocumentHandler (updated: reads standards from templates)
  - validate-skill.js — validateSkillDef + validateSkillHandler
  - check-version.js — checkVersionDef + checkVersionHandler
  - search-skills.js — searchSkillsDef + searchSkillsHandler (updated: TTL cache)
  - render-template.js — renderTemplateDef + renderTemplateHandler
- All handlers use typed errors from lib/errors.js

### edit: packages/sdlc-workflows/mcp-server.js
- Accept --debug flag via process.argv
- When --debug is set, log each tool call with name + duration
- Use error.code in JSON-RPC error response (instead of hardcoded -32000)

### edit: packages/sdlc-workflows/package.json
- Update `files` array: add `mcp-tools/`, remove `mcp-tools.js`
- Ensure `mcp-tools/` is included for npm publish

### new: packages/sdlc-workflows/mcp-server.test.js
- Integration tests spawning MCP server as child process:
  - tools/list returns 8 tools with correct shape
  - tools/call with valid args succeeds
  - tools/call with missing args returns error
  - tools/call with unknown tool returns error
  - initialize handshake works
  - unknown method returns error

### edit: packages/sdlc-workflows/mcp-tools/search-skills.js (validate-document.js)
- validate-document.js: replace hardcoded standards map with dynamic reading from templates/flows/
  - For each standard key (agile → templates/flows/prd/agile-prd.md), parse the headings
  - Derive required sections from ## headings in the template
- search-skills.js: add TTL cache (30s) around getSkillIndex/buildIndex

## Test plan
1. `npm test -w @andy-toolforge/sdlc-workflows` — existing 23 tests must pass
2. New mcp-server.test.js — 6+ tests spawning child process
3. Template engine tests — add 2-3 tests for {% elif %}

## Out of scope
- sdlc_init_project tool (future v1.0)
- Template inheritance (extend/block)
- NPM registry check (version-registry stays local-only)

## Open questions
- None — all items are well-defined from the retrospective analysis
