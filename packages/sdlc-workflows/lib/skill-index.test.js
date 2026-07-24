'use strict';
const assert = require('node:assert');
const { describe, it } = require('node:test');
const path = require('path');

const { buildIndex, searchSkills } = require('./skill-index');

describe('buildIndex', () => {
  it('should scan skills directory and return array of skill records', () => {
    const skillsDir = path.join(__dirname, '..', 'skills');
    const index = buildIndex(skillsDir);
    assert.ok(Array.isArray(index));
    assert.ok(index.length >= 10); // at least 10 skills
    index.forEach(skill => {
      assert.ok(skill.id);
      assert.ok(skill.name);
      assert.ok(Array.isArray(skill.keywords));
    });
  });
});

describe('searchSkills', () => {
  const sampleIndex = [
    { id: 'sdlc-prd', name: 'PRD Generator', triggers: 'prd, product requirements', keywords: ['product', 'requirements', 'vision', 'features'] },
    { id: 'sdlc-brd', name: 'BRD Generator', triggers: 'brd, business requirements', keywords: ['business', 'requirements', 'stakeholders', 'use cases'] },
    { id: 'sdlc-arch', name: 'Architecture Document Generator', triggers: 'architecture, kiến trúc', keywords: ['architecture', 'system', 'design', 'arc42'] },
  ];

  it('should find skills by keyword match', () => {
    const results = searchSkills(sampleIndex, 'requirements');
    assert.ok(results.length >= 2);
    assert.ok(results[0].score > 0);
  });

  it('should find skills by trigger phrase', () => {
    const results = searchSkills(sampleIndex, 'kiến trúc');
    assert.ok(results.length >= 1);
    assert.strictEqual(results[0].skill.id, 'sdlc-arch');
  });

  it('should limit results', () => {
    const results = searchSkills(sampleIndex, 'requirements', { limit: 1 });
    assert.strictEqual(results.length, 1);
  });

  it('should return empty array for no match', () => {
    const results = searchSkills(sampleIndex, 'zzzznonexistent');
    assert.strictEqual(results.length, 0);
  });
});
