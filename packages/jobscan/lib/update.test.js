'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { mergeResume } = require('./update');

describe('mergeResume', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('clean merge: local unchanged, remote changed -> takes remote', () => {
    const resumePath = path.join(tmpDir, 'resume.json');
    const basePath = path.join(tmpDir, 'resume.base.json');
    const base = { name: 'Alice', skills: ['js'], summary: 'old', custom: { note: 'keep' } };
    const local = { name: 'Alice', skills: ['js'], summary: 'old', custom: { note: 'keep' } };
    fs.writeFileSync(resumePath, JSON.stringify(local));
    fs.writeFileSync(basePath, JSON.stringify(base));
    const remote = { summary: 'new summary' };
    const res = mergeResume(resumePath, { basePath, remote });
    assert.equal(res.conflict, false);
    const out = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
    assert.equal(out.summary, 'new summary');
    assert.deepEqual(out.custom, { note: 'keep' });
  });

  it('preserves custom on no-conflict', () => {
    const resumePath = path.join(tmpDir, 'resume.json');
    const basePath = path.join(tmpDir, 'resume.base.json');
    const base = { name: 'A', skills: ['x'], custom: { a: 1 } };
    const local = { name: 'A', skills: ['x'], custom: { a: 2, b: 3 } };
    fs.writeFileSync(resumePath, JSON.stringify(local));
    fs.writeFileSync(basePath, JSON.stringify(base));
    const res = mergeResume(resumePath, { basePath, remote: { name: 'A' } });
    assert.equal(res.conflict, false);
    const out = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
    assert.deepEqual(out.custom, { a: 2, b: 3 });
  });

  it('conflict writes merge-conflict files and does not overwrite original', () => {
    const resumePath = path.join(tmpDir, 'resume.json');
    const basePath = path.join(tmpDir, 'resume.base.json');
    const base = { name: 'Alice', summary: 'base' };
    const local = { name: 'Alice', summary: 'local edit' };
    const remote = { summary: 'remote edit' };
    fs.writeFileSync(resumePath, JSON.stringify(local));
    fs.writeFileSync(basePath, JSON.stringify(base));
    const before = fs.readFileSync(resumePath, 'utf8');
    const res = mergeResume(resumePath, { basePath, remote });
    assert.equal(res.conflict, true);
    assert.ok(fs.existsSync(`${resumePath}.merge-conflict`));
    assert.ok(fs.existsSync(`${resumePath}.merge-conflict.json`));
    const after = fs.readFileSync(resumePath, 'utf8');
    assert.equal(after, before); // not overwritten
    const marker = fs.readFileSync(`${resumePath}.merge-conflict`, 'utf8');
    assert.match(marker, /<<<<<<< LOCAL/);
  });

  it('no base -> creates base and merges', () => {
    const resumePath = path.join(tmpDir, 'resume.json');
    const basePath = path.join(tmpDir, 'resume.base.json');
    fs.writeFileSync(resumePath, JSON.stringify({ name: 'B', skills: ['y'] }));
    // no base file
    const res = mergeResume(resumePath, { basePath, remote: { skills: ['y'] } });
    assert.equal(res.conflict, false);
    assert.ok(fs.existsSync(basePath));
  });

  it('missing resume throws', () => {
    assert.throws(() => mergeResume(path.join(tmpDir, 'no.json')), /not found/);
  });
});
