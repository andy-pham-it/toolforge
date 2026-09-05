'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const greenhouse = require('./providers/greenhouse');
const lever = require('./providers/lever');
const ashby = require('./providers/ashby');
const smartrecruiters = require('./providers/smartrecruiters');
const workable = require('./providers/workable');
const recruitee = require('./providers/recruitee');
const pinpoint = require('./providers/pinpoint');
const personio = require('./providers/personio');
const remoteok = require('./providers/remoteok');
const { getProvider, listProviders } = require('./providers');
const { scanWithProvider } = require('./scanner');

function robotsOkMock() {
  return async (url) => {
    if (url.includes('robots.txt')) return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' };
    throw new Error('unexpected url ' + url);
  };
}

describe('providers registry', () => {
  it('lists 9 providers', () => {
    assert.deepEqual(listProviders().sort(), ['ashby','greenhouse','lever','personio','pinpoint','recruitee','remoteok','smartrecruiters','workable']);
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

describe('smartrecruiters parseJob', () => {
  it('merges jobAd sections into description', () => {
    const j = smartrecruiters.parseJob({
      id: 'sr-1', name: 'Backend Eng',
      jobAd: { postingUrl: 'https://jobs.smartrecruiters.com/X/1', sections: { jobDescription: '<p>Need JS</p>', qualifications: '<p>3yrs</p>' } },
      location: { city: 'Berlin', country: 'Germany' },
    });
    assert.equal(j.id, 'sr-1'); assert.equal(j.title, 'Backend Eng');
    assert.equal(j.url, 'https://jobs.smartrecruiters.com/X/1');
    assert.ok(j.description.includes('Need JS') && j.description.includes('3yrs'));
    assert.equal(j.location, 'Berlin, Germany');
  });
});

describe('workable parseJob', () => {
  it('maps widget fields', () => {
    const j = workable.parseJob({ shortcode: 'W1', title: 'Designer', url: 'https://apply.workable.com/x/j/W1/', description: '<p>hi</p>', location: { city: 'SF', country: 'USA' } });
    assert.equal(j.id, 'W1'); assert.equal(j.title, 'Designer'); assert.equal(j.location, 'SF, USA');
  });
});

describe('recruitee parseJob', () => {
  it('maps offers fields', () => {
    const j = recruitee.parseJob({ id: 42, title: 'PM', careers_url: 'https://x.recruitee.com/o/pm', description: '<p>lead</p>', location: 'Amsterdam' });
    assert.equal(j.id, '42'); assert.equal(j.url, 'https://x.recruitee.com/o/pm'); assert.equal(j.location, 'Amsterdam');
  });
});

describe('pinpoint parseJob', () => {
  it('maps data fields, builds url from path', () => {
    const j = pinpoint.parseJob({ id: 101, title: 'Backend', url: '', path: '/en/postings/101', description: '<p>JS</p>', location: 'London (Hybrid)', _host: 'workwithus' });
    assert.equal(j.id, '101'); assert.equal(j.title, 'Backend');
    assert.equal(j.url, 'https://workwithus.pinpointhq.com/en/postings/101');
    assert.equal(j.location, 'London (Hybrid)');
  });
});

describe('personio parseFeed', () => {
  const XML = `<workzag-jobs><position><id>1822573</id><office>Berlin</office><department>Engineering</department><subcompany>X GmbH</subcompany><employmentType>full-time</employmentType><name><![CDATA[Backend Engineer]]></name><jobDescriptions><jobDescription><name><![CDATA[Your tasks]]></name><value><![CDATA[<p>Build APIs</p>]]></value></jobDescription><jobDescription><name><![CDATA[Your profile]]></name><value><![CDATA[<p>3y Node</p>]]></value></jobDescription></jobDescriptions></position></workzag-jobs>`;
  it('parses positions with sections', () => {
    const jobs = personio.parseFeed(XML, 'demo');
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, '1822573');
    assert.equal(jobs[0].title, 'Backend Engineer');
    assert.equal(jobs[0].url, 'https://demo.jobs.personio.de/job/1822573?display=en');
    assert.ok(jobs[0].description.includes('Build APIs') && jobs[0].description.includes('3y Node'));
    assert.equal(jobs[0].location, 'Berlin — Engineering');
  });
  it('skips empty positions', () => {
    assert.deepEqual(personio.parseFeed('<workzag-jobs></workzag-jobs>', 'demo'), []);
  });
});

describe('remoteok parseJob', () => {
  it('maps position title to normalized job', async () => {
    const j = remoteok.parseJob({ id: 'r1', company: 'Acme', position: 'Go Dev', url: 'https://remoteok.com/x', description: '<p>Go</p>', location: 'Remote' });
    assert.equal(j.id, 'r1'); assert.equal(j.title, 'Go Dev'); assert.equal(j.location, 'Remote');
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
  beforeEach(() => { greenhouse.resetRateLimit(); lever.resetRateLimit(); ashby.resetRateLimit(); smartrecruiters.resetRateLimit(); workable.resetRateLimit(); recruitee.resetRateLimit(); pinpoint.resetRateLimit(); personio.resetRateLimit(); remoteok.resetRateLimit(); });

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

  it('smartrecruiters list + detail (N+1)', async () => {
    const mock = async (url) => {
      if (url.includes('/postings/') && !url.includes('offset=')) {
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobAd: { postingUrl: 'https://jobs.smartrecruiters.com/X/1', sections: { jobDescription: 'Need JS React' } }, location: { city: 'Berlin' } }) };
      }
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ content: [{ id: '1', name: 'JS Eng', location: { city: 'Berlin' } }], totalFound: 1 }) };
    };
    const jobs = await smartrecruiters.fetchJobs({ companySlug: 'TestCo', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, 'JS Eng');
    assert.ok(jobs[0].description.includes('Need JS'));
  });

  it('smartrecruiters tolerates detail failure', async () => {
    const mock = async (url) => {
      if (url.includes('/postings/') && !url.includes('offset=')) {
        return { ok: false, status: 500, statusText: 'err', headers: { get: () => null } };
      }
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ content: [{ id: '1', name: 'JS Eng', location: { city: 'Berlin' } }], totalFound: 1 }) };
    };
    const jobs = await smartrecruiters.fetchJobs({ companySlug: 'TestCo', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1); assert.equal(jobs[0].title, 'JS Eng');
  });

  it('smartrecruiters 404 throws', async () => {
    const mock = async () => ({ ok: false, status: 404, statusText: 'Not Found', headers: { get: () => null } });
    await assert.rejects(() => smartrecruiters.fetchJobs({ companySlug: 'nope', fetchFn: mock }), /not found/i);
  });

  it('workable happy', async () => {
    const mock = async (url) => {
      assert.ok(url.includes('details=true'));
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [{ shortcode: 'W1', title: 'Eng', url: 'https://u', description: 'JS role', location: { city: 'SF' } }] }) };
    };
    const jobs = await workable.fetchJobs({ companySlug: 'huggingface', limit: 1, fetchFn: mock });
    assert.equal(jobs[0].title, 'Eng'); assert.equal(jobs[0].id, 'W1');
  });

  it('recruitee happy bare array', async () => {
    const mock = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ([{ id: 7, title: 'PM', careers_url: 'https://c', description: 'lead team', location: 'Amsterdam' }]) });
    const jobs = await recruitee.fetchJobs({ companySlug: 'vandebron', limit: 1, fetchFn: mock });
    assert.equal(jobs[0].title, 'PM'); assert.equal(jobs[0].id, '7');
  });

  it('recruitee accepts offers wrapper', async () => {
    const mock = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ offers: [{ id: 8, title: 'Dev', careers_url: 'https://d', description: 'x', location: '' }] }) });
    const jobs = await recruitee.fetchJobs({ companySlug: 'x', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1);
  });

  it('pinpoint happy data wrapper', async () => {
    const mock = async (url) => {
      assert.ok(url.includes('.pinpointhq.com/postings.json'));
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: [{ id: 101, title: 'Backend', url: 'https://w/x', description: 'Need JS', location: 'London' }] }) };
    };
    const jobs = await pinpoint.fetchJobs({ companySlug: 'workwithus', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1); assert.equal(jobs[0].title, 'Backend'); assert.equal(jobs[0].id, '101');
  });

  it('pinpoint 404 throws', async () => {
    const mock = async () => ({ ok: false, status: 404, statusText: 'Not Found', headers: { get: () => null } });
    await assert.rejects(() => pinpoint.fetchJobs({ companySlug: 'nope', fetchFn: mock }), /not found/i);
  });

  it('personio happy xml', async () => {
    const XML = '<workzag-jobs><position><id>9</id><office>Berlin</office><department>Eng</department><name><![CDATA[Dev]]></name><jobDescriptions><jobDescription><name><![CDATA[Tasks]]></name><value><![CDATA[<p>Code</p>]]></value></jobDescription></jobDescriptions></position></workzag-jobs>';
    const mock = async (url) => {
      assert.ok(url.includes('.jobs.personio.de/xml'));
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => XML };
    };
    const jobs = await personio.fetchJobs({ companySlug: 'demo', limit: 1, fetchFn: mock });
    assert.equal(jobs.length, 1); assert.equal(jobs[0].title, 'Dev');
    assert.ok(jobs[0].description.includes('Code'));
  });

  it('personio 404 throws', async () => {
    const mock = async () => ({ ok: false, status: 404, statusText: 'Not Found', headers: { get: () => null } });
    await assert.rejects(() => personio.fetchJobs({ companySlug: 'nope', fetchFn: mock }), /not found/i);
  });

  it('remoteok skips legal header + filters by company', async () => {
    const mock = async (url) => {
      assert.equal(url, 'https://remoteok.com/api');
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ([
        { legal: 'notice' },
        { id: 'a1', company: 'Acme', position: 'Go Dev', url: 'https://u1', description: 'Need Go', location: 'Remote' },
        { id: 'b2', company: 'Other', position: 'Designer', url: 'https://u2', description: 'Figma', location: 'Remote' },
      ]) };
    };
    const filtered = await remoteok.fetchJobs({ companySlug: 'acme', limit: 5, fetchFn: mock });
    assert.equal(filtered.length, 1); assert.equal(filtered[0].title, 'Go Dev');
    remoteok.resetRateLimit();
    const all = await remoteok.fetchJobs({ companySlug: 'all', limit: 5, fetchFn: mock });
    assert.equal(all.length, 2);
  });

  it('scanWithProvider orchestrates fetch -> matcher (greenhouse)', async () => {
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

  it('scanWithProvider works with workable', async () => {
    const mock = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ jobs: [{ shortcode: 'W1', title: 'JS Eng', url: 'https://u', description: 'Need JS React', location: { city: 'SF' } }] }) });
    const resume = { name: 'Alice', skills: ['JS'], summary: '', experience: [] };
    const results = await scanWithProvider({ provider: 'workable', companySlug: 'testco', resume, limit: 1, fetchFn: mock });
    assert.equal(results.length, 1);
    assert.equal(results[0].provider, 'workable');
    assert.ok(typeof results[0].score === 'number');
  });
});
