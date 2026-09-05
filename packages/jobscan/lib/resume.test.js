'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseResume, validateResume, normalizeResume } = require('./resume');

describe('resume', () => {
  it('validates example JSON', () => {
    const ex = JSON.parse(fs.readFileSync(path.join(__dirname, '../templates/resume.example.json'), 'utf8'));
    assert.doesNotThrow(() => validateResume(ex));
    const norm = normalizeResume(ex);
    assert.equal(norm.name, 'John Doe');
    assert.ok(norm.skills.length > 0);
  });

  it('rejects missing name', () => {
    assert.throws(() => validateResume({ skills: ['JS'] }), /name/);
  });

  it('rejects missing skills', () => {
    assert.throws(() => validateResume({ name: 'A' }), /skills/);
    assert.throws(() => validateResume({ name: 'A', skills: [] }), /skills/);
  });

  it('rejects invalid email', () => {
    assert.throws(() => validateResume({ name: 'A', skills: ['x'], contact: { email: 'bad' } }), /email/);
  });

  it('rejects bad dates', () => {
    assert.throws(() => validateResume({ name: 'A', skills: ['x'], experience: [{ company: 'C', startDate: '2020/01' }] }), /startDate/);
    assert.throws(() => validateResume({ name: 'A', skills: ['x'], experience: [{ company: 'C', endDate: 'bad' }] }), /endDate/);
  });

  it('parseResume handles .json', () => {
    const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ name: 'Test', skills: ['Node'], contact: { email: 'a@b.com' } }));
    const r = parseResume(tmp);
    assert.equal(r.name, 'Test');
    fs.unlinkSync(tmp);
  });

  it('parseResume handles .md with frontmatter', () => {
    const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.md`);
    fs.writeFileSync(tmp, `---\nname: Md User\nskills: [JS, Python]\n---\nThis is summary body.`);
    const r = parseResume(tmp);
    assert.equal(r.name, 'Md User');
    assert.ok(r.skills.includes('JS'));
    assert.ok(r.summary.includes('summary'));
    fs.unlinkSync(tmp);
  });

  it('parseResume handles .yaml if js-yaml available', () => {
    const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.yaml`);
    fs.writeFileSync(tmp, `name: Yaml User\nskills:\n  - JS\n  - Go\n`);
    try {
      const r = parseResume(tmp);
      assert.equal(r.name, 'Yaml User');
    } catch (e) {
      assert.match(e.message, /js-yaml/);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('parseResume throws on invalid JSON', () => {
    const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.json`);
    fs.writeFileSync(tmp, `{ bad json`);
    assert.throws(() => parseResume(tmp), /JSON/);
    fs.unlinkSync(tmp);
  });

  it('parseResume throws on unsupported ext', () => {
    const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.txt`);
    fs.writeFileSync(tmp, `hello`);
    assert.throws(() => parseResume(tmp), /Unsupported/);
    fs.unlinkSync(tmp);
  });

  it('parseResume throws on missing required field', () => {
    const tmp = path.join(os.tmpdir(), `resume-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ name: 'NoSkills' }));
    assert.throws(() => parseResume(tmp), /skills/);
    fs.unlinkSync(tmp);
  });

  it('normalize trims and preserves custom', () => {
    const n = normalizeResume({ name: '  Bob  ', skills: ['  JS ', ''], custom: { foo: 1 } });
    assert.equal(n.name, 'Bob');
    assert.deepEqual(n.skills, ['JS']);
    assert.equal(n.custom.foo, 1);
  });
});
