'use strict';

// RemoteOK public API, no-auth (verified live 2026-09-06):
//   GET https://remoteok.com/api  → array; element [0] is a legal/attribution
//   notice (no `position` field) and MUST be skipped. Remaining elements:
//     [{ id/slug, company, position (title!), description (HTML full),
//        url, location, tags[], ... }]
// Board-wide feed: NO company slug, NO server-side filter (tags filter is
// ignored server-side). `companySlug` here is therefore an OPTIONAL
// client-side company-name substring filter (case-insensitive, e.g.
// 'GitLab'); pass 'all' (or any non-matching value handled by caller) to
// skip filtering and take the newest jobs.
// LEGAL: RemoteOK data requires a dofollow backlink attribution when
// displayed publicly. CLI/matching use is fine, but any public rendering of
// these descriptions (dashboard export, website) must credit RemoteOK with a
// link — see README "Data attribution".

const USER_AGENT = 'jobscan/0.3.0';

let lastRequestAt = 0;

async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

function parseJob(raw) {
  return {
    id: String(raw.id || raw.slug || ''),
    title: raw.position || raw.title || '',
    url: raw.url || raw.applyUrl || '',
    description: raw.description || raw.descriptionHtml || '',
    location: Array.isArray(raw.location) ? raw.location.join(', ')
      : (typeof raw.location === 'object' && raw.location !== null
        ? [raw.location.city, raw.location.country].filter(Boolean).join(', ')
        : (raw.location || '')),
  };
}

async function fetchJobs({ companySlug = 'all', limit = 10, fetchFn = global.fetch } = {}) {
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  await rateLimitWait();
  const url = 'https://remoteok.com/api';
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
    throw new Error(`RemoteOK fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  // skip legal/attribution header + any non-job elements
  let jobs = arr.filter(item => item && typeof item.position === 'string' && item.position);
  const slug = String(companySlug || 'all').toLowerCase();
  if (slug && slug !== 'all') {
    jobs = jobs.filter(item => String(item.company || '').toLowerCase().includes(slug));
  }
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(parseJob);
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
