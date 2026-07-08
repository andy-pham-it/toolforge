'use strict';

const { describe, it, before, mock } = require('node:test');
const assert = require('node:assert');

const TTSPlugin = require('./plugin');

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const FAKE_AUDIO = Buffer.from('fake-audio-data');

function makeMockPlanner() {
  return {
    plan: mock.fn(async (_script, _title, _opts) => ({
      segments: [
        { id: 1, text: 'Segment one.', voice: 'auto', audioTags: [], pace: 'normal', language: 'vi' },
        { id: 2, text: 'Segment two.', voice: 'Charon', audioTags: ['calm'], pace: 'normal', language: 'vi' },
      ],
      metadata: { languages: ['vi'], duration: 30 },
    })),
    injectTags: mock.fn(async (segments, _script, _opts) =>
      segments.map(s => ({
        ...s,
        audioTags: s.audioTags?.length ? s.audioTags : ['warm'],
        tagsInjected: true,
        originalText: s.text,
        sourceRef: { startChar: 0, endChar: s.text.length },
      }))
    ),
  };
}

function makeMockGenerator() {
  return {
    generateBatch: mock.fn(async (segments, _opts) =>
      segments.map(s => ({
        id: s.id,
        audio: FAKE_AUDIO,
        format: 'wav',
      }))
    ),
    maxRetries: 2,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a small Express app with the TTS router mounted.
 * Uses real express.json() middleware so req.body is populated.
 */
function createTestApp(options = {}) {
  const express = require('express');
  const { toExpressRouter } = require('./adapters/express');

  const orig = process.env.GEMINI_API_KEY;
  if (!orig) process.env.GEMINI_API_KEY = 'test-key';

  const plugin = new TTSPlugin({ tts: { maxRetries: 0 }, ...options });
  plugin.planner = makeMockPlanner();
  plugin.generator = makeMockGenerator();

  const app = express();
  app.use(express.json());
  app.use('/tts', toExpressRouter(plugin));

  if (!orig) delete process.env.GEMINI_API_KEY;

  return app;
}

/**
 * Helper: make a JSON HTTP request to an Express app (in-process).
 */
function request(app, method, path, body = undefined) {
  const http = require('node:http');

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const opts = {
        hostname: '127.0.0.1',
        port,
        path,
        method: method.toUpperCase(),
        headers: { 'content-type': 'application/json' },
      };

      const req = http.request(opts, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          server.close();
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', (err) => { server.close(); reject(err); });

      if (body !== undefined) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

// ---------------------------------------------------------------------------
// TTSPlugin core tests
// ---------------------------------------------------------------------------

describe('TTSPlugin', () => {
  describe('constructor', () => {
    it('should throw if no apiKey and no env var', () => {
      const orig = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      assert.throws(() => new TTSPlugin({}), /apiKey is required/);
      if (orig) process.env.GEMINI_API_KEY = orig;
    });

    it('should fallback to GOOGLE_API_KEY', () => {
      const orig = process.env.GOOGLE_API_KEY;
      process.env.GOOGLE_API_KEY = 'fallback-key';
      const plugin = new TTSPlugin({});
      assert.equal(plugin.config.apiKey, 'fallback-key');
      if (orig) process.env.GOOGLE_API_KEY = orig;
      else delete process.env.GOOGLE_API_KEY;
    });

    it('should accept custom config', () => {
      const orig = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'k';
      const plugin = new TTSPlugin({ segmentDelay: 999, tts: { maxRetries: 0 } });
      assert.equal(plugin.config.segmentDelay, 999);
      if (orig) process.env.GEMINI_API_KEY = orig;
      else delete process.env.GEMINI_API_KEY;
    });
  });

  describe('listVoices()', () => {
    it('should return voice metadata', () => {
      const orig = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'k';
      const plugin = new TTSPlugin({ tts: { maxRetries: 0 } });
      const voices = plugin.listVoices();
      assert.ok(voices.length > 0);
      assert.ok(voices.every(v => v.name && v.style && v.description));
      if (orig) process.env.GEMINI_API_KEY = orig;
      else delete process.env.GEMINI_API_KEY;
    });
  });

  describe('with mocked planner/generator', () => {
    let plugin;
    before(() => {
      const orig = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'k';
      plugin = new TTSPlugin({ tts: { maxRetries: 0 }, segmentDelay: 0 });
      plugin.planner = makeMockPlanner();
      plugin.generator = makeMockGenerator();
      if (orig) process.env.GEMINI_API_KEY = orig;
      else delete process.env.GEMINI_API_KEY;
    });

    it('plan()', async () => {
      const plan = await plugin.plan('Script.', 'Title');
      assert.equal(plan.segments.length, 2);
    });

    it('injectTags() with backend', async () => {
      const segs = [{ id: 1, text: 'Hi.', audioTags: [] }];
      const tagged = await plugin.injectTags(segs, 'Hi.', { backend: 'google-api' });
      assert.ok(tagged[0].tagsInjected);
    });

    it('injectTags() without backend returns segments unchanged', async () => {
      const segs = [{ id: 1, text: 'Hi.', audioTags: [] }];
      const result = await plugin.injectTags(segs, 'Hi.', {});
      assert.strictEqual(result, segs);
    });

    it('generate()', async () => {
      const segs = [{ id: 1, text: 'Hi.', voice: 'Charon', audioTags: [] }];
      const results = await plugin.generate(segs, { segmentDelay: 0 });
      assert.equal(results.length, 1);
      assert.ok(results[0].audio.equals(FAKE_AUDIO));
    });

    it('fullPipeline()', async () => {
      const result = await plugin.fullPipeline('Script.', 'Title', {
        backend: 'google-api', segmentDelay: 0,
      });
      assert.ok(result.segments.length > 0);
      assert.ok(result.segments[0].audio);
      assert.ok(result.metadata);
    });

    it('fullPipeline() continues when injectTags fails', async () => {
      plugin.planner.injectTags = mock.fn(async () => { throw new Error('fail'); });
      const result = await plugin.fullPipeline('Script.', 'Title', {
        backend: 'google-api', segmentDelay: 0,
      });
      assert.ok(result.segments.length > 0);
    });

    it('fullPipeline() single mode', async () => {
      const result = await plugin.fullPipeline('Script.', 'Title', {
        mode: 'single', segmentDelay: 0,
      });
      assert.ok(result.audio);
      assert.equal(result.format, 'wav');
    });
  });
});

// ---------------------------------------------------------------------------
// Express adapter integration tests (require express to be installed)
// ---------------------------------------------------------------------------

describe('Express adapter', () => {
  let expressAvailable;
  before(() => {
    try { require('express'); expressAvailable = true; }
    catch { expressAvailable = false; }
  });

  it('toExpressRouter should serve POST /plan', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp({ segmentDelay: 0 });
    const res = await request(app, 'POST', '/tts/plan', {
      script: 'Test.', title: 'T',
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.segments);
  });

  it('toExpressRouter should serve POST /inject-tags', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp({ segmentDelay: 0 });
    const res = await request(app, 'POST', '/tts/inject-tags', {
      segments: [{ id: 1, text: 'X.', audioTags: [] }],
      script: 'X.',
    });
    assert.equal(res.status, 200);
  });

  it('toExpressRouter should serve POST /generate', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp({ segmentDelay: 0 });
    const res = await request(app, 'POST', '/tts/generate', {
      segments: [{ id: 1, text: 'X.', voice: 'Charon', audioTags: [] }],
    });
    assert.equal(res.status, 200);
  });

  it('toExpressRouter should serve POST /tts (full pipeline)', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp({ segmentDelay: 0 });
    const res = await request(app, 'POST', '/tts/tts', {
      script: 'Test.', title: 'T',
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.segments);
  });

  it('toExpressRouter should serve GET /voices', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp();
    const res = await request(app, 'GET', '/tts/voices');
    assert.equal(res.status, 200);
    assert.ok(res.body.voices);
  });

  it('toExpressRouter should return 400 on missing required fields', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp();
    const res = await request(app, 'POST', '/tts/plan', {});
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('toExpressRouter should handle CORS preflight', async () => {
    if (!expressAvailable) this.skip();
    const app = createTestApp();
    const res = await request(app, 'OPTIONS', '/tts/voices');
    assert.equal(res.status, 204);
  });
});
