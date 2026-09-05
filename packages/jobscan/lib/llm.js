'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { LLMClient: CoreLLMClient } = require('@andy-toolforge/core');

function resolveSkillFile(skillName) {
  const paths = [
    path.join(process.cwd(), '.opencode', 'skills', skillName),
    path.join(__dirname, '..', 'skills', skillName),
  ];
  for (const p of paths) if (fs.existsSync(p)) return p;
  throw new Error(
    `Skill file not found: ${skillName}\n  Tried:\n` + paths.map(p => `    - ${p}`).join('\n') + '\n  Run: node skills/postinstall.js'
  );
}

class LLMClient extends CoreLLMClient {
  /**
   * Tailor resume bullets + cover hint for a job description (Pro tier).
   * @param {object} resume - canonical resume object
   * @param {string} jobDesc - job description text
   * @param {function} [fetchFn] - optional mock fetch for testing
   * @returns {Promise<{tailoredBullets:string[], coverLetterHint:string, llmSuggestions:string[]}>}
   */
  async tailorResume(resume, jobDesc, fetchFn) {
    if (!resume || typeof resume !== 'object') throw new Error('resume is required');
    if (!jobDesc || typeof jobDesc !== 'string' || !jobDesc.trim()) throw new Error('jobDesc is required');
    const skillPath = resolveSkillFile('jobscan-resume-matcher.md');
    const skillContent = fs.readFileSync(skillPath, 'utf8');
    const systemPrompt = skillContent + '\n\nIMPORTANT: Return JSON only with shape {\"tailoredBullets\": string[], \"coverLetterHint\": string, \"llmSuggestions\": string[]}. No markdown, no extra keys.';
    const userPrompt = `Resume JSON:\n${JSON.stringify(resume, null, 2)}\n\nJob Description:\n${jobDesc}`;
    const res = await this.chatJSON(systemPrompt, userPrompt, fetchFn);
    if (!res || typeof res !== 'object') throw new Error('LLM did not return JSON object');
    const tailoredBullets = Array.isArray(res.tailoredBullets) ? res.tailoredBullets : [];
    const coverLetterHint = typeof res.coverLetterHint === 'string' ? res.coverLetterHint : (typeof res.coverHint === 'string' ? res.coverHint : '');
    const llmSuggestions = Array.isArray(res.llmSuggestions) ? res.llmSuggestions : (Array.isArray(res.suggestions) ? res.suggestions : []);
    if (!tailoredBullets.length && !coverLetterHint && !llmSuggestions.length) throw new Error('LLM returned empty pro fields');
    return { tailoredBullets, coverLetterHint, llmSuggestions };
  }
}

module.exports = LLMClient;
module.exports.resolveSkillFile = resolveSkillFile;
