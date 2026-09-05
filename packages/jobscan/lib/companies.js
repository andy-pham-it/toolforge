'use strict';

// Company config + provider inference (career-ops style).
//
// A user who doesn't know companySlug pastes a careers page URL instead:
//   jobscan scan --url https://boards.greenhouse.io/datadog
// `inferProvider()` maps the URL to { provider, companySlug } for all
// 9 supported ATS boards. `jobscan.yml` (created by `jobscan init`)
// stores the user's company list so bare `jobscan scan` just works.

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = 'jobscan.yml';

/**
 * Infer { provider, companySlug } from a careers page URL.
 * Returns null when the URL doesn't match any supported ATS.
 * Slug case is preserved (SmartRecruiters IDs are case-sensitive).
 * @param {string} rawUrl
 * @returns {{ provider: string, companySlug: string } | null}
 */
function inferProvider(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let u = rawUrl.trim();
  if (!u) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = 'https://' + u;
  let parsed;
  try {
    parsed = new URL(u);
  } catch (_) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const segs = parsed.pathname.split('/').filter(Boolean);

  // Greenhouse: boards/job-boards(.eu).greenhouse.io/{slug}[/...] or {slug}.greenhouse.io
  // (job-boards.* is career-ops' canonical pattern — users paste these from Google)
  if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io' || host === 'job-boards.eu.greenhouse.io') {
    if (segs[0]) return { provider: 'greenhouse', companySlug: segs[0] };
    return null;
  }
  let m = host.match(/^([a-z0-9-]+)\.greenhouse\.io$/);
  if (m) return { provider: 'greenhouse', companySlug: m[1] };

  // Lever: lever.co/{slug} or jobs(.eu).lever.co/{slug}[/...]
  if (host === 'lever.co' || host === 'jobs.lever.co' || host === 'jobs.eu.lever.co') {
    if (segs[0]) return { provider: 'lever', companySlug: segs[0] };
    return null;
  }

  // Ashby: jobs.ashbyhq.com/{slug}[/...]
  if (host === 'jobs.ashbyhq.com') {
    if (segs[0]) return { provider: 'ashby', companySlug: segs[0] };
    return null;
  }

  // SmartRecruiters: careers.smartrecruiters.com/{Company}[/...]
  // or jobs.smartrecruiters.com/{Company}[/...] (users paste job links too).
  // Company ID is case-sensitive (e.g. BoschGroup) — preserve as-is.
  if (host === 'careers.smartrecruiters.com' || host === 'jobs.smartrecruiters.com') {
    if (!segs[0]) return null;
    return { provider: 'smartrecruiters', companySlug: segs[0] };
  }

  // Workable: {slug}.workable.com
  m = host.match(/^([a-z0-9-]+)\.workable\.com$/);
  if (m) return { provider: 'workable', companySlug: m[1] };

  // Recruitee: {company}.recruitee.com
  m = host.match(/^([a-z0-9-]+)\.recruitee\.com$/);
  if (m) return { provider: 'recruitee', companySlug: m[1] };

  // Pinpoint: {slug}.pinpointhq.com
  m = host.match(/^([a-z0-9-]+)\.pinpointhq\.com$/);
  if (m) return { provider: 'pinpoint', companySlug: m[1] };

  // Personio: {company}.jobs.personio.de (or .com)
  m = host.match(/^([a-z0-9-]+)\.jobs\.personio\.(de|com)$/);
  if (m) return { provider: 'personio', companySlug: m[1] };

  // RemoteOK: board-wide, no company
  if (host === 'remoteok.com' || host === 'www.remoteok.com' || host === 'remoteok.io') {
    return { provider: 'remoteok', companySlug: 'all' };
  }

  return null;
}

/**
 * Parse a careers URL or throw a friendly error telling the user what to do.
 */
function parseCompaniesUrl(rawUrl) {
  const hit = inferProvider(rawUrl);
  if (hit) return hit;
  throw new Error(
    `Không nhận ra ATS từ URL: ${rawUrl}\n` +
    'Hỗ trợ: Greenhouse (boards.greenhouse.io), Lever (jobs.lever.co), Ashby (jobs.ashbyhq.com), ' +
    'SmartRecruiters (careers.smartrecruiters.com), Workable (*.workable.com), Recruitee (*.recruitee.com), ' +
    'Pinpoint (*.pinpointhq.com), Personio (*.jobs.personio.de).\n' +
    'Hoặc quét board tổng không cần URL: jobscan scan --provider remoteok --company all'
  );
}

function configPath(cwd = process.cwd()) {
  return path.join(cwd, CONFIG_FILE);
}

const INIT_TEMPLATE = `# jobscan.yml — company list for bare \`jobscan scan\` (career-ops style).
# Each entry is a careers page URL; provider + slug are inferred automatically.
# Unknown URLs are skipped with a warning. No file? scan falls back to RemoteOK board.
resume: resume.json
companies:
  - url: https://boards.greenhouse.io/datadog
  # - url: https://jobs.lever.co/lever
  # - url: https://jobs.ashbyhq.com/ashby
`;

/**
 * Create jobscan.yml in cwd. Throws if it already exists.
 * @returns {string} written path
 */
function initConfig(cwd = process.cwd()) {
  const p = configPath(cwd);
  if (fs.existsSync(p)) throw new Error(`Đã có ${CONFIG_FILE} ở ${cwd} — sửa trực tiếp file đó.`);
  fs.writeFileSync(p, INIT_TEMPLATE, 'utf8');
  return p;
}

/**
 * Load jobscan.yml from cwd. Returns null when missing.
 * Throws friendly error on invalid YAML/shape.
 */
function loadConfig(cwd = process.cwd()) {
  const p = configPath(cwd);
  if (!fs.existsSync(p)) return null;
  let yaml;
  try {
    yaml = require('js-yaml');
  } catch (_) {
    throw new Error('YAML support requires js-yaml. Run: npm install js-yaml -w @andy-toolforge/jobscan');
  }
  let cfg;
  try {
    cfg = yaml.load(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {
    throw new Error(`${CONFIG_FILE} lỗi YAML: ${e.message}`);
  }
  const companies = Array.isArray(cfg.companies) ? cfg.companies : [];
  return { resume: cfg.resume || 'resume.json', companies, raw: cfg };
}

function saveConfig(cfg, cwd = process.cwd()) {
  const yaml = require('js-yaml');
  const doc = { resume: cfg.resume || 'resume.json', companies: cfg.companies || [] };
  fs.writeFileSync(configPath(cwd), yaml.dump(doc), 'utf8');
  return configPath(cwd);
}

/**
 * Append a company URL to jobscan.yml (creates the file if missing).
 * Unknown ATS URLs are still saved but reported so the user can fix them.
 * @returns {{ config, inferred }} inferred is null when ATS unknown
 */
function addCompany(rawUrl, cwd = process.cwd()) {
  if (!rawUrl || !String(rawUrl).trim()) throw new Error('Thiếu URL. Ví dụ: jobscan companies --add https://boards.greenhouse.io/datadog');
  let cfg = loadConfig(cwd);
  if (!cfg) cfg = { resume: 'resume.json', companies: [] };
  const url = String(rawUrl).trim();
  const inferred = inferProvider(url);
  if (!cfg.companies.some((c) => c && c.url === url)) cfg.companies.push({ url });
  saveConfig(cfg, cwd);
  return { config: cfg, inferred };
}

/**
 * Resolve one config entry to { provider, companySlug, label }.
 * Entry shape: { url } or { provider, company }. Returns null when unresolvable.
 */
function resolveEntry(entry) {
  if (!entry) return null;
  if (entry.url) {
    const hit = inferProvider(entry.url);
    if (!hit) return null;
    return { ...hit, label: entry.url };
  }
  if (entry.provider && entry.company) {
    return { provider: String(entry.provider), companySlug: String(entry.company), label: `${entry.provider}:${entry.company}` };
  }
  return null;
}

module.exports = {
  CONFIG_FILE,
  inferProvider,
  parseCompaniesUrl,
  configPath,
  initConfig,
  loadConfig,
  saveConfig,
  addCompany,
  resolveEntry,
};
