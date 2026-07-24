'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * @typedef {Object} SkillRecord
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} triggers
 * @property {string[]} keywords
 * @property {string} crossRef
 * @property {string} path
 */

/**
 * Build a searchable index of all skills in the skills directory.
 * @param {string} skillsDir - Absolute path to skills directory
 * @returns {SkillRecord[]}
 */
function buildIndex(skillsDir) {
  const index = [];
  if (!fs.existsSync(skillsDir)) return index;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf-8');
    const record = parseSkillFile(entry.name, content, skillPath);
    if (record) index.push(record);
  }
  return index;
}

/**
 * Parse a single SKILL.md file into a SkillRecord.
 * @param {string} dirName
 * @param {string} content
 * @param {string} skillPath
 * @returns {SkillRecord|null}
 */
function parseSkillFile(dirName, content, skillPath) {
  // Extract YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let id = dirName;
  if (fmMatch) {
    try {
      const fm = yaml.load(fmMatch[1]);
      if (fm && fm.id) id = fm.id;
    } catch {
      // ignore invalid frontmatter
    }
  }

  // Extract heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const name = headingMatch ? headingMatch[1].trim() : dirName;

  // Extract description (## Mô tả)
  const descMatch = content.match(/^## Mô tả\n([\s\S]*?)(?=\n## )/m);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extract triggers (## Kích hoạt)
  const triggerMatch = content.match(/^## Kích hoạt\n([\s\S]*?)(?=\n## )/m);
  const triggers = triggerMatch ? triggerMatch[1].trim() : '';

  // Extract keywords (## Keywords)
  const kwMatch = content.match(/^## Keywords\n([\s\S]*?)(?=\n## )/m);
  const keywords = kwMatch
    ? kwMatch[1].split(/[,\n]/).map(k => k.trim().toLowerCase()).filter(Boolean)
    : [];

  // Extract cross-ref (## Cross-ref)
  const xrefMatch = content.match(/^## Cross-ref\n([\s\S]*?)(?=\n## |$)/m);
  const crossRef = xrefMatch ? xrefMatch[1].trim() : '';

  return { id, name, triggers, description, keywords, crossRef, path: skillPath };
}

/**
 * Search the skill index for a query string.
 * Scoring: exact id match (+5), id substring (+3), keyword overlap (+3),
 * trigger match (+2), name match (+2), description match (+1), crossRef match (+1).
 * @param {SkillRecord[]} index
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit=10]
 * @returns {{ skill: SkillRecord, score: number }[]}
 */
function searchSkills(index, query, options) {
  const limit = (options && options.limit) || 10;
  const q = query.toLowerCase().trim();
  const qTerms = q.split(/\s+/).filter(Boolean);

  if (qTerms.length === 0) return [];

  const scored = [];
  for (const skill of index) {
    let score = 0;
    for (const term of qTerms) {
      // id match
      if (skill.id.toLowerCase() === term) score += 5;
      else if (skill.id.toLowerCase().includes(term)) score += 3;

      // keyword match
      if (skill.keywords.some(k => k.includes(term) || term.includes(k))) score += 3;

      // trigger match
      if (skill.triggers && skill.triggers.toLowerCase().includes(term)) score += 2;

      // name match
      if (skill.name && skill.name.toLowerCase().includes(term)) score += 2;

      // description match
      if (skill.description && skill.description.toLowerCase().includes(term)) score += 1;

      // crossRef match
      if (skill.crossRef && skill.crossRef.toLowerCase().includes(term)) score += 1;
    }
    if (score > 0) scored.push({ skill, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { buildIndex, searchSkills };
