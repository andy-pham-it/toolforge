'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CACHE_DIR = path.join(os.homedir(), '.config', 'jobscan');
const CACHE_PATH = path.join(CACHE_DIR, 'license.json');
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.JOBSCAN_LICENSE_PUBLIC_KEY || process.env.JOBSCAN_LICENSE_KEY || process.env.JOBSCAN_LICENSE_SECRET || '';
}

function payloadFor(lic) {
  // canonical payload: tier|expiresAt|key  (empty strings if missing)
  const tier = lic.tier || '';
  const exp = lic.expiresAt || '';
  const key = lic.key || lic.licenseKey || '';
  return `${tier}|${exp}|${key}`;
}

function computeSig(lic, secret) {
  const s = secret || getSecret();
  if (!s) return '';
  return crypto.createHmac('sha256', s).update(payloadFor(lic), 'utf8').digest('hex');
}

/**
 * Verify license signature.
 * Accepts object { tier, expiresAt, key/licenseKey, sig }.
 * Uses HMAC-SHA256 with server secret from env. Returns true only if sig matches.
 * @param {object} lic
 * @returns {boolean}
 */
function verify(lic) {
  if (!lic || typeof lic !== 'object') return false;
  const sig = lic.sig || lic.signature || '';
  if (!sig) return false;
  const secret = getSecret();
  if (!secret) return false;
  const expected = computeSig(lic, secret);
  if (!expected) return false;
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return sig === expected;
  }
}

/**
 * Sign a license payload (helper for tests / server-side). Not exported as CLI but useful.
 */
function sign(lic, secret) {
  const s = secret || getSecret();
  return computeSig(lic, s);
}

function isGraceValid(lic) {
  if (!lic || typeof lic !== 'object') return false;
  // must have valid signature to be considered
  if (!verify(lic)) return false;
  if (!lic.expiresAt) return true; // no expiry = indefinite
  const exp = new Date(lic.expiresAt).getTime();
  if (!Number.isFinite(exp)) return false;
  return Date.now() <= exp + GRACE_MS;
}

function getCachePath() {
  // allow XDG_CONFIG_HOME override for tests
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'jobscan', 'license.json');
  if (process.env.JOBSCAN_CACHE_PATH) return process.env.JOBSCAN_CACHE_PATH;
  return CACHE_PATH;
}

function loadCache() {
  const p = getCachePath();
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveCache(lic) {
  const p = getCachePath();
  const dir = path.dirname(p);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  const data = JSON.stringify(lic, null, 2);
  fs.writeFileSync(p, data, { mode: 0o600 });
  try { fs.chmodSync(p, 0o600); } catch (_) {}
  return p;
}

module.exports = { verify, sign, isGraceValid, loadCache, saveCache, getCachePath, GRACE_MS, computeSig };
