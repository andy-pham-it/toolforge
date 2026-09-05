'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  inferProvider, parseCompaniesUrl, initConfig, loadConfig, addCompany, resolveEntry,
} = require('./companies');

describe('inferProvider', () => {
  const cases = [
    ['https://boards.greenhouse.io/datadog', 'greenhouse', 'datadog'],
    ['https://boards.greenhouse.io/datadog/jobs/123', 'greenhouse', 'datadog'],
    ['https://datadog.greenhouse.io/', 'greenhouse', 'datadog'],
    ['https://jobs.lever.co/lever', 'lever', 'lever'],
    ['https://jobs.lever.co/lever/abc-123', 'lever', 'lever'],
    ['https://lever.co/lever', 'lever', 'lever'],
    ['https://jobs.ashbyhq.com/ashby', 'ashby', 'ashby'],
    ['https://careers.smartrecruiters.com/BoschGroup/x', 'smartrecruiters', 'BoschGroup'],
    ['https://huggingface.workable.com/', 'workable', 'huggingface'],
    ['https://vandebron.recruitee.com/', 'recruitee', 'vandebron'],
    ['https://workwithus.pinpointhq.com/', 'pinpoint', 'workwithus'],
    ['https://personio.jobs.personio.de/', 'personio', 'personio'],
    ['https://remoteok.com/', 'remoteok', 'all'],
    ['boards.greenhouse.io/datadog', 'greenhouse', 'datadog'], // no scheme
    ['https://job-boards.greenhouse.io/openai', 'greenhouse', 'openai'],
    ['https://job-boards.eu.greenhouse.io/spotify', 'greenhouse', 'spotify'],
    ['https://jobs.eu.lever.co/someeu', 'lever', 'someeu'],
    ['https://jobs.smartrecruiters.com/BoschGroup/1', 'smartrecruiters', 'BoschGroup'],
    ['https://acme.jobs.personio.com/', 'personio', 'acme'],
  ];
  for (const [url, provider, slug] of cases) {
    it(`${url} → ${provider}:${slug}`, () => {
      assert.deepStrictEqual(inferProvider(url), { provider, companySlug: slug });
    });
  }
  it('unknown ATS → null', () => {
    assert.strictEqual(inferProvider('https://careers.example.com/jobs'), null);
    assert.strictEqual(inferProvider('https://boards.greenhouse.io/'), null);
    assert.strictEqual(inferProvider('not a url at all!!!'), null);
    assert.strictEqual(inferProvider(''), null);
  });
  it('SmartRecruiters case preserved', () => {
    assert.strictEqual(inferProvider('https://careers.smartrecruiters.com/Equinox/x').companySlug, 'Equinox');
  });
});

describe('parseCompaniesUrl', () => {
  it('throws friendly error for unknown URL', () => {
    assert.throws(() => parseCompaniesUrl('https://careers.example.com'), /remoteok/);
  });
});

describe('config roundtrip (tmp dir)', () => {
  function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'jobscan-'));
  }
  it('init → load → add → load', () => {
    const dir = tmpdir();
    const p = initConfig(dir);
    assert.ok(fs.existsSync(p));
    assert.throws(() => initConfig(dir), /Đã có/);
    let cfg = loadConfig(dir);
    assert.ok(Array.isArray(cfg.companies) && cfg.companies.length >= 1);
    const { inferred } = addCompany('https://jobs.lever.co/lever', dir);
    assert.deepStrictEqual(inferred, { provider: 'lever', companySlug: 'lever' });
    cfg = loadConfig(dir);
    assert.ok(cfg.companies.some((c) => c.url === 'https://jobs.lever.co/lever'));
    // unknown ATS still saved, inferred null
    const r2 = addCompany('https://careers.example.com/jobs', dir);
    assert.strictEqual(r2.inferred, null);
    // dedupe
    addCompany('https://jobs.lever.co/lever', dir);
    cfg = loadConfig(dir);
    assert.strictEqual(cfg.companies.filter((c) => c.url === 'https://jobs.lever.co/lever').length, 1);
  });
  it('loadConfig missing → null', () => {
    assert.strictEqual(loadConfig(tmpdir()), null);
  });
});

describe('resolveEntry', () => {
  it('{url} → inferred', () => {
    assert.deepStrictEqual(resolveEntry({ url: 'https://boards.greenhouse.io/datadog' }),
      { provider: 'greenhouse', companySlug: 'datadog', label: 'https://boards.greenhouse.io/datadog' });
  });
  it('{provider, company} passthrough', () => {
    assert.deepStrictEqual(resolveEntry({ provider: 'lever', company: 'lever' }),
      { provider: 'lever', companySlug: 'lever', label: 'lever:lever' });
  });
  it('unknown url → null', () => {
    assert.strictEqual(resolveEntry({ url: 'https://careers.example.com' }), null);
    assert.strictEqual(resolveEntry({}), null);
  });
});
