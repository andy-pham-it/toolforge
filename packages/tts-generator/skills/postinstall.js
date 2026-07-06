const fs = require('fs');
const path = require('path');

const DOMAIN = 'tts-generator';
const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, '.opencode', 'skills');
const sourceDir = path.join(__dirname);

fs.mkdirSync(targetDir, { recursive: true });

fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.md') && file !== 'postinstall.js') {
        const src = path.join(sourceDir, file);
        const destName = `${DOMAIN}-${file.replace(/\s+/g, '_')}`;
        const dest = path.join(targetDir, destName);
        if (!fs.existsSync(dest)) {
            try {
                fs.symlinkSync(path.relative(targetDir, src), dest);
                console.log(`  🔗 Linked ${destName}`);
            } catch (e) {
                fs.copyFileSync(src, dest);
                console.log(`  📄 Copied ${destName}`);
            }
        }
    }
});
