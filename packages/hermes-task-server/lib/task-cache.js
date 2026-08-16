'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/** Resolve the cache directory (config override wins; default ~/.hermes/hermes-task-cache). */
function cacheDirFor(cfg = {}) {
  if (typeof cfg.cacheDir === 'string' && cfg.cacheDir.trim() !== '') return cfg.cacheDir;
  return path.join(os.homedir(), '.hermes', 'hermes-task-cache');
}

function fileFor(cfg, taskId) {
  return path.join(cacheDirFor(cfg), `${taskId}.json`);
}

/** Persist a run record to disk. Atomic (write tmp + rename). Best-effort — throws on failure. */
function cacheRun(cfg = {}, record = {}) {
  if (!record || typeof record.task_id !== 'string' || !record.task_id) return;
  const dir = cacheDirFor(cfg);
  fs.mkdirSync(dir, { recursive: true });
  const target = fileFor(cfg, record.task_id);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

/** Read a run record by task_id; null when missing/corrupt. */
function readRun(cfg = {}, taskId) {
  if (typeof taskId !== 'string' || !taskId) return null;
  try {
    const raw = fs.readFileSync(fileFor(cfg, taskId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Find run record(s) by session_id (scan cacheDir). Returns first match or null. */
function findBySession(cfg = {}, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  let entries;
  try {
    entries = fs.readdirSync(cacheDirFor(cfg), { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    const rec = readRun(cfg, ent.name.slice(0, -'.json'.length));
    if (rec && rec.session_id === sessionId) return rec;
  }
  return null;
}

/** List cached runs (metadata only, no heavy result payload). */
function listRuns(cfg = {}) {
  let entries;
  try {
    entries = fs.readdirSync(cacheDirFor(cfg), { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    const rec = readRun(cfg, ent.name.slice(0, -'.json'.length));
    if (!rec) continue;
    out.push({
      task_id: rec.task_id,
      session_id: rec.session_id || null,
      provider: rec.provider || null,
      model: rec.model || null,
      created_at: rec.created_at || null,
      duration_ms: rec.duration_ms ?? null,
      exit_code: rec.exit_code ?? null,
    });
  }
  out.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return out;
}

/** Load ALL cached run records in full (digest/tool_calls included) for telemetry. */
function loadAllRuns(cfg = {}) {
  let entries;
  try {
    entries = fs.readdirSync(cacheDirFor(cfg), { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    const rec = readRun(cfg, ent.name.slice(0, -'.json'.length));
    if (rec) out.push(rec);
  }
  return out;
}

module.exports = { cacheDirFor, cacheRun, readRun, findBySession, listRuns, loadAllRuns };
