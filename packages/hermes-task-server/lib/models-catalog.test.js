'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCatalog, inputTypesFor, CAPS } = require('./models-catalog');

test('inputTypesFor: maps capabilities to attached-file input types', () => {
  assert.deepEqual(inputTypesFor('vision'), ['text', 'image', 'pdf']);
  assert.deepEqual(inputTypesFor('multimodal'), ['text', 'image', 'audio', 'video']);
  for (const cap of ['reasoning', 'coding', 'chat', 'planning', 'image-gen', 'voice']) {
    assert.deepEqual(inputTypesFor(cap), ['text'], `cap ${cap}`);
  }
});

test('CAPS: covers all capability-map capability keys', () => {
  assert.deepEqual(CAPS, ['reasoning', 'coding', 'vision', 'multimodal', 'planning', 'image-gen', 'voice', 'chat']);
});

test('buildCatalog: merges cache models with capability tags, liveness and default flags', () => {
  const modelsCache = {
    gemini: { at: 1234, models: ['gemini-3.1-flash-lite', 'gemini-3-flash'] },
  };
  const auth = { credential_pool: { gemini: [{ last_status: null }] } };
  const cat = buildCatalog({ modelsCache, auth, cfg: {} });

  assert.equal(cat.count, 3); // gemini (cache) + openrouter + opencode-zen (capability-map)
  assert.equal(cat.source, 'mixed');
  assert.equal(cat.fetched_at, 1234);

  const g = cat.providers[0];
  assert.equal(g.provider, 'gemini');
  assert.equal(g.status, 'alive');
  assert.equal(g.last_status, null);
  assert.equal(g.last_error_code, null);
  assert.equal(g.source, 'cache');
  assert.equal(g.fetched_at, 1234);
  assert.equal(g.model_count, 2);
  assert.equal(g.default_model, 'gemini-3.1-flash-lite');

  const flagship = g.models.find((m) => m.id === 'gemini-3.1-flash-lite');
  assert.ok(flagship.is_default);
  assert.ok(flagship.capabilities.includes('reasoning'));
  assert.ok(flagship.capabilities.includes('coding'));
  assert.ok(flagship.capabilities.includes('vision'));
  assert.ok(flagship.capabilities.includes('multimodal'));
  assert.deepEqual(flagship.input_types, ['audio', 'image', 'pdf', 'text', 'video']);

  const flash = g.models.find((m) => m.id === 'gemini-3-flash');
  assert.equal(flash.is_default, false);
  assert.ok(flash.capabilities.includes('reasoning'));
  assert.ok(flash.capabilities.includes('coding'));
  assert.deepEqual(flash.input_types, ['text']);
});

test('buildCatalog: dead provider status + last error surfaced', () => {
  const modelsCache = { gemini: { at: 1, models: ['gemini-3.1-flash-lite'] } };
  const auth = { credential_pool: { gemini: [{ last_status: 'exhausted', last_error_code: 429 }] } };
  const cat = buildCatalog({ modelsCache, auth, cfg: {} });
  assert.equal(cat.providers[0].status, 'dead');
  assert.equal(cat.providers[0].last_status, 'exhausted');
  assert.equal(cat.providers[0].last_error_code, 429);
});

test('buildCatalog: no auth -> status unknown', () => {
  const modelsCache = { gemini: { at: 1, models: ['gemini-3.1-flash-lite'] } };
  const cat = buildCatalog({ modelsCache, auth: null, cfg: {} });
  assert.equal(cat.providers[0].status, 'unknown');
});

test('buildCatalog: skips providers with zero models', () => {
  const modelsCache = {
    gemini: { at: 1, models: ['gemini-3.1-flash-lite'] },
    nous: { at: 1, models: [] },
  };
  const auth = { credential_pool: { gemini: [{ last_status: null }], nous: [{ last_status: null }] } };
  const cat = buildCatalog({ modelsCache, auth, cfg: {} });
  assert.equal(cat.count, 3); // gemini + capability-map providers; nous skipped
  assert.equal(cat.providers[0].provider, 'gemini');
  assert.ok(!cat.providers.some((p) => p.provider === 'nous'), 'zero-model provider must be skipped');
});

test('buildCatalog: missing cache falls back to capability-map (tool always answers)', () => {
  const auth = { credential_pool: { gemini: [{ last_status: null }] } };
  const cat = buildCatalog({ modelsCache: null, auth, cfg: {} });
  assert.equal(cat.source, 'capability-map');
  assert.equal(cat.fetched_at, null);
  const g = cat.providers.find((p) => p.provider === 'gemini');
  assert.ok(g);
  assert.equal(g.source, 'capability-map');
  assert.ok(g.model_count > 0);
  assert.ok(g.models.some((m) => m.id === 'gemini-3.1-flash-lite'));
});

test('buildCatalog: source mixed when cache + capability-map both contribute', () => {
  const modelsCache = { gemini: { at: 1, models: ['gemini-3.1-flash-lite'] } };
  const auth = {
    credential_pool: {
      gemini: [{ last_status: null }],
      openrouter: [{ last_status: null }],
    },
  };
  const cat = buildCatalog({ modelsCache, auth, cfg: {} });
  assert.equal(cat.source, 'mixed');
  assert.equal(cat.count, 3); // gemini (cache) + openrouter + opencode-zen (capability-map)
  assert.equal(cat.providers.find((p) => p.provider === 'gemini').source, 'cache');
  assert.equal(cat.providers.find((p) => p.provider === 'openrouter').source, 'capability-map');
});

test('buildCatalog: models sorted by id, providers sorted by name', () => {
  const modelsCache = {
    gemini: { at: 1, models: ['gemini-3-flash', 'gemini-3.1-flash-lite'] },
    opencode: { at: 1, models: ['deepseek-v4-flash-free'] },
  };
  const cat = buildCatalog({ modelsCache, auth: null, cfg: {} });
  assert.deepEqual(cat.providers.map((p) => p.provider), ['gemini', 'opencode', 'opencode-zen', 'openrouter']);
  // localeCompare: '-' (0x2D) < '.' (0x2E), so gemini-3-flash sorts before gemini-3.1-flash-lite
  assert.deepEqual(cat.providers[0].models.map((m) => m.id), ['gemini-3-flash', 'gemini-3.1-flash-lite']);
});
