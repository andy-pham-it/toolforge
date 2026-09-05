'use strict';

const contract = require('../schemas/data-contract.v1.json');

const CORE_FIELDS = contract['x-core-fields'] || ['score','matchedKeywords','missingKeywords','suggestions','provider','url','fetchedAt','jobTitle','jobId'];
const PRO_FIELDS = contract['x-pro-fields'] || ['llmSuggestions','tailoredBullets','coverLetterHint'];

/**
 * Determine tier from license object.
 * Delegates to lib/license.verify if available; falls back to simple tier field check
 * so free tier works before license module is fully implemented (Todo 5).
 * @param {object|null} license - { tier, sig, expiresAt, ... } or null
 * @returns {'free'|'pro'}
 */
function tierCheck(license) {
  if (!license || typeof license !== 'object') return 'free';
  // try to verify via license module if present
  try {
    const licMod = require('./license');
    if (licMod && typeof licMod.verify === 'function' && license.sig) {
      const ok = licMod.verify(license);
      if (!ok) return 'free';
      // also check grace if expired
      if (licMod.isGraceValid) {
        if (!licMod.isGraceValid(license)) return 'free';
      } else if (license.expiresAt) {
        const exp = new Date(license.expiresAt).getTime();
        if (Number.isFinite(exp) && Date.now() > exp + 7*24*60*60*1000) return 'free';
      }
      return license.tier === 'pro' ? 'pro' : 'free';
    }
  } catch (_) {
    // license module not yet implemented or missing -> fallback
  }
  // Fallback: simple tier field (used in tests before license impl)
  if (license.tier === 'pro') {
    // if expiresAt present, enforce 7-day grace here as well
    if (license.expiresAt) {
      const exp = new Date(license.expiresAt).getTime();
      if (Number.isFinite(exp) && Date.now() > exp + 7*24*60*60*1000) return 'free';
    }
    return 'pro';
  }
  return 'free';
}

/**
 * Serialize scan result with tier gating - strips pro fields when free.
 * @param {object} result - scan result object (may contain core + pro keys)
 * @param {'free'|'pro'} tier - tier string or license object (auto-detected)
 * @returns {object} sanitized result
 */
function serialize(result, tier) {
  if (!result || typeof result !== 'object') throw new Error('result is required');
  let tierStr = tier;
  if (tier && typeof tier === 'object') tierStr = tierCheck(tier);
  if (tierStr !== 'pro' && tierStr !== 'free') tierStr = 'free';
  if (tierStr === 'pro') {
    return { ...result };
  }
  const out = { ...result };
  for (const f of PRO_FIELDS) delete out[f];
  // also delete nested pro if under result.pro
  if (out.pro && typeof out.pro === 'object') delete out.pro;
  return out;
}

module.exports = { tierCheck, serialize, CORE_FIELDS, PRO_FIELDS };
