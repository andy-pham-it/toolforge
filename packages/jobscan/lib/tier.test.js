'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tierCheck, serialize, PRO_FIELDS } = require('./tier');

describe('tierCheck', () => {
  it('null -> free', () => assert.equal(tierCheck(null), 'free'));
  it('undefined -> free', () => assert.equal(tierCheck(undefined), 'free'));
  it('free license -> free', () => assert.equal(tierCheck({ tier: 'free' }), 'free'));
  it('pro license -> pro', () => assert.equal(tierCheck({ tier: 'pro' }), 'pro'));
  it('expired within 7 days grace -> pro', () => {
    const lic = { tier: 'pro', expiresAt: new Date(Date.now() - 3*24*60*60*1000).toISOString() };
    assert.equal(tierCheck(lic), 'pro');
  });
  it('expired 8 days ago -> free', () => {
    const lic = { tier: 'pro', expiresAt: new Date(Date.now() - 8*24*60*60*1000).toISOString() };
    assert.equal(tierCheck(lic), 'free');
  });
});

describe('serialize tier gating', () => {
  const result = {
    score: 80,
    matchedKeywords: ['js'],
    missingKeywords: ['python'],
    suggestions: ['add python'],
    provider: 'greenhouse',
    url: 'https://example.com',
    fetchedAt: new Date().toISOString(),
    jobTitle: 'Engineer',
    llmSuggestions: ['use STAR'],
    tailoredBullets: [' Built X with Y '],
    coverLetterHint: 'Mention Z'
  };

  it('free serialize never includes pro keys', () => {
    const out = serialize(result, 'free');
    for (const k of PRO_FIELDS) assert.equal(k in out, false, `should not have ${k}`);
    assert.ok('score' in out);
    assert.ok('matchedKeywords' in out);
  });

  it('free via license object also strips', () => {
    const out = serialize(result, { tier: 'free' });
    assert.equal('tailoredBullets' in out, false);
  });

  it('pro serialize keeps pro keys', () => {
    const out = serialize(result, 'pro');
    assert.deepEqual(out.tailoredBullets, result.tailoredBullets);
    assert.deepEqual(out.llmSuggestions, result.llmSuggestions);
    assert.equal(out.coverLetterHint, result.coverLetterHint);
  });

  it('pro via license object keeps', () => {
    const out = serialize(result, { tier: 'pro', expiresAt: new Date(Date.now() + 86400000).toISOString() });
    assert.ok('tailoredBullets' in out);
  });

  it('throws on null result', () => {
    assert.throws(() => serialize(null, 'free'), /result is required/);
  });
});
