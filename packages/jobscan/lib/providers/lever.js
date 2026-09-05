'use strict';

const USER_AGENT = 'jobscan/0.3.1';
const BASE = 'https://api.lever.co/v0/postings';

let lastRequestAt = 0;
async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

function parseJob(raw) {
  return {
    id: String(raw.id || ''),
    title: raw.text || raw.title || '',
    url: raw.hostedUrl || raw.url || raw.applyUrl || '',
    description: raw.description || raw.descriptionPlain || '',
    location: (raw.categories && raw.categories.location) || raw.location || '',
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available');
  await rateLimitWait();
  const url = `${BASE}/${encodeURIComponent(companySlug)}?mode=json`;
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastRequestAt = Date.now();
    res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10) * 1000;
      await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) ? retryAfter : 2000 * (attempt + 1)));
      continue;
    }
    break;
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Lever board not found: ${companySlug}`);
    throw new Error(`Lever fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(parseJob);
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
