'use strict';

const os = require('os');
const path = require('path');
const capabilityMap = require('./capability-map');

const DEFAULTS = Object.freeze({
  authPath: path.join(os.homedir(), '.hermes', 'auth.json'),
  hermesBin: 'hermes',
  spawnCwd: process.cwd(),
  cwdAllowlist: [], // deny-all unless configured
  resetWindowMs: 24 * 60 * 60 * 1000, // 24h
  maxResultBytes: 50 * 1024,
  maxErrorDetailBytes: 500,
  tiebreakOrder: ['nvidia', 'huggingface', 'gemini', 'kimi-coding'], // L3; nous excluded (dead 404)
  capabilityMap,
});

/**
 * Merge defaults + env overrides + consumer config.
 * Env: HERMES_AUTH_PATH, HERMES_BIN.
 */
function loadConfig(overrides = {}) {
  const cfg = { ...DEFAULTS };
  if (process.env.HERMES_AUTH_PATH) cfg.authPath = process.env.HERMES_AUTH_PATH;
  if (process.env.HERMES_BIN) cfg.hermesBin = process.env.HERMES_BIN;
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) cfg[k] = v;
    }
  }
  return cfg;
}

module.exports = { loadConfig, DEFAULTS };
