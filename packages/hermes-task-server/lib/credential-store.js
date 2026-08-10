'use strict';

const fs = require('fs');
const path = require('path');

/**
 * FR-7 credential store: read auth.json, mark a provider's credentials
 * exhausted, atomic write (tmp + rename), best-effort wx lockfile.
 */

/** Parse auth.json; returns null on any read/parse failure. */
function readAuth(authPath) {
  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write auth JSON atomically: write <path>.tmp then rename. */
function writeAuth(authPath, auth) {
  const tmp = `${authPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(auth, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, authPath);
}

/**
 * Best-effort advisory lock: create <path>.lock with wx; on contention,
 * wait up to lockTimeoutMs then proceed unlocked (last-writer-wins).
 * Always releases the lock (unlinks) afterwards.
 */
function withLock(lockPath, lockTimeoutMs, fn) {
  const start = Date.now();
  let fd = null;
  for (;;) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') break; // unexpected -> proceed unlocked
      if (Date.now() - start >= lockTimeoutMs) break; // contention timeout -> proceed
      const wait = 5;
      const until = Date.now() + wait;
      while (Date.now() < until) { /* busy wait */ }
    }
  }
  try {
    return fn();
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
      try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
    }
  }
}

/**
 * Mark ALL credentials for `provider` exhausted and write back atomically.
 * Returns true if any credential was mutated, false if provider unknown / no mutation.
 * Non-fatal: throws are surfaced to caller who may ignore (best-effort FR-7).
 */
function markExhausted(authPath, provider, { code, reason, message } = {}, cfg = {}) {
  const resetWindowMs = cfg.resetWindowMs || 24 * 60 * 60 * 1000;
  const lockTimeoutMs = cfg.lockTimeoutMs != null ? cfg.lockTimeoutMs : 200;
  return withLock(`${authPath}.lock`, lockTimeoutMs, () => {
    const auth = readAuth(authPath);
    if (!auth) return false;
    const pool = auth.credential_pool;
    if (!pool || typeof pool !== 'object') return false;
    const creds = pool[provider];
    if (!creds) return false;
    const list = Array.isArray(creds) ? creds : [creds];
    const now = Date.now();
    const resetAt = now + resetWindowMs;
    let mutated = false;
    for (const c of list) {
      if (c && typeof c === 'object') {
        c.last_status = 'exhausted';
        if (code !== undefined) c.last_error_code = String(code);
        if (reason !== undefined) c.last_error_reason = String(reason);
        if (message !== undefined) c.last_error_message = String(message);
        c.last_error_reset_at = resetAt;
        mutated = true;
      }
    }
    if (!mutated) return false;
    writeAuth(authPath, auth);
    return true;
  });
}

module.exports = { markExhausted, readAuth, writeAuth, withLock };
