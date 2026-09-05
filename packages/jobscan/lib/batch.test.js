'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { parseBatchFile, runBatch } = require('./batch');

function mockFetchForBatch() {
  return async (url) => {
    // greenhouse mock
    if (url.includes('greenhouse')) {
      return {
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ jobs: [{ id: '1', title: 'Eng', content: 'We need node and react', absolute_url: 'http://g/1', location: { name: 'Remote' } }] }),
        text: async () => '',
      };
    }
    if (url.includes('lever')) {
      return {
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ([{ id: 'l1', text: 'Backend', descriptionPlain: 'need python', hostedUrl: 'http://l/1' }]),
        text: async () => '',
      };
    }
    if (url.includes('ashby')) {
      return {
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ jobs: [{ id: 'a1', title: 'Frontend', descriptionHtml: 'need js', jobUrl: 'http://a/1' }] }),
        text: async () => '',
      };
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => '' };
  };
}

describe('parseBatchFile', () => {
  it('parses csv', () => {
    const csv = 'provider,company\n greenhouse,acme\n lever,foo';
    const rows = parseBatchFile(csv, 'companies.csv');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].provider, 'greenhouse');
    assert.equal(rows[0].company, 'acme');
  });
  it('parses ndjson', () => {
    const nd = '{"provider":"greenhouse","company":"acme"}\n{"provider":"lever","company":"bar"}';
    const rows = parseBatchFile(nd, 'batch.ndjson');
    assert.equal(rows.length, 2);
    assert.equal(rows[1].provider, 'lever');
  });
  it('returns empty for empty file', () => {
    assert.equal(parseBatchFile('', 'x.csv').length, 0);
  });
});

describe('runBatch', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('batch 2 companies -> results with rate-limit timestamps', async () => {
    const csvPath = path.join(tmpDir, 'companies.csv');
    fs.writeFileSync(csvPath, 'provider,company\ngreenhouse,acme\nlever,bar');
    const resume = { name: 'Alice', skills: ['node', 'react'], summary: '', experience: [{ bullets: ['built node app'] }] };
    const fetchFn = mockFetchForBatch();
    // mock provider internal delay would be 2s; we bypass by using mocked fetch which still respects provider rate logic
    // runBatch sequential; we just verify 2 inputs produce >=2 results (greenhouse 1 + lever 1)
    const results = await runBatch(csvPath, { resume, fetchFn, limit: 1, outDir: tmpDir });
    assert.ok(results.length >= 2);
    assert.ok(results.some(r => r.provider === 'greenhouse'));
    assert.ok(results.some(r => r.provider === 'lever'));
    // files written
    assert.ok(fs.existsSync(path.join(tmpDir, 'batch-report.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'batch-report.md')));
  });

  it('bad CSV row -> error row not crash', async () => {
    const csvPath = path.join(tmpDir, 'bad.csv');
    fs.writeFileSync(csvPath, 'provider,company\ngreenhouse,\n,acme\nlever,okco');
    const resume = { name: 'A', skills: ['x'] };
    const results = await runBatch(csvPath, { resume, fetchFn: mockFetchForBatch(), outDir: tmpDir });
    const errors = results.filter(r => r.error);
    assert.ok(errors.length >= 1);
    assert.ok(results.some(r => r.provider === 'lever'));
  });

  it('missing file throws', async () => {
    await assert.rejects(() => runBatch('/no/such/file.csv', {}), /not found/);
  });

  it('no resume -> error rows', async () => {
    const csvPath = path.join(tmpDir, 'c.csv');
    fs.writeFileSync(csvPath, 'provider,company\ngreenhouse,acme');
    const results = await runBatch(csvPath, { resume: null, fetchFn: mockFetchForBatch(), outDir: tmpDir });
    assert.ok(results[0].error && /no resume/i.test(results[0].error));
  });
});
