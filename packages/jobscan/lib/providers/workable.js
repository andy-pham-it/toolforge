'use strict';

// Workable public widget API (verified live 2026-09-05):
//   GET https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true
//     → { jobs: [{ title, url, description (HTML inline), location|locations,
//          department, employment_type, published_on, ... }] }
// `details=true` is required — without it jobs carry no description.

const USER_AGENT = 'jobscan/0.3.4';
const BASE = 'https://apply.workable.com/api/v1/widget/accounts';

let lastRequestAt = 0;

async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

function formatLocation(raw) {
  const loc = raw.location || raw.locations;
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  if (Array.isArray(loc)) {
    return loc.map(formatLocation).filter(Boolean).join(' / ');
  }
  return loc.location_str || loc.full || loc.fullLocation ||
    [loc.city, loc.region || loc.state, loc.country].filter(Boolean).join(', ');
}

function parseJob(raw) {
  return {
    id: String(raw.shortcode || raw.code || raw.id || ''),
    title: raw.title || raw.name || '',
    url: raw.url || raw.careers_url || raw.applyUrl || '',
    description: raw.description || raw.descriptionHtml || '',
    location: formatLocation(raw),
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  await rateLimitWait();
  const url = `${BASE}/${encodeURIComponent(companySlug)}?details=true`;
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
    if (res.status === 404) throw new Error(`Workable account not found: ${companySlug}`);
    throw new Error(`Workable fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs
    : Array.isArray(data) ? data : [];
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(parseJob);
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
