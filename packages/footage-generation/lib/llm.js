const fs = require('fs');
const path = require('path');
const { LLMClient: CoreLLMClient } = require('@andy-toolforge/core');

/**
 * Resolve skill file path with fallback:
 * 1. .opencode/skills/<name>.md (installed by postinstall)
 * 2. node_modules/@andy-toolforge/footage-generation/skills/<name>.md (fallback for npm link)
 */
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
        `  Run: node node_modules/@andy-toolforge/footage-generation/skills/postinstall.js`
    );
}

class LLMClient extends CoreLLMClient {
    async analyzeScript(script, title, outline, density, lang) {
        const skillPath = resolveSkillFile('footage-generation-workflow-podcast-processor.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8') +
            `\n\nIMPORTANT: You must return the result as a JSON object with the following structure:\n` +
            `{\n  "segments": [\n    {\n      "id": number, \n      "title": "string", \n      "summary": "string", \n      "visualType": "Surrealist|Lineart|Comparison|Typography|Infographic", \n      "startTime": "mm:ss", \n      "endTime": "mm:ss", \n      "prompts": { "a": "string", "b": "string", "c": "string", "d": "string", "e": "string" }, \n      "editSuggestions": { "zoom": "string", "context": "string", "mood": "string" }\n    }\n  ]\n}`;

        const userPrompt = `Title: ${title}\nLanguage: ${lang}\nImage Density: ${density} images per segment\nOutline: ${outline || 'None'}\n\nScript:\n${script}`;

        const result = await this.chat(systemPrompt, userPrompt, true);
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.segments && Array.isArray(parsed.segments)) return parsed.segments;
        throw new Error('LLM did not return a valid segments array');
    }

    async generateCoverPrompts(title, outline, lang) {
        const skillPath = resolveSkillFile('footage-generation-podcast-cover-generator.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8') +
            `\n\nIMPORTANT: You must return the result as a JSON object with the following structure:\n` +
            `{\n  "seriesCover": { "prompt": "string", "style": "string" },\n  "chapterCovers": [ { "chapter": number, "title": "string", "prompt": "string", "style": "string" } ]\n}`;

        const userPrompt = `Title: ${title}\nLanguage: ${lang}\nOutline: ${outline || 'None'}`;

        const result = await this.chat(systemPrompt, userPrompt, true);
        return JSON.parse(result);
    }
}

module.exports = LLMClient;
