# Skills Platform — Phase 1: Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated `postinstall.js` logic into `@andy-toolforge/core` so all 11 packages share one implementation.

**Architecture:** Add `lib/postinstall-skills.js` to core exporting `installSkills({ domain, sourceDir })`. Replace each package's 27-line postinstall with a 3-line require + call. Move MCP's postinstall from `scripts/` to `skills/` to align paths.

**Tech Stack:** CommonJS, Node.js `fs` and `path`, npm workspaces

## Global Constraints

- All code is CommonJS (`require` / `module.exports`), never ESM
- Tests use Node built-in `node --test` / `node:assert`
- No new dependencies on core (must be zero-additional-dep)
- The function signature must work both in dev (workspaces) and production (published npm)
- Symlink fallback to copy already handled; preserve it

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/core/lib/postinstall-skills.js` | **Create** | Exports `installSkills({ domain, sourceDir })` — the shared logic |
| `packages/core/lib/postinstall-skills.test.js` | **Create** | Tests for `installSkills` using temp dirs |
| `packages/core/lib/index.js` | **Modify** | Re-export `installSkills` from the main entry |
| `packages/*/skills/postinstall.js` (10 packages) | **Modify** | Replace 27 lines with 3-line require call |
| `packages/mcp/skills/postinstall.js` | **Create** | New 3-line postinstall (same as others) |
| `packages/mcp/scripts/postinstall.js` | **Delete** | Old location |
| `packages/mcp/package.json` | **Modify** | Update `files[]` and `scripts.postinstall` path |

All domain packages follow the same pattern — files that change together live near each other.

---

### Task 1: Create core's `lib/postinstall-skills.js`

**Files:**
- Create: `packages/core/lib/postinstall-skills.js`

**Interfaces:**
- Produces: `installSkills({ domain: string, sourceDir: string }) => void`

- [ ] **Step 1: Write the core function**

```js
// packages/core/lib/postinstall-skills.js
const fs = require('fs');
const path = require('path');

/**
 * Install skill .md files from a package's skills/ directory
 * into .opencode/skills/ with a domain prefix.
 *
 * Designed to be called from a package's postinstall script.
 * Falls back to copy if symlink fails (e.g., on some CI or non-POSIX systems).
 *
 * @param {object} opts
 * @param {string} opts.domain  - Prefix for skill file names (e.g. 'footage-generation')
 * @param {string} opts.sourceDir - Absolute path to the directory containing .md skill files
 */
function installSkills({ domain, sourceDir }) {
  const projectRoot = process.cwd();
  const targetDir = path.join(projectRoot, '.opencode', 'skills');

  fs.mkdirSync(targetDir, { recursive: true });

  let count = 0;
  fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.md') && file !== 'postinstall.js') {
      const src = path.join(sourceDir, file);
      const destName = `${domain}-${file.replace(/\s+/g, '_')}`;
      const dest = path.join(targetDir, destName);
      if (!fs.existsSync(dest)) {
        try {
          fs.symlinkSync(path.relative(targetDir, src), dest);
          console.log(`  🔗 Linked ${destName}`);
          count++;
        } catch (e) {
          // Fallback: copy if symlink fails
          fs.copyFileSync(src, dest);
          console.log(`  📄 Copied ${destName}`);
          count++;
        }
      }
    }
  });

  if (count === 0) {
    console.log(`  ℹ️  No new skill files to install for "${domain}"`);
  }
}

module.exports = { installSkills };
```

- [ ] **Step 2: Create the test file**

```js
// packages/core/lib/postinstall-skills.test.js
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { installSkills } = require('./postinstall-skills');

describe('installSkills', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-skills-test-'));
  const skillsDir = path.join(tmpDir, 'skills');
  const targetDir = path.join(tmpDir, '.opencode', 'skills');

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should symlink .md files with domain prefix', () => {
    // Setup: create skills dir with .md files
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'test-skill.md'), '# Test');
    fs.writeFileSync(path.join(skillsDir, 'postinstall.js'), '// not a skill'); // should be skipped

    // We need to run installSkills from tmpDir so process.cwd() points there
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      installSkills({ domain: 'test-domain', sourceDir: skillsDir });

      // Verify
      const targetFile = path.join(targetDir, 'test-domain-test-skill.md');
      assert.ok(fs.existsSync(targetFile), 'Symlink should exist');
      
      // Should be a symlink (or copy on platforms without symlink support)
      const content = fs.readFileSync(targetFile, 'utf-8');
      assert.equal(content, '# Test');

      // postinstall.js should NOT be linked
      assert.ok(!fs.existsSync(path.join(targetDir, 'test-domain-postinstall.md')));
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('should skip existing files (idempotent)', () => {
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'existing.md'), '# Original');
    fs.writeFileSync(path.join(targetDir, 'test-domain-existing.md'), '# Existing');

    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      // Should not throw or overwrite
      installSkills({ domain: 'test-domain', sourceDir: skillsDir });
      
      const content = fs.readFileSync(path.join(targetDir, 'test-domain-existing.md'), 'utf-8');
      assert.equal(content, '# Existing', 'Should preserve existing file');
    } finally {
      process.cwd = originalCwd;
    }
  });
});
```

- [ ] **Step 3: Run core tests**

```bash
npm test -w @andy-toolforge/core
```
Expected: All tests pass (including the 2 new ones).

- [ ] **Step 4: Commit**

```bash
git add packages/core/lib/postinstall-skills.js packages/core/lib/postinstall-skills.test.js
git commit -m "feat(core): add installSkills() for shared postinstall logic"
```

---

### Task 2: Update core's `lib/index.js` export

**Files:**
- Modify: `packages/core/lib/index.js`

- [ ] **Step 1: Add `installSkills` to exports**

```js
const LLMClient = require('./llm');
const BrowserManager = require('./browser');
const Logger = require('./logger');
const JobQueue = require('./queue');
const { installSkills } = require('./postinstall-skills');

module.exports = {
    LLMClient,
    BrowserManager,
    Logger,
    JobQueue,
    installSkills,
};
```

- [ ] **Step 2: Verify core tests still pass**

```bash
npm test -w @andy-toolforge/core
```
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/lib/index.js
git commit -m "feat(core): export installSkills from main index"
```

---

### Task 3: Update 10 domain package postinstall scripts

**Files:**
- Modify: `packages/*/skills/postinstall.js` for all 10 domain packages:
  - footage-generation
  - content-research
  - content-operations
  - seo-generation
  - ba-support
  - book-writing
  - coding-support
  - pm-support
  - tts-generator
  - voice-assistant

- [ ] **Step 1: Replace each postinstall.js content**

Every domain package gets the SAME content:

```js
// packages/<domain>/skills/postinstall.js
const { installSkills } = require('@andy-toolforge/core');

installSkills({
  domain: '<domain-name>',
  sourceDir: __dirname,
});
```

Replace `<domain-name>` with the actual npm package name suffix:
- `footage-generation`
- `content-research`
- `content-operations`
- `seo-generation`
- `ba-support`
- `book-writing`
- `coding-support`
- `pm-support`
- `tts-generator`
- `voice-assistant`

- [ ] **Step 2: Run tests for each modified package**

```bash
npm test -w @andy-toolforge/footage-generation -w @andy-toolforge/content-research -w @andy-toolforge/content-operations -w @andy-toolforge/seo-generation -w @andy-toolforge/ba-support -w @andy-toolforge/book-writing -w @andy-toolforge/coding-support -w @andy-toolforge/pm-support -w @andy-toolforge/tts-generator -w @andy-toolforge/voice-assistant
```
Expected: All package tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/*/skills/postinstall.js
git commit -m "refactor: replace 10 duplicated postinstall.js with core call"
```

---

### Task 4: Move MCP postinstall to skills/ + update package.json

**Files:**
- Create: `packages/mcp/skills/postinstall.js`
- Delete: `packages/mcp/scripts/postinstall.js`
- Modify: `packages/mcp/package.json`

- [ ] **Step 1: Create MCP's new postinstall**

```js
// packages/mcp/skills/postinstall.js
const { installSkills } = require('@andy-toolforge/core');

installSkills({
  domain: 'toolforge',
  sourceDir: __dirname,
});
```

- [ ] **Step 2: Delete the old postinstall**

```bash
rm packages/mcp/scripts/postinstall.js
```

- [ ] **Step 3: Update package.json**

Change:
```json
"files": ["lib/", "bin/", "skills/", "scripts/"],
"scripts": {
  "postinstall": "node scripts/postinstall.js",
```

To:
```json
"files": ["lib/", "bin/", "skills/"],
"scripts": {
  "postinstall": "node skills/postinstall.js",
```

- [ ] **Step 4: Run MCP tests**

```bash
npm test -w @andy-toolforge/mcp
```
Expected: 23/23 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/skills/postinstall.js packages/mcp/package.json
git rm packages/mcp/scripts/postinstall.js
git commit -m "refactor(mcp): move postinstall to skills/, align with domain packages"
```

---

### Task 5: Verify integration end-to-end

- [ ] **Step 1: Run the full workspace test suite**

```bash
npm test --workspaces
```
Expected: All tests across all packages pass.

- [ ] **Step 2: Simulate a fresh install in temp directory**

```bash
cd /tmp
mkdir toolforge-verify
cd toolforge-verify
npm init -y
npm install /Users/admin/personal/toolforge/packages/core /Users/admin/personal/toolforge/packages/footage-generation
# Check symlinks in .opencode/skills/
ls -la .opencode/skills/
```
Expected: Symlinks like `footage-generation-analysis.md → ...` exist.

- [ ] **Step 3: Clean up temp**

```bash
rm -rf /tmp/toolforge-verify
```
