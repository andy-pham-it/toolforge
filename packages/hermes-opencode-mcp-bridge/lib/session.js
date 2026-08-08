'use strict';

const crypto = require('node:crypto');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateConversationId() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `hob-${out}`;
}

class SessionManager {
  constructor({ sessionTimeout = 300, cleanupIntervalMs = 60000 } = {}) {
    this.sessions = new Map(); // conversation_id -> session record
    this.sessionTimeout = sessionTimeout;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this._timer = null;
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
    return id;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  touch(id) {
    const s = this.sessions.get(id);
    if (s) s.lastUsedAt = Date.now();
  }

  markActive(id, pid) {
    const s = this.sessions.get(id);
    if (s) s.activePid = pid;
  }

  markDone(id) {
    const s = this.sessions.get(id);
    if (s) s.activePid = null;
  }

  remove(id) {
    return this.sessions.delete(id);
  }

  sweep() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (s.activePid === null && now - s.lastUsedAt > this.sessionTimeout * 1000) {
        this.sessions.delete(id);
      }
    }
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
