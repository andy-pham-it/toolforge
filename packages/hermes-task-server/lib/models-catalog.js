'use strict';

// lib/models-catalog.js — runtime provider/model catalog for hermes_task (FR-5d).
// Merges Hermes' provider_models_cache.json (maintained by `hermes model`) with
// auth.json credential liveness and the capability-map fallback. Pure functions,
// no I/O — the caller (server.js) reads the cache/auth files and passes them in.

const { defaultModelFor, aliveProviders } = require('./provider-selector');
const capabilityMap = require('./capability-map');

const CAPS = ['reasoning', 'coding', 'vision', 'multimodal', 'planning', 'image-gen', 'voice', 'chat'];

// Capability -> attached-file input types the model can handle.
const INPUT_TYPES_BY_CAP = {
  vision: ['text', 'image', 'pdf'],
  multimodal: ['text', 'image', 'audio', 'video'],
};

/** Input types a capability-tagged model accepts (default: text-only). */
function inputTypesFor(cap) {
  const types = INPUT_TYPES_BY_CAP[cap];
  return types ? types.slice() : ['text'];
}

function unionInputTypes(caps) {
  if (!caps || caps.length === 0) return ['text'];
  const set = new Set();
  for (const cap of caps) {
    for (const t of inputTypesFor(cap)) set.add(t);
  }
  return [...set].sort();
}

function buildModelsForProvider(provider, cacheEntry, map, cfg) {
  // Capability tags: model belongs to capability if capabilityMap[cap] lists [provider, modelId].
  const capModels = new Map(); // modelId -> Set(cap)
  for (const cap of CAPS) {
    for (const [p, modelId] of map[cap] || []) {
      if (p === provider) {
        if (!capModels.has(modelId)) capModels.set(modelId, new Set());
        capModels.get(modelId).add(cap);
      }
    }
  }

  const defaultModel = defaultModelFor(provider, cfg);
  const cacheModels = cacheEntry && Array.isArray(cacheEntry.models) ? cacheEntry.models : [];
  // Cache is the authoritative runtime model list (fetched from /v1/models); the
  // capability-map only fills in when this provider has no cached list (fallback).
  const ids = cacheModels.length > 0 ? new Set(cacheModels) : new Set(capModels.keys());

  const out = [];
  for (const id of ids) {
    const caps = [...(capModels.get(id) || [])].sort();
    out.push({
      id,
      capabilities: caps,
      input_types: unionInputTypes(caps),
      is_default: id === defaultModel,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

/**
 * Build the catalog.
 * @param {object|null} modelsCache parsed provider_models_cache.json ({provider: {fp, at, models: []}}) or null
 * @param {object|null} auth parsed auth.json ({credential_pool, providers}) or null
 * @param {object} cfg config (capabilityMap, tiebreakOrder via defaultModelFor)
 * @returns {{providers: Array, source: 'cache'|'capability-map'|'mixed', fetched_at: number|null, count: number}}
 */
function buildCatalog({ modelsCache = null, auth = null, cfg = {} }) {
  const map = cfg.capabilityMap || capabilityMap;
  const alive = auth ? aliveProviders(auth) : null; // Set<string> of provider names with a live credential

  const cacheProviders = modelsCache && typeof modelsCache === 'object' ? modelsCache : {};
  const mapProviders = new Set();
  for (const cap of CAPS) {
    for (const [p] of map[cap] || []) mapProviders.add(p);
  }
  const providerNames = new Set([...Object.keys(cacheProviders), ...mapProviders]);

  const providers = [];
  let usedCache = false;
  let usedMap = false;
  let topFetchedAt = null;

  for (const provider of providerNames) {
    const cacheEntry = cacheProviders[provider];
    const models = buildModelsForProvider(provider, cacheEntry, map, cfg);
    if (models.length === 0) continue; // skip providers with zero known models (e.g. nous)

    const source = cacheEntry && Array.isArray(cacheEntry.models) && cacheEntry.models.length > 0 ? 'cache' : 'capability-map';
    if (source === 'cache') usedCache = true;
    else usedMap = true;

    const fetchedAt = cacheEntry && typeof cacheEntry.at === 'number' ? cacheEntry.at : null;
    if (fetchedAt != null && (topFetchedAt == null || fetchedAt > topFetchedAt)) topFetchedAt = fetchedAt;

    const cred =
      auth && auth.credential_pool && auth.credential_pool[provider] && auth.credential_pool[provider][0]
        ? auth.credential_pool[provider][0]
        : null;
    const status = alive === null ? 'unknown' : alive.has(provider) ? 'alive' : 'dead';

    providers.push({
      provider,
      status,
      last_status: cred && cred.last_status != null ? cred.last_status : null,
      last_error_code: cred && cred.last_error_code != null ? cred.last_error_code : null,
      fetched_at: fetchedAt,
      source,
      model_count: models.length,
      default_model: defaultModelFor(provider, cfg),
      models,
    });
  }

  providers.sort((a, b) => a.provider.localeCompare(b.provider));
  const topSource = usedCache && usedMap ? 'mixed' : usedCache ? 'cache' : 'capability-map';

  return { providers, source: topSource, fetched_at: topFetchedAt, count: providers.length };
}

module.exports = { buildCatalog, inputTypesFor, CAPS };
