'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { scanWithProvider } = require('./scanner');

/**
 * Parse CSV or NDJSON batch file.
 * CSV: header provider,company  or provider,companySlug
 * NDJSON: one JSON per line { provider, company | companySlug }
 */
function parseBatchFile(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const trimmed = content.trim();
  if (!trimmed) return [];
  // Try NDJSON first: every non-empty line is JSON
  const lines = trimmed.split('\n').filter(l => l.trim());
  let isJsonLines = false;
  try {
    const first = JSON.parse(lines[0]);
    if (first && typeof first === 'object' && (first.provider || first.company || first.companySlug)) isJsonLines = true;
  } catch (_) {}
  if (ext === '.json' || ext === '.ndjson' || isJsonLines) {
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        rows.push(obj);
      } catch (e) {
        rows.push({ _error: `invalid JSON: ${e.message}`, _raw: line });
      }
    }
    return rows;
  }
  // CSV fallback
  const header = lines[0].split(',').map(s => s.trim().toLowerCase());
  const provIdx = header.indexOf('provider');
  const compIdx = header.indexOf('company') !== -1 ? header.indexOf('company') : header.indexOf('companyslug');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map(s => s.trim());
    if (provIdx === -1 || compIdx === -1) {
      rows.push({ _error: 'bad CSV header: need provider,company', _raw: line });
      continue;
    }
    rows.push({ provider: cols[provIdx], company: cols[compIdx], companySlug: cols[compIdx] });
  }
  return rows;
}

async function runBatch(filePath, opts = {}) {
  if (!filePath) throw new Error('filePath is required');
  if (!fs.existsSync(filePath)) throw new Error(`batch file not found: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseBatchFile(content, filePath);
  const resume = opts.resume || null;
  let resumeObj = resume;
  if (opts.resumePath) {
    const { parseResume } = require('./resume');
    resumeObj = parseResume(opts.resumePath);
  }
  if (!resumeObj) {
    // try default resume resolution similar to scan command
    try {
      const { parseResume } = require('./resume');
      const defaults = ['resume.json', 'resume.yaml', 'resume.yml', 'resume.md'];
      for (const f of defaults) if (fs.existsSync(f)) { resumeObj = parseResume(f); break; }
    } catch (_) {}
  }
  const fetchFn = opts.fetchFn || global.fetch;
  const limit = opts.limit || 3;
  const results = [];
  let lastTs = 0;
  for (const row of rows) {
    const startedAt = new Date().toISOString();
    if (row._error) {
      results.push({ error: row._error, raw: row._raw, startedAt });
      continue;
    }
    const provider = row.provider;
    const company = row.company || row.companySlug;
    if (!provider || !company) {
      results.push({ error: 'missing provider or company', raw: row, startedAt });
      continue;
    }
    if (!resumeObj) {
      results.push({ error: 'no resume loaded', provider, company, startedAt });
      continue;
    }
    // Ensure ≥2s gap is enforced by provider layer; we also track for report
    const now = Date.now();
    // Note: provider fetchJobs already handles rate-limit internally; we just record timestamp
    try {
      const scans = await scanWithProvider({ provider, company, resume: resumeObj, license: opts.license || null, limit, fetchFn });
      for (const s of scans) {
        results.push({ ...s, startedAt, provider, company });
      }
    } catch (e) {
      results.push({ error: e.message, provider, company, startedAt });
    }
    lastTs = now;
  }
  // Write reports
  const outDir = opts.outDir || path.join(path.dirname(filePath), '.');
  const jsonPath = path.join(outDir, 'batch-report.json');
  const mdPath = path.join(outDir, 'batch-report.md');
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    let md = '# Batch Report\n\n';
    md += `Total: ${results.length} results from ${rows.length} inputs\n\n`;
    for (const r of results) {
      if (r.error) md += `- ERROR [${r.provider || '?'}:${r.company || '?'}] ${r.error}\n`;
      else md += `- ${r.jobTitle || r.jobId || 'job'} (${r.provider}:${r.company}) score=${r.score} matched=${(r.matchedKeywords||[]).join(', ')}\n`;
    }
    fs.writeFileSync(mdPath, md);
  } catch (_) {}
  return results;
}

module.exports = { runBatch, parseBatchFile };
