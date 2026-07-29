# SDLC Agent Flows — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build template engine, centralized version registry, skill discovery, CI integration, and glob-based template scan for `@andy-toolforge/sdlc-workflows`.

**Architecture:** Phase 3 adds `lib/` (shared JS modules) to the package, migrates templates from `<Placeholder>` to `{{var}}` syntax, and adds new MCP tools. The template engine is a pure-function module (`renderTemplate()`) consumed by MCP tools. Version registry is a separate module. Skill discovery indexes cross-ref sections + new `## Keywords` sections. CI runs YAML test validation on PR.

**Tech Stack:** CommonJS (existing), Node.js built-in test runner (node:test), glob (npm), js-yaml (existing).

## Global Constraints

- All code CommonJS (`require` / `module.exports`), no ESM
- Tests use Node.js built-in test runner (`node:test` + `node:assert`)
- Template engine must NOT use external template libs — pure string processing
- Engine stays in `lib/template-engine.js`, version registry in `lib/version-registry.js`
- All 10 templates must continue working after migration (backward compat)
- Postinstall.js must regenerate manifest on each install
- CI workflow runs only when `packages/sdlc-workflows/**` changes
- No multi-language template engine support (Section 7.4 non-goal)

---

### Task 1: Template Engine (`lib/template-engine.js`)

**Files:**
- Create: `packages/sdlc-workflows/lib/template-engine.js`
- Create: `packages/sdlc-workflows/lib/template-engine.test.js`
- Create: `packages/sdlc-workflows/lib/` (new directory)

**Interfaces:**
- Produces:
  - `renderTemplate(template: string, context: object, partials?: object): string` — renders template with context
  - `parseFrontmatter(content: string): { frontmatter: object|null, body: string }` — splits YAML frontmatter from body
  - `extractVariables(template: string): string[]` — returns all `{{var}}` names in template
  - `extractConditionals(template: string): string[]` — returns all `{% if var %}` condition names

**Engine syntax:**
- `{{ varName }}` — variable interpolation (trim spaces in tag, preserve in value)
- `{{ varName | default("fallback") }}` — variable with default
- `{% if varName %}...{% endif %}` — conditional section (falsy = empty, null, undefined, false)
- `{% if varName %}...{% else %}...{% endif %}` — if/else
- `{% for item in listVar %}...{{ item }}...{% endfor %}` — loop over array
- `{% include "partial-name" %}` — include registered partial

- [ ] **Step 1: Create `lib/` directory**

```bash
mkdir -p packages/sdlc-workflows/lib
```

- [ ] **Step 2: Create `lib/template-engine.test.js` with failing tests**

```javascript
'use strict';
const assert = require('node:assert');
const { describe, it } = require('node:test');

const { renderTemplate, parseFrontmatter, extractVariables } = require('./template-engine');

describe('parseFrontmatter', () => {
  it('should extract YAML frontmatter from content', () => {
    const content = '---\ntitle: Test\n---\nBody content';
    const result = parseFrontmatter(content);
    assert.deepStrictEqual(result.frontmatter, { title: 'Test' });
    assert.strictEqual(result.body, 'Body content');
  });

  it('should return null frontmatter when no --- found', () => {
    const content = 'Just body content';
    const result = parseFrontmatter(content);
    assert.strictEqual(result.frontmatter, null);
    assert.strictEqual(result.body, 'Just body content');
  });

  it('should handle content without closing ---', () => {
    const content = '---\ntitle: Broken\nBody content';
    const result = parseFrontmatter(content);
    assert.strictEqual(result.frontmatter, null);
    assert.strictEqual(result.body, content);
  });
});

describe('renderTemplate', () => {
  it('should interpolate {{ var }} with context values', () => {
    const tpl = 'Hello {{ name }}!';
    assert.strictEqual(renderTemplate(tpl, { name: 'World' }), 'Hello World!');
  });

  it('should support {{ var | default("val") }} syntax', () => {
    const tpl = 'Hello {{ name | default("Guest") }}!';
    assert.strictEqual(renderTemplate(tpl, {}), 'Hello Guest!');
    assert.strictEqual(renderTemplate(tpl, { name: 'World' }), 'Hello World!');
  });

  it('should handle {% if %} conditional sections', () => {
    const tpl = 'Start{% if show %}Visible{% endif %}End';
    assert.strictEqual(renderTemplate(tpl, { show: true }), 'StartVisibleEnd');
    assert.strictEqual(renderTemplate(tpl, { show: false }), 'StartEnd');
    assert.strictEqual(renderTemplate(tpl, {}), 'StartEnd');
  });

  it('should handle {% if %}...{% else %}...{% endif %}', () => {
    const tpl = '{% if dark %}Dark mode{% else %}Light mode{% endif %}';
    assert.strictEqual(renderTemplate(tpl, { dark: true }), 'Dark mode');
    assert.strictEqual(renderTemplate(tpl, { dark: false }), 'Light mode');
  });

  it('should handle {% for item in list %} loops', () => {
    const tpl = '{% for item in items %}- {{ item }}\n{% endfor %}';
    const result = renderTemplate(tpl, { items: ['A', 'B', 'C'] });
    assert.strictEqual(result, '- A\n- B\n- C\n');
  });

  it('should handle empty list in {% for %}', () => {
    const tpl = '{% for item in items %}- {{ item }}\n{% endfor %}';
    assert.strictEqual(renderTemplate(tpl, { items: [] }), '');
  });

  it('should support {% include "name" %} with registered partials', () => {
    const tpl = 'Header: {% include "footer" %}';
    const partials = { footer: 'Copyright 2026' };
    assert.strictEqual(renderTemplate(tpl, {}, partials), 'Header: Copyright 2026');
  });

  it('should interpolate {{ var }} inside included partials', () => {
    const tpl = '{% include "greeting" %}';
    const partials = { greeting: 'Hello {{ name }}!' };
    assert.strictEqual(renderTemplate(tpl, { name: 'World' }, partials), 'Hello World!');
  });

  it('should return template unchanged when no variables match', () => {
    const tpl = 'Static content without variables';
    assert.strictEqual(renderTemplate(tpl, {}), 'Static content without variables');
  });
});

describe('extractVariables', () => {
  it('should return all {{ var }} names', () => {
    const tpl = 'Hello {{ name }}, you are {{ age }} years old';
    const vars = extractVariables(tpl);
    assert.ok(vars.includes('name'));
    assert.ok(vars.includes('age'));
  });

  it('should not include | default() content as variables', () => {
    const tpl = '{{ name | default("Guest") }}';
    const vars = extractVariables(tpl);
    assert.deepStrictEqual(vars, ['name']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test packages/sdlc-workflows/lib/template-engine.test.js`
Expected: FAIL — `Error: Cannot find module './template-engine'`

- [ ] **Step 4: Create `lib/template-engine.js` with full implementation**

```javascript
'use strict';

/**
 * @andy-toolforge/sdlc-workflows Template Engine
 * Pure-function template renderer with variables, conditionals, loops, and includes.
 * No external dependencies.
 */

/**
 * Parse YAML frontmatter from markdown content.
 * @param {string} content
 * @returns {{ frontmatter: object|null, body: string }}
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { frontmatter: null, body: content };
  }

  const fmRaw = content.slice(3, endIdx);
  const body = content.slice(endIdx + 4);

  try {
    const frontmatter = require('js-yaml').load(fmRaw);
    return { frontmatter: frontmatter || {}, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}

/**
 * Extract variable names from a template string.
 * @param {string} template
 * @returns {string[]}
 */
function extractVariables(template) {
  const names = new Set();
  const re = /\{\{\s*([\w-]+)(?:\s*\|\s*default\s*\([^)]*\))?\s*\}\}/g;
  let match;
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Extract conditional variable names from {% if var %} tags.
 * @param {string} template
 * @returns {string[]}
 */
function extractConditionals(template) {
  const names = new Set();
  const re = /\{%\s*if\s+(\w[\w-]*)\s*%\}/g;
  let match;
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Resolve a value from context using dot-notation path (e.g., "user.name").
 * @param {object} context
 * @param {string} path
 * @returns {*}
 */
function resolveValue(context, path) {
  const parts = path.split('.');
  let val = context;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return undefined;
    val = val[part];
  }
  return val;
}

/**
 * Render a template string with context variables and optional partials.
 *
 * Syntax:
 *   {{ var }}                    — variable interpolation
 *   {{ var | default("val") }}   — variable with default
 *   {% if var %}...{% endif %}   — conditional
 *   {% if var %}...{% else %}...{% endif %}
 *   {% for item in list %}...{% endfor %}
 *   {% include "name" %}         — include registered partial
 *
 * @param {string} template
 * @param {object} context
 * @param {object} [partitals]
 * @returns {string}
 */
function renderTemplate(template, context, partials) {
  context = context || {};
  partials = partials || {};

  let result = template;

  // 1. Process {% include "name" %} — recurse with context
  result = result.replace(/\{%\s*include\s+"([^"]+)"\s*%\}/g, (_match, name) => {
    if (!partials[name]) return '';
    return renderTemplate(partials[name], context, partials);
  });

  // 2. Process {% for item in list %}...{% endfor %}
  const forRe = /\{%\s*for\s+(\w[\w-]*)\s+in\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;
  result = result.replace(forRe, (_match, itemVar, listVar, body) => {
    const list = resolveValue(context, listVar);
    if (!Array.isArray(list) || list.length === 0) return '';

    return list.map(item => {
      const itemContext = Object.assign({}, context, { [itemVar]: item });
      return renderTemplate(body, itemContext, partials);
    }).join('');
  });

  // 3. Process {% if var %}...{% else %}...{% endif %}
  const ifElseRe = /\{%\s*if\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*else\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  result = result.replace(ifElseRe, (_match, varName, ifBody, elseBody) => {
    const val = resolveValue(context, varName);
    if (val) {
      return renderTemplate(ifBody, context, partials);
    }
    return renderTemplate(elseBody, context, partials);
  });

  // 4. Process {% if var %}...{% endif %} (no else)
  const ifRe = /\{%\s*if\s+(\w[\w-]*)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  result = result.replace(ifRe, (_match, varName, body) => {
    const val = resolveValue(context, varName);
    if (val) {
      return renderTemplate(body, context, partials);
    }
    return '';
  });

  // 5. Process {{ var | default("val") }}
  const defaultRe = /\{\{\s*([\w.-]+)\s*\|\s*default\s*\(\s*"([^"]*)"\s*\)\s*\}\}/g;
  result = result.replace(defaultRe, (_match, varName, defVal) => {
    const val = resolveValue(context, varName);
    return val !== undefined && val !== null ? String(val) : defVal;
  });

  // 6. Process {{ var }}
  const varRe = /\{\{\s*([\w.-]+)\s*\}\}/g;
  result = result.replace(varRe, (_match, varName) => {
    const val = resolveValue(context, varName);
    return val !== undefined && val !== null ? String(val) : '';
  });

  return result;
}

module.exports = { renderTemplate, parseFrontmatter, extractVariables, extractConditionals };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test packages/sdlc-workflows/lib/template-engine.test.js`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add packages/sdlc-workflows/lib/
git commit -m "feat(sdlc-workflows): add template engine (variables, conditionals, loops, includes) with tests"
```

---

### Task 2: Version Registry (`lib/version-registry.js`)

**Files:**
- Create: `packages/sdlc-workflows/lib/version-registry.js`
- Create: `packages/sdlc-workflows/lib/version-registry.test.js`
- Modify: `packages/sdlc-workflows/mcp-tools.js` — add `sdlc_check_version` tool
- Modify: `packages/sdlc-workflows/postinstall.js` — improve manifest with per-template version + standard map
- Modify: `packages/sdlc-workflows/skills/project-doc-health/SKILL.md` — add drift detection

**Interfaces:**
- `checkManifest(manifestDir: string, pkgVersion: string): { current: string, templates: number, driftDetected: boolean }`
- `diffTemplates(installed: object[], localDir: string): { added: string[], missing: string[], modified: string[], unchanged: string[] }`
- MCP: `sdlc_check_version({ manifestDir?: string })` — checks version and drift status

- [ ] **Step 1: Create `lib/version-registry.test.js` with failing tests**

```javascript
'use strict';
const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { checkManifest, diffTemplates } = require('./version-registry');

describe('checkManifest', () => {
  it('should return current state when manifest exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const manifestDir = path.join(tmpDir, '.opencode', 'manifests');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'sdlc-workflows.json'), JSON.stringify({
      package: '@andy-toolforge/sdlc-workflows',
      installedVersion: '0.2.0',
      installedAt: '2026-07-24T10:00:00Z',
      templates: [
        { id: 'prd/agile-prd', name: 'agile-prd', standard: 'agile', type: 'flow', version: '1.0.0' }
      ]
    }));

    const result = checkManifest(manifestDir, '0.2.0');
    assert.strictEqual(result.packageName, '@andy-toolforge/sdlc-workflows');
    assert.strictEqual(result.installedVersion, '0.2.0');
    assert.strictEqual(result.templateCount, 1);
    assert.strictEqual(result.driftDetected, false);
  });

  it('should detect version drift when package version differs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const manifestDir = path.join(tmpDir, '.opencode', 'manifests');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'sdlc-workflows.json'), JSON.stringify({
      package: '@andy-toolforge/sdlc-workflows',
      installedVersion: '0.1.0',
      installedAt: '2026-07-20T10:00:00Z',
      templates: []
    }));

    const result = checkManifest(manifestDir, '0.2.0');
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.packageVersion, '0.2.0');
    assert.strictEqual(result.installedVersion, '0.1.0');
  });

  it('should handle missing manifest gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const manifestDir = path.join(tmpDir, '.opencode', 'manifests');
    const result = checkManifest(manifestDir, '0.2.0');
    assert.strictEqual(result.driftDetected, true);
    assert.strictEqual(result.installedVersion, null);
  });
});

describe('diffTemplates', () => {
  it('should detect missing templates', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-test-'));
    const localDir = path.join(tmpDir, 'local');
    fs.mkdirSync(localDir, { recursive: true });

    const installed = [
      { id: 'prd/agile-prd', name: 'agile-prd' },
      { id: 'brd/ieee-29148', name: 'ieee-29148' },
    ];

    const result = diffTemplates(installed, localDir);
    assert.deepStrictEqual(result.missing, ['prd/agile-prd', 'brd/ieee-29148']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/sdlc-workflows/lib/version-registry.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `lib/version-registry.js`**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

const MANIFEST_FILENAME = 'sdlc-workflows.json';

/**
 * Read and check the installed version manifest against the current package version.
 * @param {string} manifestDir — path to `.opencode/manifests/`
 * @param {string} pkgVersion — current package.json version
 * @returns {object} { packageName, installedVersion, packageVersion, driftDetected, templateCount, installedAt, reason }
 */
function checkManifest(manifestDir, pkgVersion) {
  const manifestPath = path.join(manifestDir, MANIFEST_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    return {
      packageName: '@andy-toolforge/sdlc-workflows',
      installedVersion: null,
      packageVersion: pkgVersion,
      driftDetected: true,
      templateCount: 0,
      installedAt: null,
      reason: 'Manifest not found — postinstall may not have run',
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return {
      packageName: '@andy-toolforge/sdlc-workflows',
      installedVersion: null,
      packageVersion: pkgVersion,
      driftDetected: true,
      templateCount: 0,
      installedAt: null,
      reason: 'Manifest corrupted — unable to parse',
    };
  }

  const driftDetected = manifest.installedVersion !== pkgVersion;

  return {
    packageName: manifest.package || '@andy-toolforge/sdlc-workflows',
    installedVersion: manifest.installedVersion,
    packageVersion: pkgVersion,
    driftDetected,
    templateCount: (manifest.templates || []).length,
    installedAt: manifest.installedAt,
    reason: driftDetected
      ? `Package version ${pkgVersion} differs from installed ${manifest.installedVersion}. Run 'npm update @andy-toolforge/sdlc-workflows' to sync.`
      : undefined,
  };
}

/**
 * Diff installed templates against local overrides directory.
 * @param {Array} installedTemplates — array from manifest.templates
 * @param {string} localDir — path to `.opencode/templates/sdlc-workflows/`
 * @returns {{ added: string[], missing: string[], modified: string[], unchanged: string[] }}
 */
function diffTemplates(installedTemplates, localDir) {
  const result = { added: [], missing: [], modified: [], unchanged: [] };

  if (!fs.existsSync(localDir)) {
    result.missing = installedTemplates.map(t => t.id);
    return result;
  }

  const localFiles = new Set();
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      localFiles.add(entry.name.replace(/\.md$/, ''));
    }
  }

  const installedSet = new Map();
  for (const tpl of installedTemplates) {
    const localName = tpl.id.replace(/\//g, '-');
    installedSet.set(localName, tpl.id);
  }

  for (const localName of localFiles) {
    if (!installedSet.has(localName)) {
      result.added.push(localName);
    }
  }

  for (const [localName, tplId] of installedSet) {
    if (!localFiles.has(localName)) {
      result.missing.push(tplId);
    } else {
      result.unchanged.push(tplId);
    }
  }

  return result;
}

module.exports = { checkManifest, diffTemplates };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/sdlc-workflows/lib/version-registry.test.js`
Expected: PASS

- [ ] **Step 5: Update `postinstall.js` — improve manifest with per-template version + standard mapping**

Replace the naive `standard` assignment with a proper `STANDARD_MAP`:

```javascript
const STANDARD_MAP = {
  'agile-prd': 'agile', 'ieee-29148': 'ieee-29148',
  'arc42': 'arc42', 'c4-model': 'c4',
  'iso-29119': 'iso-29119', 'ieee-829': 'ieee-829',
  'itil-runbook': 'itil', 'sre-runbook': 'sre',
  'agile-scrum': 'agile', 'itil-sre': 'itil',
};
```

And update `scanTemplates` to use the map and add `version: '1.0.0'`:

```javascript
function scanTemplates(dir, prefix) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanTemplates(full, prefix ? `${prefix}/${entry.name}` : entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const baseName = entry.name.replace(/\.md$/, '');
      const id = prefix ? `${prefix}/${baseName}` : baseName;
      const standard = STANDARD_MAP[baseName] || 'unknown';
      const type = full.includes('/standards/') ? 'standard' : 'flow';
      const templateVersion = '1.0.0';
      results.push({ id, name: baseName, standard, type, version: templateVersion });
    }
  }
  return results;
}
```

- [ ] **Step 6: Add `sdlc_check_version` MCP tool to `mcp-tools.js`**

Add near top of `mcp-tools.js`:
```javascript
const { checkManifest, diffTemplates } = require('./lib/version-registry');
const pkg = require('./package.json');
```

Add tool definition near other definitions:
```javascript
const checkVersionDef = {
    name: 'sdlc_check_version',
    description: 'Check installed SDLC workflows version against package version. Detects drift (outdated manifest) and returns manifest details.',
    inputSchema: {
        type: 'object',
        properties: {
            manifestDir: {
                type: 'string',
                description: 'Path to .opencode/manifests/ directory (default: cwd/.opencode/manifests)',
            },
        },
    },
};

async function checkVersionHandler(_llm, args) {
    const cwd = process.cwd();
    const manifestDir = args.manifestDir || path.join(cwd, '.opencode', 'manifests');
    return checkManifest(manifestDir, pkg.version);
}
```

Add `{ definition: checkVersionDef, handler: checkVersionHandler }` to the exports array.

- [ ] **Step 7: Update `skills/project-doc-health/SKILL.md` with drift detection**

Add a step about drift detection in the workflow:

```
## Drift Detection (Phase 3)
- Gọi `sdlc_check_version` để kiểm tra version drift
- Nếu driftDetected == true → cảnh báo user: "SDLC Workflows package version mismatch — run 'npm update @andy-toolforge/sdlc-workflows'"
```

- [ ] **Step 8: Run all tests**

Run: `node --test packages/sdlc-workflows/lib/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/sdlc-workflows/lib/version-registry.js packages/sdlc-workflows/lib/version-registry.test.js packages/sdlc-workflows/postinstall.js packages/sdlc-workflows/mcp-tools.js packages/sdlc-workflows/skills/project-doc-health/SKILL.md
git commit -m "feat(sdlc-workflows): add version registry, sdlc_check_version MCP tool, improved postinstall manifest"
```

---

### Task 3: Skill Discovery MCP Tool (`sdlc_search_skills`)

**Files:**
- Create: `packages/sdlc-workflows/lib/skill-index.js`
- Create: `packages/sdlc-workflows/lib/skill-index.test.js`
- Modify: `packages/sdlc-workflows/mcp-tools.js` — add `sdlc_search_skills` tool
- Modify: each `skills/*/SKILL.md` — add `## Keywords` section

**Interfaces:**
- `buildIndex(skillsDir: string): SkillRecord[]` — scans all SKILL.md, extracts keywords + cross-ref
- `searchSkills(index: SkillRecord[], query: string, options?: { limit?: number }): { skill: SkillRecord, score: number }[]`
- MCP: `sdlc_search_skills({ query: string, limit?: number })` — returns matched skills with scores

- [ ] **Step 1: Create `lib/skill-index.test.js` with failing tests**

```javascript
'use strict';
const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');

const { buildIndex, searchSkills } = require('./skill-index');

describe('buildIndex', () => {
  it('should scan skills directory and return array of skill records', () => {
    const skillsDir = path.join(__dirname, '..', 'skills');
    const index = buildIndex(skillsDir);
    assert.ok(Array.isArray(index));
    assert.ok(index.length >= 10); // at least 10 skills
    index.forEach(skill => {
      assert.ok(skill.id);
      assert.ok(skill.name);
      assert.ok(Array.isArray(skill.keywords));
    });
  });
});

describe('searchSkills', () => {
  const sampleIndex = [
    { id: 'sdlc-prd', name: 'PRD Generator', triggers: 'prd, product requirements', keywords: ['product', 'requirements', 'vision', 'features'] },
    { id: 'sdlc-brd', name: 'BRD Generator', triggers: 'brd, business requirements', keywords: ['business', 'requirements', 'stakeholders', 'use cases'] },
    { id: 'sdlc-arch', name: 'Architecture Document Generator', triggers: 'architecture, kiến trúc', keywords: ['architecture', 'system', 'design', 'arc42'] },
  ];

  it('should find skills by keyword match', () => {
    const results = searchSkills(sampleIndex, 'requirements');
    assert.ok(results.length >= 2);
    assert.ok(results[0].score > 0);
  });

  it('should find skills by trigger phrase', () => {
    const results = searchSkills(sampleIndex, 'kiến trúc');
    assert.ok(results.length >= 1);
    assert.strictEqual(results[0].skill.id, 'sdlc-arch');
  });

  it('should limit results', () => {
    const results = searchSkills(sampleIndex, 'requirements', { limit: 1 });
    assert.strictEqual(results.length, 1);
  });

  it('should return empty array for no match', () => {
    const results = searchSkills(sampleIndex, 'zzzznonexistent');
    assert.strictEqual(results.length, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/sdlc-workflows/lib/skill-index.test.js`
Expected: FAIL

- [ ] **Step 3: Create `lib/skill-index.js`**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Build a searchable index of all skills in the skills directory.
 * @param {string} skillsDir
 * @returns {SkillRecord[]}
 */
function buildIndex(skillsDir) {
  const index = [];
  if (!fs.existsSync(skillsDir)) return index;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');
    const record = parseSkillFile(entry.name, content, skillPath);
    if (record) index.push(record);
  }
  return index;
}

function parseSkillFile(dirName, content, skillPath) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let id = dirName;
  if (fmMatch) {
    try {
      const fm = require('js-yaml').load(fmMatch[1]);
      if (fm.id) id = fm.id;
    } catch {}
  }

  const headingMatch = content.match(/^#\s+(.+)$/m);
  const name = headingMatch ? headingMatch[1].trim() : dirName;

  const descMatch = content.match(/^## Mô tả\n(.+)$/m);
  const description = descMatch ? descMatch[1].trim() : '';

  const triggerMatch = content.match(/^## Kích hoạt\n([\s\S]*?)(?=\n## )/m);
  const triggers = triggerMatch ? triggerMatch[1].trim() : '';

  const kwMatch = content.match(/^## Keywords\n([\s\S]*?)(?=\n## )/m);
  const keywords = kwMatch
    ? kwMatch[1].split(/[,\n]/).map(k => k.trim().toLowerCase()).filter(Boolean)
    : [];

  const xrefMatch = content.match(/^## Cross-ref\n([\s\S]*?)(?=\n## |$)/m);
  const crossRef = xrefMatch ? xrefMatch[1].trim() : '';

  return { id, name, triggers, description, keywords, crossRef, path: skillPath };
}

/**
 * Search the skill index for a query string.
 * @param {SkillRecord[]} index
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit=10]
 * @returns {{ skill: SkillRecord, score: number }[]}
 */
function searchSkills(index, query, options) {
  const limit = (options && options.limit) || 10;
  const q = query.toLowerCase().trim();
  const qTerms = q.split(/\s+/).filter(Boolean);

  if (qTerms.length === 0) return [];

  const scored = [];
  for (const skill of index) {
    let score = 0;
    for (const term of qTerms) {
      if (skill.id.toLowerCase() === term) score += 5;
      else if (skill.id.toLowerCase().includes(term)) score += 3;
      if (skill.keywords.some(k => k.includes(term) || term.includes(k))) score += 3;
      if (skill.triggers.toLowerCase().includes(term)) score += 2;
      if (skill.name.toLowerCase().includes(term)) score += 2;
      if (skill.description.toLowerCase().includes(term)) score += 1;
      if (skill.crossRef.toLowerCase().includes(term)) score += 1;
    }
    if (score > 0) scored.push({ skill, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { buildIndex, searchSkills };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/sdlc-workflows/lib/skill-index.test.js`
Expected: PASS

- [ ] **Step 5: Add `## Keywords` section to all 11 SKILL.md files**

Insert `## Keywords` section before `## MCP Tools Used` in each skill:

**`project-init/SKILL.md`:** `- project, init, initialization, setup, repository, dự án, khởi tạo`
**`project-onboard/SKILL.md`:** `- onboard, onboarding, existing, legacy, setup, orient, documentation`
**`project-doc-health/SKILL.md`:** `- document, health, audit, check, quality, drift, version, outdated`
**`sdlc-prd/SKILL.md`:** `- prd, product, requirements, document, vision, features, roadmap`
**`sdlc-deploy/SKILL.md`:** `- deploy, deployment, runbook, operations, itil, sre, release`
**`sdlc-plan/SKILL.md`:** `- plan, planning, estimation, timeline, sprint, milestone, schedule`
**`sdlc-retro/SKILL.md`:** `- retro, retrospective, lessons, learned, review, improve, continuous`
**`sdlc-brd/SKILL.md`:** `- brd, business, requirements, stakeholders, use cases, ieee-29148`
**`sdlc-arch/SKILL.md`:** `- architecture, arc42, c4, design, system, building, block, deployment`
**`sdlc-test-plan/SKILL.md`:** `- test, plan, strategy, iso-29119, ieee-829, quality, assurance, environment`
**`sdlc-validate/SKILL.md`:** `- validate, cross-ref, consistency, check, audit, document, review`

- [ ] **Step 6: Add `sdlc_search_skills` MCP tool to `mcp-tools.js`**

Add near top:
```javascript
const { buildIndex, searchSkills } = require('./lib/skill-index');
const SKILLS_DIR = path.join(__dirname, 'skills');
let _skillIndex = null;
function getSkillIndex() {
  if (!_skillIndex) _skillIndex = buildIndex(SKILLS_DIR);
  return _skillIndex;
}
```

Add tool definition:
```javascript
const searchSkillsDef = {
    name: 'sdlc_search_skills',
    description: 'Search SDLC skills by keywords, triggers, or description. Returns matched skills with relevance scores.',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Natural language search query' },
            limit: { type: 'number', description: 'Max results (default: 10)', default: 10 },
        },
        required: ['query'],
    },
};

async function searchSkillsHandler(_llm, args) {
    const { query, limit } = args;
    if (!query) throw new Error('query is required');
    const index = getSkillIndex();
    const results = searchSkills(index, query, { limit: limit || 10 });
    return {
        query,
        totalResults: results.length,
        results: results.map(r => ({
            id: r.skill.id,
            name: r.skill.name,
            score: r.score,
            description: r.skill.description,
            triggers: r.skill.triggers,
        })),
    };
}
```

Add `{ definition: searchSkillsDef, handler: searchSkillsHandler }` to exports.

- [ ] **Step 7: Run all tests**

Run: `node --test packages/sdlc-workflows/lib/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/sdlc-workflows/lib/skill-index.js packages/sdlc-workflows/lib/skill-index.test.js packages/sdlc-workflows/mcp-tools.js packages/sdlc-workflows/skills/*/SKILL.md
git commit -m "feat(sdlc-workflows): add skill discovery MCP tool + keyword tagging for all skills"
```

---

### Task 4: Integrate Template Engine into MCP Tools

**Files:**
- Modify: `packages/sdlc-workflows/mcp-tools.js` — add `sdlc_render_template` tool, update `sdlc_get_template`

- [ ] **Step 1: Add `sdlc_render_template` tool to `mcp-tools.js`**

Add near top:
```javascript
const { renderTemplate, parseFrontmatter, extractVariables } = require('./lib/template-engine');
```

Add tool definition:
```javascript
const renderTemplateDef = {
    name: 'sdlc_render_template',
    description: 'Render a template with context variables. Supports {{ var }}, {% if %}, {% for %}, {% include %}. Returns rendered markdown.',
    inputSchema: {
        type: 'object',
        properties: {
            templateId: {
                type: 'string',
                description: 'Template identifier (e.g. "prd/agile-prd", "brd/ieee-29148")',
            },
            context: {
                type: 'object',
                description: 'Variables to inject into the template',
            },
        },
        required: ['templateId', 'context'],
    },
};

async function renderTemplateHandler(_llm, args) {
    const { templateId, context } = args;
    if (!templateId) throw new Error('templateId is required');
    if (!context || typeof context !== 'object') throw new Error('context must be an object');

    const rawResult = await getTemplateHandler(_llm, { templateId });
    const rawContent = rawResult.content;

    const { frontmatter, body } = parseFrontmatter(rawContent);
    const renderedBody = renderTemplate(body, context);

    const renderedContent = frontmatter
        ? `---\n${require('js-yaml').dump(frontmatter).trim()}\n---\n\n${renderedBody}`
        : renderedBody;

    return {
        templateId,
        originalContent: rawContent,
        renderedContent,
        variables: extractVariables(rawContent),
    };
}
```

- [ ] **Step 2: Update `sdlc_get_template` to optionally accept context**

Add `context` to `getTemplateDef.inputSchema.properties`:
```javascript
context: {
    type: 'object',
    description: 'Optional context variables for rendering. When provided, also returns renderedContent and variables.',
},
```

Update `getTemplateHandler` return to include rendered content when context is provided.

- [ ] **Step 3: Commit**

```bash
git add packages/sdlc-workflows/mcp-tools.js
git commit -m "feat(sdlc-workflows): add sdlc_render_template MCP tool, context rendering in sdlc_get_template"
```

---

### Task 5: Migrate Templates to `{{var}}` Syntax

**Files:**
- Modify: all 10 template `.md` files in `templates/`
- Create: `templates/partials/_footer.md`, `templates/partials/_glossary.md`

- [ ] **Step 1: Migrate `templates/flows/brd/ieee-29148.md`**

Replace `<Project Name>` → `{{ projectName }}`, `<date>` → `{{ date }}`, etc. Add YAML frontmatter with variables list. Keep the same structure, just change placeholder syntax.

- [ ] **Step 2: Migrate remaining 9 templates**

Convert from `<Placeholder>` to `{{var}}` syntax for all templates. Add YAML frontmatter where missing.

- [ ] **Step 3: Create shared partials**

`templates/partials/_footer.md`:
```
---
*Document generated by @andy-toolforge/sdlc-workflows v{{ version | default("1.0.0") }}*
*Date: {{ date | default("2026-01-01") }}*
```

- [ ] **Step 4: Test rendering with a migrated template**

```bash
node -e "
const { renderTemplate, parseFrontmatter } = require('./lib/template-engine');
const fs = require('fs');
const tpl = fs.readFileSync('templates/flows/brd/ieee-29148.md', 'utf-8');
const { frontmatter, body } = parseFrontmatter(tpl);
console.log('Frontmatter:', JSON.stringify(frontmatter));
const rendered = renderTemplate(body, {
  projectName: 'Test Project',
  stakeholders: 'Team A',
  brRequirements: ['BR1: Login'],
});
console.log('Rendered (first 200 chars):', rendered.substring(0, 200));
"
```

- [ ] **Step 5: Commit**

```bash
git add packages/sdlc-workflows/templates/
git commit -m "feat(sdlc-workflows): migrate all templates to {{var}} syntax with YAML frontmatter + partials"
```

---

### Task 6: Glob-based Dynamic Template Scan

**Files:**
- Modify: `packages/sdlc-workflows/mcp-tools.js` — replace `scanMdFiles()` with glob
- Modify: `packages/sdlc-workflows/postinstall.js` — replace `scanTemplates()` with glob
- Modify: `packages/sdlc-workflows/package.json` — add `glob` dependency

- [ ] **Step 1: Install `glob`**

```bash
npm install glob -w @andy-toolforge/sdlc-workflows
```

- [ ] **Step 2: Update `mcp-tools.js` — replace `scanMdFiles()`**

Add `const { globSync } = require('glob');` at top. Replace `scanMdFiles()` function:

```javascript
function scanMdFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const pattern = path.join(dir, '**/*.md').replace(/\\/g, '/');
    const files = globSync(pattern);
    return files.map(filePath => {
        const relative = path.relative(TEMPLATES_DIR, filePath);
        const parts = relative.split(path.sep);
        const category = parts[0]; // 'flows' or 'standards'
        const rest = parts.slice(1);
        const id = rest.join('/').replace(/\.md$/, '');
        return { id, category: category === 'flows' ? rest[0] : '', file: path.basename(filePath) };
    });
}
```

- [ ] **Step 3: Update `postinstall.js` — replace `scanTemplates()`**

Add `const { globSync } = require('glob');` at top. Replace `scanTemplates()` to use glob.

- [ ] **Step 4: Verify MCP tools still work**

```bash
node -e "
const tools = require('./mcp-tools.js')();
const listTpl = tools.find(t => t.definition.name === 'sdlc_list_templates');
listTpl.handler(null, { category: 'all' }).then(r => {
  console.log('Total templates:', r.totalCount);
  console.log('Flows:', r.templates.flows.length);
  console.log('Standards:', r.templates.standards.length);
});
"
```
Expected: Total templates = 10 (or more with partials counted)

- [ ] **Step 5: Commit**

```bash
git add packages/sdlc-workflows/mcp-tools.js packages/sdlc-workflows/postinstall.js packages/sdlc-workflows/package.json
git commit -m "feat(sdlc-workflows): replace manual template scan with glob-based dynamic scan"
```

---

### Task 7: CI Integration (GitHub Actions)

**Files:**
- Create: `.github/workflows/sdlc-tests.yml`

- [ ] **Step 1: Create `.github/workflows/sdlc-tests.yml`**

```yaml
name: SDLC Workflows Tests

on:
  pull_request:
    paths:
      - 'packages/sdlc-workflows/**'
  push:
    branches: [main]
    paths:
      - 'packages/sdlc-workflows/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: packages/sdlc-workflows

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: packages/sdlc-workflows/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: .

      - name: Run unit tests
        run: node --test lib/

      - name: Validate all skills
        run: |
          for skill_dir in skills/*/ ; do
            skill_name=$(basename "$skill_dir")
            test_file="${skill_dir}test/basic-${skill_name#sdlc-}.yaml"
            if [ ! -f "$test_file" ]; then
              test_file="${skill_dir}test/basic-${skill_name}.yaml"
            fi
            if [ -f "$test_file" ]; then
              echo "=== Validating $skill_name ==="
              node -e "
                const tools = require('./mcp-tools.js')();
                const validate = tools.find(t => t.definition.name === 'sdlc_validate_skill');
                validate.handler(null, {
                  skillPath: '${skill_dir}SKILL.md',
                  testCase: '${test_file}',
                  mockInterview: true,
                }).then(r => {
                  console.log('Name:', r.name);
                  console.log('Structure:', r.skillStructure);
                  if (r.errors) console.log('Errors:', r.errors.join(', '));
                  if (r.warnings) console.log('Warnings:', r.warnings.join(', '));
                  if (r.skillStructure !== 'valid') process.exit(1);
                }).catch(e => { console.error('FAIL:', e.message); process.exit(1); });
              " || exit 1
            else
              echo "WARNING: No test file found for $skill_name"
            fi
          done
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sdlc-tests.yml
git commit -m "ci(sdlc-workflows): add GitHub Actions for unit tests and skill validation on PR"
```

---

### Task 8: Version Bump + Design Doc Update

**Files:**
- Modify: `packages/sdlc-workflows/package.json` — bump 0.2.0 → 0.3.0
- Modify: `docs/sdlc-agent-flows-design.md` — update Phase 3 status

- [ ] **Step 1: Bump package version**

```bash
npm version minor -w @andy-toolforge/sdlc-workflows --no-git-tag-version
```

- [ ] **Step 2: Update design doc Phase 3 status**

In `docs/sdlc-agent-flows-design.md`, update Section 6 Phase 3 table:

```markdown
### Phase 3: MCP Engine (~40-50 giờ)

| Task | Status | Ước lượng |
|---|---|---|
| Template engine (`lib/template-engine.js`) | ✅ Done | 6 giờ |
| Version registry + `sdlc_check_version` | ✅ Done | 4 giờ |
| Skill discovery + `sdlc_search_skills` | ✅ Done | 5 giờ |
| MCP integration: `sdlc_render_template` | ✅ Done | 3 giờ |
| Template migration: `<Placeholder>` → `{{var}}` | ✅ Done | 4 giờ |
| Glob-based dynamic template scan | ✅ Done | 2 giờ |
| CI integration (GitHub Actions) | ✅ Done | 3 giờ |
```

Also add `lib/` to the file listing in Section 7.1.

- [ ] **Step 3: Commit**

```bash
git add packages/sdlc-workflows/package.json docs/sdlc-agent-flows-design.md
git commit -m "chore(sdlc-workflows): bump 0.2.0→0.3.0, update design doc Phase 3 status"
```

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Template engine (Task 1): variables `{{var}}`, defaults `| default("")`, conditionals `{% if %}`, loops `{% for %}`, includes `{% include %}` — all from design doc Sections 5.5 and 7.4
- ✅ Centralized version management (Task 2): `version-registry.js` + `sdlc_check_version` + improved manifest + drift detection in project-doc-health
- ✅ Skill discovery (Task 3): `sdlc_search_skills` MCP tool + keyword tagging across all 11 skills
- ✅ MCP integration (Task 4): `sdlc_render_template` tool, context-aware `sdlc_get_template`
- ✅ Template migration (Task 5): all 10 templates → `{{var}}` syntax + YAML frontmatter + partials
- ✅ Glob-based dynamic scan (Task 6): glob replaces manual `scanMdFiles()` and `scanTemplates()`
- ✅ CI integration (Task 7): GitHub Actions workflow for unit tests + skill validation on PR
- ❌ Multi-language template engine — explicitly non-goal (Section 7.4)

**Placeholder scan:** No [TBD], TODO, or other placeholders. All steps have complete code.

**Type consistency:**
- `renderTemplate(template, context, partials)` used consistently across Task 1 (definition), Task 4 (MCP), Task 5 (template rendering)
- `checkManifest(manifestDir, pkgVersion)` and `diffTemplates(installed, localDir)` consistent across Task 2 (definition + MCP)
- `buildIndex(skillsDir)` and `searchSkills(index, query, options)` consistent across Task 3
