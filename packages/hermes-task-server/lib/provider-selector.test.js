'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aliveProviders,
  classifyCapability,
  credentialAlive,
  defaultModelFor,
  normalizeCredList,
  pickAliveProvider,
  validateProvider,
} = require('./provider-selector');

const cfg = {}; // defaults (tiebreakOrder + capabilityMap from module)

function auth(credentialPool, providers) {
  return { credential_pool: credentialPool, providers: providers || {} };
}

test('normalizeCredList: single dict -> array', () => {
  const single = { id: 'a', last_status: null };
  assert.deepEqual(normalizeCredList(single), [single]);
  assert.deepEqual(normalizeCredList([single]), [single]);
  assert.deepEqual(normalizeCredList(null), []);
});

test('credentialAlive: null status alive; dead statuses dead; reset_at in past revives', () => {
  const now = Date.now();
  assert.equal(credentialAlive({ last_status: null }, now), true);
  assert.equal(credentialAlive({ last_status: 'active' }, now), true);
  assert.equal(credentialAlive({ last_status: 'exhausted' }, now), false);
  assert.equal(credentialAlive({ last_status: '429' }, now), false);
  assert.equal(credentialAlive({ last_status: 402 }, now), false);
  assert.equal(
    credentialAlive({ last_status: 'exhausted', last_error_reset_at: now - 1000 }, now),
    true
  );
  assert.equal(
    credentialAlive({ last_status: 'exhausted', last_error_reset_at: now + 100000 }, now),
    false
  );
});

test('aliveProviders: merges credential_pool + top-level providers', () => {
  const a = auth(
    {
      nvidia: [{ last_status: null }],
      openrouter: [{ last_status: 'exhausted' }],
      nous: [{ last_status: 'exhausted', last_error_reset_at: Date.now() - 1 }], // revived
    },
    { gemini: { last_status: null } }
  );
  assert.deepEqual([...aliveProviders(a)].sort(), ['gemini', 'nous', 'nvidia']);
});

test('classifyCapability: keyword buckets', () => {
  assert.equal(classifyCapability('write a function that sorts an array'), 'coding');
  assert.equal(classifyCapability('generate image of a cat'), 'image-gen');
  assert.equal(classifyCapability('read this image and describe it'), 'vision');
  assert.equal(classifyCapability('plan a marketing roadmap'), 'planning');
  assert.equal(classifyCapability('narrate this text with tts'), 'voice');
  assert.equal(classifyCapability('prove why this math theorem holds'), 'reason');
  assert.equal(classifyCapability('hello there'), 'reasoning'); // default
});

test('pickAliveProvider: picks first alive entry by capability + tiebreak', () => {
  const a = auth({
    nvidia: [{ last_status: null }],
    openrouter: [{ last_status: 'exhausted' }], // dead -> openrouter entries skipped
    'opencode-zen': [{ last_status: 'exhausted' }], // dead -> opencode-zen entries skipped
    gemini: [{ last_status: null }],
  });
  // reasoning map first entry is gemini (alive) -> gemini/gemini-3.1-flash-lite
  assert.deepEqual(pickAliveProvider('solve this math problem', a, cfg), {
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
  });
  // coding: gemini alive first
  assert.equal(pickAliveProvider('fix this bug in javascript', a, cfg).provider, 'gemini');
});

test('pickAliveProvider: all exhausted -> null (no_credential)', () => {
  const a = auth({
    nvidia: [{ last_status: 'exhausted' }],
    gemini: [{ last_status: 'exhausted' }],
  });
  assert.equal(pickAliveProvider('anything', a, cfg), null);
});

test('pickAliveProvider: missing credential_pool but top-level providers alive', () => {
  const a = { providers: { gemini: { last_status: null } } };
  assert.deepEqual(pickAliveProvider('hello', a, cfg), { provider: 'gemini', model: 'gemini-3.1-flash-lite' });
});

test('pickAliveProvider: explicit capability name bypasses classification', () => {
  const a = auth({ gemini: [{ last_status: null }] });
  assert.equal(pickAliveProvider('image-gen', a, cfg).provider, 'gemini');
});

test('validateProvider: pool key or top-level providers key', () => {
  const a = auth({ nvidia: [{ id: 'x' }] }, { nous: { last_status: null } });
  assert.equal(validateProvider('nvidia', a), true);
  assert.equal(validateProvider('nous', a), true);
  assert.equal(validateProvider('nonexistent', a), false);
  assert.equal(validateProvider('nvidia', null), false);
});

test('defaultModelFor: hosted reasoning entry else first entry', () => {
  assert.equal(defaultModelFor('gemini', cfg), 'gemini-3.1-flash-lite');
  assert.equal(defaultModelFor('openrouter', cfg), 'nvidia/nemotron-3-ultra-550b-a55b:free');
  assert.equal(defaultModelFor('opencode-zen', cfg), 'deepseek-v4-flash-free');
});
