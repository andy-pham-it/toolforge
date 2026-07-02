const fs = require('fs');
const path = require('path');

const skillFiles = [
    'content-research-summarizer.md',
    'content-research-ideator.md',
    'content-research-manager.md',
    'content-research-analyzer.md',
];

const targetDir = path.join(process.cwd(), '.opencode', 'skills');
const sourceDir = __dirname;

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

for (const file of skillFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath); // Xóa symlink cũ nếu tồn tại
    }
    fs.symlinkSync(path.relative(targetDir, sourcePath), targetPath, 'file');
    console.log(`Symlinked ${file} to ${targetPath}`);
}
