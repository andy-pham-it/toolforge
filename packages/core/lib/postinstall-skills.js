const fs = require('fs');
const path = require('path');

/**
 * Install skill .md files from a package's skills/ directory
 * into .opencode/skills/ with a domain prefix.
 *
 * Designed to be called from a package's postinstall script.
 * Falls back to copy if symlink fails (e.g., on some CI or non-POSIX systems).
 *
 * Skill files are discovered recursively — nested files are flattened into
 * `<domain>-<subdir>-<file>` names so all skills land flat in .opencode/skills/.
 *
 * @param {object} opts
 * @param {string} opts.domain    - Prefix for skill file names (e.g. 'footage-generation')
 * @param {string} opts.sourceDir - Absolute path to the directory containing .md skill files
 */

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Find the client project root by walking up from startDir until a package.json
 * whose name differs from the package being installed (sourceDir's parent) is found.
 * Falls back to startDir when none is found (e.g. plain directories without package.json).
 */
function findProjectRoot(startDir, sourceDir) {
  const selfName = readJson(path.join(sourceDir, '..', 'package.json'))?.name;
  let dir = path.resolve(startDir);
  for (;;) {
    const pkg = readJson(path.join(dir, 'package.json'));
    if (pkg && pkg.name && pkg.name !== selfName) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

function listSkillFiles(sourceDir) {
  const results = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'postinstall.js') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, path.join(rel, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push({ abs, rel: path.join(rel, entry.name) });
      }
    }
  };
  walk(sourceDir, '');
  return results;
}

function installSkills({ domain, sourceDir }) {
  const projectRoot = findProjectRoot(process.cwd(), sourceDir);
  const targetDir = path.join(projectRoot, '.opencode', 'skills');

  fs.mkdirSync(targetDir, { recursive: true });

  let count = 0;
  for (const { abs, rel } of listSkillFiles(sourceDir)) {
    const flatName = rel.replace(/[\\/]+/g, '-').replace(/\s+/g, '_');
    const destName = `${domain}-${flatName}`;
    const dest = path.join(targetDir, destName);
    if (!fs.existsSync(dest)) {
      try {
        fs.symlinkSync(path.relative(targetDir, abs), dest);
        console.log(`  🔗 Linked ${destName}`);
        count++;
      } catch (e) {
        // Fallback: copy if symlink fails
        fs.copyFileSync(abs, dest);
        console.log(`  📄 Copied ${destName}`);
        count++;
      }
    }
  }

  if (count === 0) {
    console.log(`  ℹ️  No new skill files to install for "${domain}"`);
  }
}

module.exports = { installSkills, findProjectRoot };
