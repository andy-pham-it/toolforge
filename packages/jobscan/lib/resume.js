'use strict';

const fs = require('fs');
const path = require('path');

function validateResume(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Resume must be an object');
  if (!obj.name || typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new Error('Missing required field: name');
  }
  if (!Array.isArray(obj.skills) || obj.skills.length === 0) {
    throw new Error('Missing required field: skills (non-empty array)');
  }
  // normalize contact email check if present
  if (obj.contact && obj.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.contact.email)) {
    throw new Error('Invalid contact.email format');
  }
  // dates format check
  if (Array.isArray(obj.experience)) {
    for (const exp of obj.experience) {
      if (exp.startDate && !/^\d{4}-\d{2}$/.test(exp.startDate)) {
        throw new Error(`Invalid startDate format: ${exp.startDate} (expected YYYY-MM)`);
      }
      if (exp.endDate && !/^(\d{4}-\d{2}|present)$/.test(exp.endDate)) {
        throw new Error(`Invalid endDate format: ${exp.endDate}`);
      }
    }
  }
  return true;
}

function normalizeResume(obj) {
  const out = JSON.parse(JSON.stringify(obj));
  out.name = String(out.name).trim();
  if (Array.isArray(out.skills)) {
    out.skills = out.skills.map(s => String(s).trim()).filter(Boolean);
  }
  if (!out.custom || typeof out.custom !== 'object') out.custom = {};
  if (!out.contact) out.contact = {};
  if (Array.isArray(out.experience)) {
    out.experience = out.experience.map(e => ({
      title: e.title || e.role || '',
      role: e.role || e.title || '',
      company: e.company || '',
      startDate: e.startDate || '',
      endDate: e.endDate || '',
      dates: e.dates || (e.startDate && e.endDate ? `${e.startDate} - ${e.endDate}` : ''),
      bullets: Array.isArray(e.bullets) ? e.bullets : [],
    }));
  }
  return out;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { data: {}, body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: content };
  const fmRaw = content.slice(3, end).trim();
  const body = content.slice(end + 4).trim();
  // simple YAML-like parse for resume frontmatter (key: value, arrays with - )
  const data = {};
  let currentKey = null;
  for (const line of fmRaw.split('\n')) {
    if (/^\s*-\s+/.test(line) && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, ''));
    } else if (line.includes(':')) {
      const idx = line.indexOf(':');
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (v === '') {
        data[k] = [];
        currentKey = k;
      } else {
        // try JSON array, fallback to bracket CSV like [JS, Python]
        if (v.startsWith('[')) {
          try { data[k] = JSON.parse(v); } catch {
            const inner = v.slice(1, -1);
            data[k] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          }
        } else {
          data[k] = v;
        }
        currentKey = k;
      }
    }
  }
  return { data, body };
}

function parseResume(filePath) {
  if (!filePath || typeof filePath !== 'string') throw new Error('filePath required');
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');

  if (ext === '.json') {
    const obj = JSON.parse(raw);
    validateResume(obj);
    return normalizeResume(obj);
  }
  if (ext === '.yaml' || ext === '.yml') {
    let yaml;
    try {
      yaml = require('js-yaml');
    } catch {
      throw new Error('YAML support requires js-yaml. Run: npm install js-yaml -w @andy-toolforge/jobscan');
    }
    const obj = yaml.load(raw);
    validateResume(obj);
    return normalizeResume(obj);
  }
  if (ext === '.md') {
    const { data, body } = parseFrontmatter(raw);
    // body becomes summary if summary missing
    const obj = { ...data };
    if (body && !obj.summary) obj.summary = body.slice(0, 500);
    // skills may be string comma separated in frontmatter
    if (typeof obj.skills === 'string') {
      obj.skills = obj.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    validateResume(obj);
    return normalizeResume(obj);
  }
  throw new Error(`Unsupported resume format: ${ext} (supported: .json, .yaml, .md)`);
}

module.exports = { parseResume, validateResume, normalizeResume };
