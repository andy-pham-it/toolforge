'use strict';

// Symlink skill files into the repo-level .opencode/skills/ dir with the
// messaging- prefix so client projects receive them (AGENTS.md section 3.4).
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.resolve(__dirname, 'skills');
const TARGET_DIR = path.resolve(__dirname, '..', '..', '.opencode', 'skills');

try {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  for (const file of fs.readdirSync(SKILLS_DIR)) {
    if (!file.endsWith('.md')) continue;
    const src = path.join(SKILLS_DIR, file);
    const dest = path.join(TARGET_DIR, `messaging-${file}`);
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.symlinkSync(src, dest);
    } catch {
      // best effort — never fail the install
    }
  }
} catch {
  // never fail the install
}
process.exit(0);
