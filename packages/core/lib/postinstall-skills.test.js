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
