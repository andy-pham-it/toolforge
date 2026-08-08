'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateConversationId() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `hob-${out}`;
}

class SessionManager {
  // sessionFile: optional path to a JSON file. When set, sessions are loaded
  // on construction and persisted after every mutation so conversation_ids
  // survive bridge restarts.
  constructor({ sessionTimeout = 300, cleanupIntervalMs = 60000, sessionFile = null } = {}) {
    this.sessions = new Map(); // conversation_id -> session record
    this.sessionTimeout = sessionTimeout;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.sessionFile = sessionFile;
    this._timer = null;
    if (sessionFile) this._load();
  }

  _load() {
    let raw = null;
    try {
      raw = fs.readFileSync(this.sessionFile, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') return; // unreadable → start empty, don't clobber
      raw = null;
    }
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
      for (const [id, s] of Object.entries(obj)) {
        if (typeof s !== 'object' || s === null) continue;
        // A pid from a previous process is meaningless after restart.
        this.sessions.set(id, {
          opencodeSessionId: typeof s.opencodeSessionId === 'string' ? s.opencodeSessionId : null,
          projectDir: typeof s.projectDir === 'string' ? s.projectDir : null,
          createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
          lastUsedAt: typeof s.lastUsedAt === 'number' ? s.lastUsedAt : Date.now(),
          activePid: null,
        });
      }
    } catch { /* corrupt file → start empty */ }
  }

  _persist() {
    if (!this.sessionFile) return;
    try {
      fs.mkdirSync(path.dirname(this.sessionFile), { recursive: true });
      const obj = {};
      for (const [id, s] of this.sessions) {
        obj[id] = {
          opencodeSessionId: s.opencodeSessionId,
          projectDir: s.projectDir,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
          activePid: s.activePid,
        };
      }
      fs.writeFileSync(this.sessionFile, JSON.stringify(obj, null, 2) + '\n');
    } catch { /* persistence is best-effort; never break the bridge */ }
  }

  create(opencodeSessionId, projectDir) {
    const id = generateConversationId();
    const now = Date.now();
    this.sessions.set(id, {
      opencodeSessionId,
      projectDir,
      createdAt: now,
      lastUsedAt: now,
      activePid: null,
    });
    this._persist();
    return id;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  touch(id) {
    const s = this.sessions.get(id);
    if (s) {
      s.lastUsedAt = Date.now();
      this._persist();
    }
  }

  markActive(id, pid) {
    const s = this.sessions.get(id);
    if (s) {
      s.activePid = pid;
      this._persist();
    }
  }

  markDone(id) {
    const s = this.sessions.get(id);
    if (s) {
      s.activePid = null;
      this._persist();
    }
  }

  remove(id) {
    const removed = this.sessions.delete(id);
    if (removed) this._persist();
    return removed;
  }

  sweep() {
    const now = Date.now();
    let changed = false;
    for (const [id, s] of this.sessions) {
      if (s.activePid === null && now - s.lastUsedAt > this.sessionTimeout * 1000) {
        this.sessions.delete(id);
        changed = true;
      }
    }
    if (changed) this._persist();
  }

  startCleanup() {
    if (this._timer) return;
    this._timer = setInterval(() => this.sweep(), this.cleanupIntervalMs);
    this._timer.unref();
  }

  stopCleanup() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = { SessionManager, generateConversationId };
