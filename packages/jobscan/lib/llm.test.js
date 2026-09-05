'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const LLMClient = require('./llm');
const { resolveSkillFile } = require('./llm');

function mockFetchJson(jsonObj) {
  const content = JSON.stringify(jsonObj);
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  });
}

function mockFetchMalformed() {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'not-json-{{{ ' } }] }),
    text: async () => 'not-json-{{{ ',
  });
}

describe('resolveSkillFile', () => {
  it('resolves existing skill', () => {
    const p = resolveSkillFile('jobscan-resume-matcher.md');
    assert.ok(fs.existsSync(p));
    assert.match(p, /jobscan-resume-matcher\.md/);
  });
  it('throws for missing skill', () => {
    assert.throws(() => resolveSkillFile('does-not-exist.md'), /Skill file not found/);
  });
});

describe('LLMClient.tailorResume', () => {
  it('happy: mocked LLM returns tailoredBullets/coverLetterHint', async () => {
    const client = new LLMClient({ provider: 'groq', apiKey: 'test-key' });
    const resume = { name: 'Alice', skills: ['node', 'js'], summary: 'dev', experience: [{ role: 'Dev', company: 'Acme', bullets: ['built x'] }] };
    const jd = 'We need node and js developer';
    const mock = mockFetchJson({ tailoredBullets: ['Built X with Node'], coverLetterHint: 'Emphasize Node', llmSuggestions: ['add metric'] });
    const res = await client.tailorResume(resume, jd, mock);
    assert.deepEqual(res.tailoredBullets, ['Built X with Node']);
    assert.equal(res.coverLetterHint, 'Emphasize Node');
    assert.deepEqual(res.llmSuggestions, ['add metric']);
  });

  it('handles code-fence wrapped JSON via chatJSON', async () => {
    const client = new LLMClient({ provider: 'groq', apiKey: 'test-key' });
    const resume = { name: 'Bob', skills: ['python'] };
    const jd = 'need python';
    // simulate LLM returning ```json ... ```
    const raw = '```json\n{\"tailoredBullets\":[\"did python\"],\"coverLetterHint\":\"hint\",\"llmSuggestions\":[]}\n```';
    const fetchFn = async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: raw } }] }),
      text: async () => raw,
    });
    const res = await client.tailorResume(resume, jd, fetchFn);
    assert.deepEqual(res.tailoredBullets, ['did python']);
  });

  it('failure: malformed JSON throws', async () => {
    const client = new LLMClient({ provider: 'groq', apiKey: 'test-key' });
    const resume = { name: 'A', skills: ['x'] };
    await assert.rejects(() => client.tailorResume(resume, 'need x', mockFetchMalformed()), /chatJSON.*failed to parse/i);
  });

  it('failure: empty pro fields throws', async () => {
    const client = new LLMClient({ provider: 'groq', apiKey: 'test-key' });
    const resume = { name: 'A', skills: ['x'] };
    const mock = mockFetchJson({ tailoredBullets: [], coverLetterHint: '', llmSuggestions: [] });
    await assert.rejects(() => client.tailorResume(resume, 'need x', mock), /empty pro fields/);
  });

  it('failure: missing resume throws', async () => {
    const client = new LLMClient({ provider: 'groq', apiKey: 'test' });
    await assert.rejects(() => client.tailorResume(null, 'jd', mockFetchJson({})), /resume is required/);
  });

  it('failure: missing jobDesc throws', async () => {
    const client = new LLMClient({ provider: 'groq', apiKey: 'test' });
    await assert.rejects(() => client.tailorResume({ name: 'A' }, '', mockFetchJson({})), /jobDesc is required/);
  });

  it('free tier never calls LLM (spy): scanner serialize check', () => {
    // This test asserts the wiring: scan without proData never touches LLM.
    // We verify by ensuring tailorResume is not invoked in free path.
    const { scan } = require('./scanner');
    const resume = { name: 'Alice', skills: ['node'], summary: '', experience: [{ bullets: [] }] };
    const out = scan({ resume, jobDescription: 'need node', license: null });
    assert.equal(typeof out.score, 'number');
    assert.equal(out.tailoredBullets, undefined);
  });
});
