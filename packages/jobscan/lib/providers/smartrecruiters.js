'use strict';

// SmartRecruiters public API (verified live 2026-09-05):
//   List:   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings?limit=&offset=
//           → { content: [{ id, name, ref, location, department, ... }], totalFound }
//           List items carry NO description.
//   Detail: GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings/{postingId}
//           → { jobAd: { sections: { companyDescription, jobDescription, qualifications,
//                 additionalInformation } (HTML), postingUrl }, location, ... }
// Company IDs are case-sensitive (e.g. BoschGroup, Equinox).

const USER_AGENT = 'jobscan/0.3.1';
const BASE = 'https://api.smartrecruiters.com/v1/companies';

let lastRequestAt = 0;

async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

async function getJson(fetchFn, url) {
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
  return res;
}

function formatLocation(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  if (loc.fullLocation) return loc.fullLocation + (loc.remote ? ' (Remote)' : '');
  const parts = [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
  return loc.remote ? (parts ? parts + ' (Remote)' : 'Remote') : parts;
}

function parseJob(raw) {
  const sections = (raw.jobAd && raw.jobAd.sections) || {};
  const descParts = [];
  if (sections.jobDescription) descParts.push(sections.jobDescription);
  if (sections.qualifications) descParts.push(sections.qualifications);
  if (sections.additionalInformation) descParts.push(sections.additionalInformation);
  if (sections.companyDescription) descParts.push(sections.companyDescription);
  return {
    id: String(raw.id || raw.ref || ''),
    title: raw.name || raw.title || '',
    url: (raw.jobAd && raw.jobAd.postingUrl) || raw.postingUrl || raw.applyUrl || raw.url || '',
    description: descParts.join('\n\n') || raw.description || '',
    location: formatLocation(raw.location),
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  const company = encodeURIComponent(companySlug);
  const want = limit || Number.MAX_SAFE_INTEGER;
  const pageSize = Math.min(want, 100);
  const jobs = [];
  let offset = 0;
  let total = Infinity;
  while (jobs.length < want && offset < total) {
    await rateLimitWait();
    const url = `${BASE}/${company}/postings?limit=${pageSize}&offset=${offset}`;
    const res = await getJson(fetchFn, url);
    if (!res.ok) {
      if (res.status === 404) throw new Error(`SmartRecruiters company not found: ${companySlug}`);
      throw new Error(`SmartRecruiters fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const items = Array.isArray(data.content) ? data.content
      : Array.isArray(data) ? data : [];
    total = Number.isFinite(data.totalFound) ? data.totalFound : items.length;
    if (!items.length) break;
    for (const item of items) {
      if (jobs.length >= want) break;
      // List items carry no description — fetch detail (best-effort).
      let merged = { ...item };
      try {
        await rateLimitWait();
        const dres = await getJson(fetchFn, `${BASE}/${company}/postings/${encodeURIComponent(item.id)}`);
        if (dres.ok) merged = { ...item, ...(await dres.json()) };
      } catch (_) { /* keep list-level fields */ }
      jobs.push(parseJob(merged));
    }
    offset += items.length;
  }
  return jobs;
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
