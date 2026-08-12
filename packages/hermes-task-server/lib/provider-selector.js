'use strict';

// L1/L2/L3 provider selection (spec FR-4 as updated):
//  L1 liveness filter  — credential_pool + top-level providers; ALIVE unless
//                        last_status in {exhausted, "429", 402} AND reset not yet due.
//  L2 capability map   — classify prompt -> capability -> ordered [(provider, model)].
//  L3 static tiebreak  — among equally suitable alive providers, order by tiebreakOrder.

const capabilityMap = require('./capability-map');

const DEAD_STATUSES = new Set(['exhausted', '429', 402]);

/** Normalize credential_pool entry to an array of credential dicts (defensive vs single-dict). */
function normalizeCredList(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Is a single credential alive? null last_status = alive. */
function credentialAlive(cred, now, forgiveTtlMs = 0) {
  if (!cred || typeof cred !== 'object') return false;
  const st = cred.last_status;
  if (st == null) return true;
  if (!DEAD_STATUSES.has(st)) return true;
  // Dead but reset window passed -> revived.
  const reset = Number(cred.last_error_reset_at);
  if (Number.isFinite(reset) && reset > 0 && reset < now) return true;
  // TTL auto-forgive: auth.json only updates on real calls, so a stale dead mark
  // can outlive a silently-reset quota. Forgive old marks — a genuinely dead
  // provider just re-freezes with fresh metadata on its next 429 (hermes' philosophy).
  if (forgiveTtlMs > 0) {
    const at = Number(cred.last_status_at);
    if (Number.isFinite(at) && at > 0 && now - at * 1000 > forgiveTtlMs) return true;
  }
  return false;
}

/**
 * L1: providers with at least one alive credential.
 * Merges auth.credential_pool keys + top-level auth.providers OAuth keys.
 */
function aliveProviders(auth, now = Date.now(), forgiveTtlMs = 0) {
  const alive = new Set();
  const pool = (auth && auth.credential_pool) || {};
  for (const [provider, creds] of Object.entries(pool)) {
    if (normalizeCredList(creds).some((c) => credentialAlive(c, now, forgiveTtlMs))) alive.add(provider);
  }
  const top = (auth && auth.providers) || {};
  for (const provider of Object.keys(top)) {
    if (credentialAlive(top[provider], now, forgiveTtlMs)) alive.add(provider);
  }
  return alive;
}

/** L2 keyword classification -> capability name (default reasoning). */
function classifyCapability(prompt) {
  const p = String(prompt || '').toLowerCase();
  const has = (...words) => words.some((w) => p.includes(w));
  if (has('generate image', 'create image', 'image of', 'draw ', 'illustration', 'logo', 'thumbnail', 'imagen', 'tạo ảnh', 'vẽ ')) return 'image-gen';
  if (has('voice', 'tts', 'speech', 'narration', 'audio', 'giọng', 'đọc ', 'narrate')) return 'voice';
  if (has('image', 'picture', 'photo', 'screenshot', 'visual', 'xem ảnh', 'nhìn ảnh', 'describe image', 'analyze image')) return 'vision';
  if (has('code', 'function', 'bug', 'refactor', 'implement', 'typescript', 'javascript', 'python', 'api', 'script', 'commit', 'test', 'debug', 'npm', 'git')) return 'coding';
  if (has('multimodal', 'video', 'diagram', 'chart', 'mixed')) return 'multimodal';
  if (has('reason', 'logic', 'proof', 'math', 'solve', 'explain why', 'why does')) return 'reason';
  if (has('plan', 'roadmap', 'outline', 'steps to', 'strategy', 'schedule', 'kế hoạch', 'lộ trình')) return 'planning';
  return 'reasoning';
}

/**
 * L1+L2+L3 combined. Returns {provider, model} or null when everything dead.
 * capability: explicit capability name or prompt text (auto-classified).
 */
function pickAliveProvider(capabilityOrPrompt, auth, cfg = {}) {
  const now = Date.now();
  const alive = aliveProviders(auth, now, cfg.exhaustedForgiveTtlMs || 0);
  const map = (cfg.capabilityMap || capabilityMap) || {};
  const tiebreak = cfg.tiebreakOrder || [];
  const cap =
    typeof capabilityOrPrompt === 'string' && Object.prototype.hasOwnProperty.call(map, capabilityOrPrompt)
      ? capabilityOrPrompt
      : classifyCapability(capabilityOrPrompt);
  const entries = map[cap] || map.reasoning || [];
  const ranked = entries
    .filter(([provider]) => alive.has(provider))
    .sort((a, b) => {
      const ia = tiebreak.indexOf(a[0]);
      const ib = tiebreak.indexOf(b[0]);
      const ra = ia === -1 ? tiebreak.length : ia;
      const rb = ib === -1 ? tiebreak.length : ib;
      return ra - rb;
    });
  if (ranked.length === 0) return null;
  const [provider, model] = ranked[0];
  return { provider, model };
}

/** Explicit provider valid against credential_pool keys ∪ top-level providers keys. */
function validateProvider(provider, auth) {
  if (!provider || !auth) return false;
  if ((auth.credential_pool || {})[provider]) return true;
  if ((auth.providers || {})[provider]) return true;
  return false;
}

/** Default model for an explicit provider — first reasoning entry hosted by that provider, else first entry overall. */
function defaultModelFor(provider, cfg = {}) {
  const map = (cfg.capabilityMap || capabilityMap) || {};
  const reasoning = map.reasoning || [];
  const hosted = reasoning.find(([p]) => p === provider);
  if (hosted) return hosted[1];
  if (reasoning.length > 0) return reasoning[0][1];
  return null;
}

module.exports = {
  aliveProviders,
  classifyCapability,
  credentialAlive,
  defaultModelFor,
  normalizeCredList,
  pickAliveProvider,
  validateProvider,
};
