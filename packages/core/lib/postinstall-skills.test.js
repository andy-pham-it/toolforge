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

  it('should recurse into subdirectories and flatten names with domain prefix', () => {
    fs.mkdirSync(path.join(skillsDir, 'sdlc-prd'), { recursive: true });
    fs.mkdirSync(path.join(skillsDir, 'project-init'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'sdlc-prd', 'SKILL.md'), '# PRD Skill');
    fs.writeFileSync(path.join(skillsDir, 'project-init', 'SKILL.md'), '# Init Skill');

    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      installSkills({ domain: 'sdlc-workflows', sourceDir: skillsDir });

      assert.ok(fs.existsSync(path.join(targetDir, 'sdlc-workflows-sdlc-prd-SKILL.md')), 'Nested sdlc-prd skill should be linked');
      assert.ok(fs.existsSync(path.join(targetDir, 'sdlc-workflows-project-init-SKILL.md')), 'Nested project-init skill should be linked');
      assert.equal(fs.readFileSync(path.join(targetDir, 'sdlc-workflows-sdlc-prd-SKILL.md'), 'utf-8'), '# PRD Skill');
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('should detect client project root via package.json instead of raw cwd', () => {
    fs.mkdirSync(path.join(skillsDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'sub', 'skill.md'), '# Nested');

    // Simulate a client project: cwd is a nested dir inside a real project root
    const clientRoot = path.join(tmpDir, 'client-project');
    const nestedCwd = path.join(clientRoot, 'scripts');
    fs.mkdirSync(nestedCwd, { recursive: true });
    fs.writeFileSync(path.join(clientRoot, 'package.json'), JSON.stringify({ name: 'client-app' }));

    const originalCwd = process.cwd;
    process.cwd = () => nestedCwd;

    try {
      installSkills({ domain: 'client', sourceDir: skillsDir });

      // Skills must land in clientRoot/.opencode/skills, not nestedCwd/.opencode/skills
      assert.ok(fs.existsSync(path.join(clientRoot, '.opencode', 'skills', 'client-sub-skill.md')), 'Should install into client project root');
      assert.ok(!fs.existsSync(path.join(nestedCwd, '.opencode', 'skills')), 'Should NOT install into nested cwd');
    } finally {
      process.cwd = originalCwd;
    }
  });
});
