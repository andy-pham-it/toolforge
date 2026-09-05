'use strict';

const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','should','could','may','might','must','can','this','that','these','those',
  'it','its','as','from','up','out','about','into','over','after','before','under','again','further','then','once','here','there',
  'when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own',
  'same','so','than','too','very','just','because','while','through','during','above','below','your','you','we','our','us','i',
  'am','me','my','experience','years','year','work','working','join','team','role','looking','seeking','ability','including',
  'need','needs','needed','require','requires','required','requirements'
]);

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text.toLowerCase().split(/[^a-z0-9+#.]+/).map(t => t.trim()).filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

function buildResumeTokens(resume) {
  const parts = [];
  if (Array.isArray(resume.skills)) parts.push(resume.skills.join(' '));
  if (resume.summary) parts.push(resume.summary);
  if (Array.isArray(resume.experience)) {
    for (const e of resume.experience) {
      if (e.role) parts.push(e.role);
      if (e.title) parts.push(e.title);
      if (Array.isArray(e.bullets)) parts.push(e.bullets.join(' '));
    }
  }
  if (resume.custom && typeof resume.custom === 'object') {
    parts.push(Object.values(resume.custom).join(' '));
  }
  const raw = parts.join(' ').toLowerCase();
  // keep skills exact for matching: also add normalized skills set
  const tokens = new Set(tokenize(raw));
  // also add skills as exact phrases lowercased
  if (Array.isArray(resume.skills)) {
    for (const s of resume.skills) {
      const norm = String(s).toLowerCase().trim();
      if (norm) tokens.add(norm);
      // also tokenized words of skill already added, but keep phrase
    }
  }
  return tokens;
}

function extractJDKeywords(jobDescription) {
  if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
    throw new Error('jobDescription is required (non-empty string)');
  }
  const tokens = tokenize(jobDescription);
  // unique
  return [...new Set(tokens)];
}

/**
 * Heuristic match for free tier - TF keyword overlap, no LLM.
 * @param {object} resume - normalized resume object
 * @param {string} jobDescription - JD text
 * @returns {{score:number, matchedKeywords:string[], missingKeywords:string[], suggestions:string[]}}
 */
function heuristicMatch(resume, jobDescription) {
  if (!resume || typeof resume !== 'object') throw new Error('resume is required');
  if (!Array.isArray(resume.skills) || resume.skills.length === 0) throw new Error('resume.skills is required for matching');
  const jdKeywords = extractJDKeywords(jobDescription);
  if (jdKeywords.length === 0) throw new Error('jobDescription contains no indexable keywords');

  const resumeTokens = buildResumeTokens(resume);

  const matched = [];
  const missing = [];
  for (const kw of jdKeywords) {
    // phrase check: if kw contains space (from skills phrase) not here, JD is tokenized words only, so simple token match
    // also handle resumeTokens containing multi-word skill: check if JD keyword is substring of any resume skill phrase
    let found = resumeTokens.has(kw);
    if (!found) {
      // check if any resume skill phrase contains kw as word
      for (const rt of resumeTokens) {
        if (rt.includes(kw) || kw.includes(rt)) { found = rt.length >= 3 && kw.length >= 3 ? true : found; break; }
      }
    }
    if (found) matched.push(kw); else missing.push(kw);
  }

  // also consider resume skills not in JD as not counted for score, but matched covers overlap.

  const score = jdKeywords.length === 0 ? 0 : Math.round((matched.length / jdKeywords.length) * 100);

  const suggestions = missing.slice(0, 10).map(kw => `Consider adding experience with '${kw}' to align with job requirements.`);

  return { score, matchedKeywords: matched, missingKeywords: missing, suggestions };
}

module.exports = { heuristicMatch, tokenize, STOPWORDS };
