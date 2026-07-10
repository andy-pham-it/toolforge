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
 * @param {string} opts.domain    - Prefix for skill file names (e.g. 'footage-generation')
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
