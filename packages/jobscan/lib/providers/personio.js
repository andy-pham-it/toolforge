'use strict';

// Personio official public XML feed, no-auth (verified live 2026-09-06):
//   GET https://{company}.jobs.personio.de/xml?language=en
//     → <workzag-jobs><position>
//          <id>, <office>, <department>, <subcompany>, <employmentType>,
//          <seniority>, <schedule>, <name><![CDATA[title]]></name>,
//          <jobDescriptions><jobDescription>
//            <name><![CDATA[section]]></name><value><![CDATA[HTML]]></value>
//          ... (NO full text in single call — descriptions included inline)
// Detail/apply URL pattern (verified live, 307 + <title> match):
//   https://{company}.jobs.personio.de/job/{id}?display=en
// Parsed with regex on purpose: zero new dependencies (XML shape is stable
// and Personio-owned). If Personio changes the schema, tests catch it.

const USER_AGENT = 'jobscan/0.3.3';

let lastRequestAt = 0;

async function rateLimitWait() {
  const now = Date.now();
  const gap = now - lastRequestAt;
  if (gap < 2000) await new Promise(r => setTimeout(r, 2000 - gap));
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

function stripCdata(s) {
  return decodeEntities(String(s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')).trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? stripCdata(m[1]) : '';
}

/**
 * Parse Personio XML feed text into normalized jobs.
 * Exported for testing; fetchJobs uses it internally.
 */
function parseFeed(xml, companySlug) {
  const positions = String(xml).match(/<position>([\s\S]*?)<\/position>/g) || [];
  return positions.map(p => {
    const jdBlock = extractTag(p, 'jobDescriptions');
    const sections = [];
    const jdRe = /<jobDescription>([\s\S]*?)<\/jobDescription>/g;
    let m;
    while ((m = jdRe.exec(jdBlock)) !== null) {
      const name = extractTag(m[1], 'name');
      const value = extractTag(m[1], 'value');
      if (value) sections.push(name ? `## ${name}\n${value}` : value);
    }
    // remove jobDescriptions so top-level <name> (the title) is unambiguous
    const head = p.replace(/<jobDescriptions>[\s\S]*?<\/jobDescriptions>/, '');
    const id = extractTag(head, 'id');
    const office = extractTag(head, 'office');
    const department = extractTag(head, 'department');
    return {
      id,
      title: extractTag(head, 'name'),
      url: id ? `https://${companySlug}.jobs.personio.de/job/${id}?display=en` : '',
      description: sections.join('\n\n'),
      location: [office, department].filter(Boolean).join(' — ') || office,
    };
  }).filter(j => j.id || j.title);
}

function parseJob(raw) {
  return {
    id: String(raw.id || ''),
    title: raw.title || raw.name || '',
    url: raw.url || '',
    description: raw.description || '',
    location: raw.location || raw.office || '',
  };
}

async function fetchJobs({ companySlug, limit = 10, fetchFn = global.fetch }) {
  if (!companySlug) throw new Error('companySlug is required');
  if (!fetchFn) throw new Error('fetch is not available (Node 18+ required or pass fetchFn)');
  await rateLimitWait();
  const url = `https://${encodeURIComponent(companySlug)}.jobs.personio.de/xml?language=en`;
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastRequestAt = Date.now();
    res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml, text/xml' } });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10) * 1000;
      await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) ? retryAfter : 2000 * (attempt + 1)));
      continue;
    }
    break;
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Personio company not found: ${companySlug}`);
    throw new Error(`Personio fetch failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const jobs = parseFeed(xml, companySlug);
  return limit ? jobs.slice(0, limit) : jobs;
}

function resetRateLimit() { lastRequestAt = 0; }

module.exports = { fetchJobs, parseFeed, parseJob, resetRateLimit };
