'use strict';
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.resolve(__dirname, 'skills');
const TARGET_DIR = path.resolve(__dirname, '..', '..', '.opencode', 'skills');

try {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    for (const file of fs.readdirSync(SKILLS_DIR)) {
        if (!file.endsWith('.md')) continue;
        const src = path.join(SKILLS_DIR, file);
        const dest = path.join(TARGET_DIR, 'hermes-' + file);
        try {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            fs.symlinkSync(src, dest);
        } catch {}
    }
} catch {}
process.exit(0);