'use strict';

// Pinpoint (pinpointhq.com) public postings feed, no-auth (verified live 2026-09-06):
//   GET https://{slug}.pinpointhq.com/postings.json
//     → { data: [{ id, title, description (HTML), url, path,
//                  location (string), employment_type, workplace_type,
//                  compensation_*, ... }] }  (bare array tolerated)
// {slug} is the Pinpoint career-site subdomain, e.g. `workwithus`.

const USER_AGENT = 'jobscan/0.3.0';

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
  let url = raw.url || '';
  if (!url && raw.path && raw._host) {
    url = raw.path.startsWith('http') ? raw.path : `https://${raw._host}.pinpointhq.com${raw.path.startsWith('/') ? '' : '/'}${raw.path}`;
  }
  return {
    id: String(raw.id || raw.slug || ''),
    title: raw.title || raw.name || '',
    url,
    description: raw.description || raw.descriptionHtml || '',
    location: formatLocation(raw.location),
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  await rateLimitWait();
  const url = `https://${encodeURIComponent(companySlug)}.pinpointhq.com/postings.json`;
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
    if (res.status === 404) throw new Error(`Pinpoint site not found: ${companySlug}`);
    throw new Error(`Pinpoint fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data) ? data
    : Array.isArray(data.data) ? data.data
    : Array.isArray(data.postings) ? data.postings : [];
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(raw => parseJob({ ...raw, _host: companySlug }));
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
