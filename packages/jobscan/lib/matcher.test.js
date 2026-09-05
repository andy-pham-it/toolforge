'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { heuristicMatch } = require('./matcher');

describe('matcher heuristicMatch', () => {
  const resume = {
    name: 'Ada',
    skills: ['JavaScript', 'Node.js', 'React', 'PostgreSQL'],
    summary: 'Fullstack JS dev with React and Node',
    experience: [{ role: 'Dev', company: 'Acme', bullets: ['Built React apps with TypeScript'] }],
    custom: {}
  };

  it('perfect match -> high score', () => {
    const jd = 'We need JavaScript React Node.js PostgreSQL';
    const r = heuristicMatch(resume, jd);
    assert.ok(r.score >= 75, `score ${r.score} should be high`);
    assert.equal(r.missingKeywords.length, 0);
    assert.ok(r.matchedKeywords.length > 0);
  });

  it('mismatched JD -> missingKeywords non-empty and lower score', () => {
    const jd = 'We need Python Django Kubernetes Golang Rust AWS Terraform';
    const r = heuristicMatch(resume, jd);
    assert.ok(r.missingKeywords.length > 0);
    assert.ok(r.score < 50);
  });

  it('deterministic: same input same score', () => {
    const jd = 'JavaScript React Node';
    const a = heuristicMatch(resume, jd);
    const b = heuristicMatch(resume, jd);
    assert.deepEqual(a, b);
  });

  it('throws on empty JD', () => {
    assert.throws(() => heuristicMatch(resume, ''), /jobDescription/);
    assert.throws(() => heuristicMatch(resume, '   '), /jobDescription/);
    assert.throws(() => heuristicMatch(resume, null), /jobDescription/);
  });

  it('throws on missing resume skills', () => {
    assert.throws(() => heuristicMatch({ name: 'x', skills: [] }, 'javascript'), /skills/);
    assert.throws(() => heuristicMatch(null, 'javascript'), /resume/);
  });

  it('throws on JD with only stopwords', () => {
    assert.throws(() => heuristicMatch(resume, 'the and or in on'), /no indexable/);
  });
});
