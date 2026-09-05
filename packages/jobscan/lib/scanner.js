'use strict';

const { heuristicMatch } = require('./matcher');
const { serialize, tierCheck } = require('./tier');
const { getProvider } = require('./providers');

/**
 * Scan a single job description against a resume, with tier gating.
 * @param {object} opts - { resume, jobDescription, license, provider, url, jobTitle, jobId, proData? }
 * @returns {object} serialized result
 */
function scan({ resume, jobDescription, license = null, provider = null, url = null, jobTitle = null, jobId = null, proData = null }) {
  if (!resume) throw new Error('resume is required');
  if (!jobDescription) throw new Error('jobDescription is required');
  const match = heuristicMatch(resume, jobDescription);
  const tier = tierCheck(license);
  const base = {
    score: match.score,
    matchedKeywords: match.matchedKeywords,
    missingKeywords: match.missingKeywords,
    suggestions: match.suggestions,
    provider,
    url,
    fetchedAt: new Date().toISOString(),
    jobTitle,
    jobId,
  };
  if (proData && tier === 'pro') {
    base.llmSuggestions = proData.llmSuggestions || [];
    base.tailoredBullets = proData.tailoredBullets || [];
    base.coverLetterHint = proData.coverLetterHint || '';
  }
  return serialize(base, tier);
}

/**
 * Orchestrate provider fetch → matcher for multiple jobs.
 * Sequential with rate-limit enforced by provider module.
 * @param {object} opts - { provider: 'greenhouse'|'lever'|'ashby', companySlug, resume, license, limit, fetchFn, proDataMap? }
 * @returns {Promise<object[]>} array of serialized scan results
 */
async function scanWithProvider({ provider, companySlug, company, resume, license = null, limit = 5, fetchFn = global.fetch, proDataMap = null }) {
  if (!resume) throw new Error('resume is required');
  const slug = companySlug || company;
  if (!slug) throw new Error('companySlug is required');
  if (!provider) throw new Error('provider is required');
  const mod = getProvider(provider);
  const jobs = await mod.fetchJobs({ companySlug: slug, limit, fetchFn });
  const results = [];
  for (const job of jobs) {
    const jd = job.description || job.title || '';
    const proData = proDataMap ? proDataMap[job.id] : null;
    const r = scan({ resume, jobDescription: jd, license, provider, url: job.url, jobTitle: job.title, jobId: job.id, proData });
    results.push(r);
  }
  return results;
}

module.exports = { scan, scanWithProvider, serialize, tierCheck };
