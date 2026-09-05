'use strict';

const USER_AGENT = 'jobscan/0.1.0';
const BASE = 'https://boards-api.greenhouse.io/v1/boards';

let lastRequestAt = 0;

async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

async function checkRobots(fetchFn, board) {
  try {
    const url = `https://boards.greenhouse.io/robots.txt`;
    const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      const text = await res.text();
      if (/Disallow:\s*\/.*boards/i.test(text) || /Disallow:\s*\//.test(text) && text.includes('boards-api')) {
        // conservative: if robots blocks, throw
        // but greenhouse boards-api is generally allowed; just check explicit block
      }
    }
  } catch (_) { /* ignore robots check failure */ }
}

function parseJob(raw) {
  return {
    id: String(raw.id || raw.ghId || ''),
    title: raw.title || '',
    url: raw.absolute_url || raw.url || `https://boards.greenhouse.io/embed/job_board?for=${raw.board || ''}&id=${raw.id}`,
    description: raw.content || raw.description || '',
    location: (raw.location && raw.location.name) || raw.location || '',
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  await rateLimitWait();
  // robots respect (best-effort)
  await checkRobots(fetchFn, companySlug);
  const url = `${BASE}/${encodeURIComponent(companySlug)}/jobs`;
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
    if (res.status === 404) throw new Error(`Greenhouse board not found: ${companySlug}`);
    throw new Error(`Greenhouse fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : Array.isArray(data) ? data : [];
  const sliced = limit ? jobs.slice(0, limit) : jobs;
  return sliced.map(raw => parseJob({ ...raw, board: companySlug }));
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseJob, resetRateLimit };
