const fs = require('fs');
const path = require('path');
const { LLMClient: CoreLLMClient } = require('@andy-toolforge/core');

function resolveSkillFile(skillName) {
    const paths = [
        path.join(process.cwd(), '.opencode', 'skills', `content-research-${skillName}`),
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
    async summarizeContent(content, title, lang = 'vi') {
        const skillPath = resolveSkillFile('summarizer.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');
        const userPrompt = `Title: ${title}\nLanguage: ${lang}\nContent to summarize:\n${content}`;
        return this.chatJSON(systemPrompt, userPrompt);
    }

    async generateContentIdeas(topic, audience, format, numIdeas = 3, lang = 'vi') {
        const skillPath = resolveSkillFile('ideator.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');
        const userPrompt = `Topic: ${topic}\nTarget Audience: ${audience}\nFormat: ${format}\nNumber of Ideas: ${numIdeas}\nLanguage: ${lang}`;
        return this.chatJSON(systemPrompt, userPrompt);
    }

    async manageArticle(articleContent, articleTitle, action, lang = 'vi') {
        const skillPath = resolveSkillFile('manager.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');
        const userPrompt = `Article Title: ${articleTitle}\nAction: ${action}\nLanguage: ${lang}\nArticle Content:\n${articleContent}`;
        return this.chatJSON(systemPrompt, userPrompt);
    }

    async analyzeCompetitor(competitorUrl, analysisScope, lang = 'vi') {
        const skillPath = resolveSkillFile('analyzer.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');
        const userPrompt = `Competitor URL: ${competitorUrl}\nAnalysis Scope: ${analysisScope}\nLanguage: ${lang}`;
        return this.chatJSON(systemPrompt, userPrompt);
    }
}

module.exports = { LLMClient, resolveSkillFile };
