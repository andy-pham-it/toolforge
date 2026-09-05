'use strict';

const USER_AGENT = 'jobscan/0.2.0';

let lastRequestAt = 0;
async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

function parseJob(raw) {
  return {
    id: String(raw.id || ''),
    title: raw.title || '',
    url: raw.jobUrl || raw.url || raw.hostedUrl || '',
    description: raw.descriptionHtml || raw.description || '',
    location: raw.location || (raw.locations && raw.locations[0]) || '',
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available');
  await rateLimitWait();
  // Ashby posting API: https://api.ashbyhq.com/posting-api/job-board/{slug}
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(companySlug)}`;
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
    if (res.status === 404) throw new Error(`Ashby board not found: ${companySlug}`);
    throw new Error(`Ashby fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  // Ashby returns { jobs: [...] } or array
  const jobs = Array.isArray(data.jobs) ? data.jobs : Array.isArray(data) ? data : [];
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(parseJob);
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
