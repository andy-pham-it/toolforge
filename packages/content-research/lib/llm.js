const fs = require('fs');
const path = require('path');
const { LLMClient: CoreLLMClient } = require('@andy-toolforge/core');

function resolveSkillFile(skillName) {
    const paths = [
        path.join(process.cwd(), '.opencode', 'skills', skillName),
        path.join(__dirname, '..', 'skills', skillName),
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(
        `Skill file not found: ${skillName}\n` +
        `  Tried:\n` +
        paths.map(p => `    - ${p}`).join('\n') + '\n' +
        `  Run: node node_modules/@andy-toolforge/content-research/skills/postinstall.js`
    );
}

class LLMClient extends CoreLLMClient {
    // Các phương thức domain-specific sẽ được thêm vào đây
}

module.exports = { LLMClient, resolveSkillFile };
