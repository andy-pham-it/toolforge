'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function getBasePath(resumePath) {
  if (process.env.JOBSCAN_BASE_PATH) return process.env.JOBSCAN_BASE_PATH;
  const dir = resumePath ? path.dirname(path.resolve(resumePath)) : path.join(os.homedir(), '.config', 'jobscan');
  return path.join(dir, 'resume.base.json');
}

function getConfigBasePath() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'jobscan', 'resume.base.json');
  return path.join(os.homedir(), '.config', 'jobscan', 'resume.base.json');
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 3-way merge: base + local (current file) + remote (suggestions/last-scan derived)
 * Preserves local `custom` field always.
 * On conflict, writes <resume>.merge-conflict and <resume>.merge-conflict.json sidecar, does NOT overwrite original.
 * @param {string} resumePath - path to current resume file
 * @param {object} opts - { remote, basePath, fetchFn }
 * @returns {object} { merged, conflict, conflictPath }
 */
function mergeResume(resumePath, opts = {}) {
  if (!resumePath) {
    // default resume locations
    const defaults = ['resume.json', path.join(os.homedir(), '.config', 'jobscan', 'resume.json')];
    for (const p of defaults) if (fs.existsSync(p)) { resumePath = p; break; }
    if (!resumePath) throw new Error('No resume file found. Use --resume <path>');
  }
  if (!fs.existsSync(resumePath)) throw new Error(`resume not found: ${resumePath}`);

  const localRaw = fs.readFileSync(resumePath, 'utf8');
  let local;
  try { local = JSON.parse(localRaw); } catch (e) { throw new Error(`invalid resume JSON: ${e.message}`); }

  // base = last pulled
  let base = null;
  let basePath = opts.basePath || getBasePath(resumePath);
  // also try XDG base if not found
  if (!fs.existsSync(basePath) && basePath !== getConfigBasePath() && fs.existsSync(getConfigBasePath())) basePath = getConfigBasePath();
  if (fs.existsSync(basePath)) {
    try { base = JSON.parse(fs.readFileSync(basePath, 'utf8')); } catch (_) { base = null; }
  }
  if (!base) {
    // no base: treat base = local clone, just save base after
    base = JSON.parse(JSON.stringify(local));
  }

  // remote: suggestions from opts.remote or last-scan derived suggestions
  let remote = opts.remote || null;
  if (!remote) {
    // try to derive from last-scan
    const lastScanPath = process.env.JOBSCAN_LAST_SCAN_PATH || (process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, 'jobscan', 'last-scan.json') : path.join(os.homedir(), '.config', 'jobscan', 'last-scan.json'));
    if (fs.existsSync(lastScanPath)) {
      try {
        const scan = JSON.parse(fs.readFileSync(lastScanPath, 'utf8'));
        const s = Array.isArray(scan) ? scan[0] : scan;
        if (s && s.suggestions) remote = { _suggestions: s.suggestions, _missing: s.missingKeywords };
      } catch (_) {}
    }
  }

  // Simple merge: if remote has suggestions, we don't auto-modify skills etc; we just inject remote_suggestions into local if not present
  // For 3-way test: detect overlapping edits on same key where base differs from both local and remote and they differ each other -> conflict
  const conflicts = [];
  const merged = JSON.parse(JSON.stringify(local));

  // Preserve custom always from local (no remote override)
  if (local.custom) merged.custom = local.custom;

  // If remote provides concrete fields (e.g., summary, skills), do 3-way per key
  const remoteFields = remote && typeof remote === 'object' ? remote : {};
  // Only consider keys that are in base or local
  const allKeys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remoteFields).filter(k => !k.startsWith('_'))]);
  for (const key of allKeys) {
    if (key === 'custom' || key.startsWith('_')) continue;
    const bv = base[key];
    const lv = local[key];
    const rv = remoteFields[key];
    if (rv === undefined) continue; // no remote change for this key
    const baseEqLocal = deepEqual(bv, lv);
    const baseEqRemote = deepEqual(bv, rv);
    const localEqRemote = deepEqual(lv, rv);
    if (baseEqLocal && !baseEqRemote) {
      // local untouched, remote changed -> take remote
      merged[key] = rv;
    } else if (!baseEqLocal && baseEqRemote) {
      // remote untouched, local changed -> keep local (already)
    } else if (baseEqLocal && baseEqRemote) {
      // none changed
    } else if (!baseEqLocal && !baseEqRemote && !localEqRemote) {
      // both changed differently -> conflict
      conflicts.push({ key, base: bv, local: lv, remote: rv });
    }
    // else localEqRemote -> no conflict
  }

  // If remote was suggestions-only, just attach as _suggestions for visibility (not conflict)
  if (remote && remote._suggestions && !conflicts.length) {
    // append suggestions as comment field without overwriting
    merged._lastSuggestions = remote._suggestions;
  }

  if (conflicts.length) {
    const conflictPath = `${resumePath}.merge-conflict`;
    const sidecar = `${resumePath}.merge-conflict.json`;
    let marker = '';
    for (const c of conflicts) {
      marker += `<<<<<<< LOCAL (${c.key})\n${JSON.stringify(c.local, null, 2)}\n=======\n${JSON.stringify(c.remote, null, 2)}\n>>>>>>> REMOTE\n`;
    }
    const baseContent = `Base (${path.basename(basePath)}):\n${JSON.stringify(base, null, 2)}\n\nConflicts:\n${marker}`;
    fs.writeFileSync(conflictPath, baseContent);
    fs.writeFileSync(sidecar, JSON.stringify({ base, local, remote: remoteFields, conflicts }, null, 2));
    return { merged: null, conflict: true, conflictPath, sidecar, conflicts, preservedCustom: local.custom };
  }

  // No conflict: write merged back and update base
  // But per spec on no-conflict, preserve custom and overwrite? We write to resumePath
  // For safety, we write merged to resumePath only if not in test dry-run
  if (!opts.dryRun) {
    fs.writeFileSync(resumePath, JSON.stringify(merged, null, 2));
    // update base copy
    try { fs.writeFileSync(basePath, JSON.stringify(merged, null, 2)); } catch (_) {
      try { fs.mkdirSync(path.dirname(basePath), { recursive: true }); fs.writeFileSync(basePath, JSON.stringify(merged, null, 2)); } catch (_) {}
    }
  }
  return { merged, conflict: false, conflictPath: null, conflicts: [] };
}

module.exports = { mergeResume, getBasePath, getConfigBasePath };
