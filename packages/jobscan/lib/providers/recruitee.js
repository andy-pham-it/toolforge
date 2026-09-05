'use strict';

// Recruitee Careers Site API, no-auth per official docs (verified live 2026-09-05):
//   GET https://{company}.recruitee.com/api/offers/
//     → bare array (or { offers } / { data } wrapper tolerated):
//        [{ id, title, description (HTML inline), careers_url,
//           location (string), department, employment_type, ... }]
// {company} is the Recruitee subdomain (careers-site slug).

const USER_AGENT = 'jobscan/0.3.4';

let lastRequestAt = 0;

async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

function formatLocation(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  return loc.location_str || loc.full || loc.fullLocation ||
    [loc.city, loc.region || loc.state, loc.country].filter(Boolean).join(', ');
}

function parseJob(raw) {
  return {
    id: String(raw.id || raw.slug || ''),
    title: raw.title || raw.name || '',
    url: raw.careers_url || raw.url || raw.applyUrl || '',
    description: raw.description || raw.descriptionHtml || '',
    location: formatLocation(raw.location),
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  await rateLimitWait();
  const url = `https://${encodeURIComponent(companySlug)}.recruitee.com/api/offers/`;
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
    if (res.status === 404) throw new Error(`Recruitee company not found: ${companySlug}`);
    throw new Error(`Recruitee fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data) ? data
    : Array.isArray(data.offers) ? data.offers
    : Array.isArray(data.data) ? data.data : [];
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(parseJob);
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
