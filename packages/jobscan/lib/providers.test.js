'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const greenhouse = require('./providers/greenhouse');
const lever = require('./providers/lever');
const ashby = require('./providers/ashby');
const { getProvider, listProviders } = require('./providers');
const { scanWithProvider } = require('./scanner');

function robotsOkMock() {
  return async (url) => {
    if (url.includes('robots.txt')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
    throw new Error('unexpected url ' + url);
  };
}

describe('providers registry', () => {
  it('lists 3 providers', () => {
    assert.deepEqual(listProviders().sort(), ['ashby','greenhouse','lever']);
  });
  it('getProvider throws on unknown', () => {
    assert.throws(() => getProvider('unknown'), /Unknown provider/);
  });
  it('getProvider case-insensitive', () => {
    assert.ok(getProvider('GreenHouse'));
  });
});

describe('greenhouse parseJob', () => {
  it('maps raw to normalized', () => {
    const j = greenhouse.parseJob({ id: 5, title: 'Eng', absolute_url: 'https://x', content: 'desc', location: { name: 'NYC' } });
    assert.equal(j.id, '5'); assert.equal(j.title, 'Eng'); assert.equal(j.url, 'https://x');
  });
});

describe('lever parseJob', () => {
  it('maps', () => {
    const j = lever.parseJob({ id: 'a', text: 'Designer', hostedUrl: 'https://y', description: 'hi', categories: { location: 'SF' } });
    assert.equal(j.title, 'Designer'); assert.equal(j.location, 'SF');
  });
});

describe('ashby parseJob', () => {
  it('maps', () => {
    const j = ashby.parseJob({ id: 'b', title: 'PM', jobUrl: 'https://z', descriptionHtml: '<p>hi</p>' });
    assert.equal(j.id, 'b'); assert.equal(j.url, 'https://z');
  });
});

describe('fetchJobs with mocked fetch', () => {
  beforeEach(() => { greenhouse.resetRateLimit(); lever.resetRateLimit(); ashby.resetRateLimit(); });

  it('greenhouse happy', async () => {
    const mock = async (url) => {
      if (url.includes('robots.txt')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [{ id: 1, title: 'A', absolute_url: 'https://a', content: 'JS', location: { name: 'NYC' } }] }) };
    };
    const jobs = await greenhouse.fetchJobs({ companySlug: 'datadog', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1); assert.equal(jobs[0].title, 'A');
  });

  it('greenhouse retries on 429', async () => {
    let call = 0;
    const mock = async (url) => {
      if (url.includes('robots.txt')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
      call++;
      if (call === 1) return { ok: false, status: 429, statusText: 'Too Many', headers: { get: () => '0' }, text: async () => '' };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [{ id: 2, title: 'B', absolute_url: 'https://b', content: 'x', location: { name: '' } }] }) };
    };
    const jobs = await greenhouse.fetchJobs({ companySlug: 'testco', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1);
  });

  it('greenhouse 404 throws', async () => {
    const mock = async (url) => {
      if (url.includes('robots.txt')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
      return { ok: false, status: 404, statusText: 'Not Found', headers: { get: () => null }, text: async () => '' };
    };
    await assert.rejects(() => greenhouse.fetchJobs({ companySlug: 'nope', fetchFn: mock }), /not found/i);
  });

  it('lever happy array', async () => {
    const mock = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ([{ id: '1', text: 'Eng', hostedUrl: 'https://y', description: 'desc', categories: { location: 'SF' } }]) });
    const jobs = await lever.fetchJobs({ companySlug: 'leverco', limit: 1, fetchFn: mock });
    assert.equal(jobs[0].title, 'Eng');
  });

  it('ashby happy jobs wrapper', async () => {
    const mock = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [{ id: '1', title: 'PM', jobUrl: 'https://z', descriptionHtml: 'hi' }] }) });
    const jobs = await ashby.fetchJobs({ companySlug: 'ashbyco', limit: 1, fetchFn: mock });
    assert.equal(jobs[0].title, 'PM');
  });

  it('scanWithProvider orchestrates fetch -> matcher', async () => {
    const mock = async (url) => {
      if (url.includes('robots.txt')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [{ id: 1, title: 'JS Eng', absolute_url: 'https://a', content: 'Need JS React', location: { name: 'NYC' } }] }) };
    };
    const resume = { name: 'Alice', skills: ['JS'], summary: '', experience: [] };
    const results = await scanWithProvider({ provider: 'greenhouse', companySlug: 'testco', resume, limit: 1, fetchFn: mock });
    assert.equal(results.length, 1);
    assert.equal(results[0].provider, 'greenhouse');
    assert.ok(typeof results[0].score === 'number');
  });
});
