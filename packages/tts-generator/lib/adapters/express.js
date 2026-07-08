'use strict';

/**
 * Express adapter for TTSPlugin.
 *
 * Uses dynamic require() so `express` is loaded only when this file is
 * imported — projects that only use the core TTSPlugin class don't pay
 * the Express dependency cost.
 */

let express;
try {
  express = require('express');
} catch (e) {
  // express not installed — will throw when toExpressRouter() is called
}

const TTSPlugin = require('../plugin');

/**
 * Create an Express Router mounting TTS endpoints.
 *
 * @param {TTSPlugin} plugin - Configured TTSPlugin instance
 * @param {object} [options]
 * @param {function} [options.auth] - Optional Express auth middleware (runs before all routes)
 * @param {boolean} [options.cors=true] - Enable CORS headers
 * @returns {import('express').Router}
 *
 * @example
 * const TTSPlugin = require('@andy-toolforge/tts-generator/lib/plugin');
 * const { toExpressRouter } = require('@andy-toolforge/tts-generator/lib/adapters/express');
 *
 * const plugin = new TTSPlugin({ apiKey: process.env.GEMINI_API_KEY });
 * const router = toExpressRouter(plugin);
 * app.use('/api', router);
 */
function toExpressRouter(plugin, options = {}) {
  if (!express) {
    throw new Error(
      'toExpressRouter: "express" is not installed. Run: npm install express'
    );
  }

  if (!(plugin instanceof TTSPlugin)) {
    throw new Error('toExpressRouter: first argument must be a TTSPlugin instance');
  }

  const router = express.Router();

  // CORS
  if (options.cors !== false) {
    router.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  // Optional auth middleware
  if (typeof options.auth === 'function') {
    router.use(options.auth);
  }

  // POST /plan — segment a script
  router.post('/plan', async (req, res) => {
    try {
      const { script, title, voice, language, pace } = req.body || {};
      if (!script || !title) {
        return res.status(400).json({ error: 'script and title are required' });
      }
      const plan = await plugin.plan(script, title, { voice, language, pace });
      res.json(plan);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /inject-tags — inject AI-reasoned audio tags
  router.post('/inject-tags', async (req, res) => {
    try {
      const { segments, script, backend, stylePrompt } = req.body || {};
      if (!segments || !script) {
        return res.status(400).json({ error: 'segments and script are required' });
      }
      const tagged = await plugin.injectTags(segments, script, { backend, stylePrompt });
      res.json({ segments: tagged });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /generate — generate audio from segments
  router.post('/generate', async (req, res) => {
    try {
      const { segments, segmentDelay } = req.body || {};
      if (!segments) {
        return res.status(400).json({ error: 'segments are required' });
      }
      const results = await plugin.generate(segments, { segmentDelay });
      res.json({
        segments: results.map(r => ({
          id: r.id,
          audio: r.audio ? r.audio.toString('base64') : null,
          format: r.format || null,
          error: r.error || null,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /tts — full pipeline (plan → inject-tags → generate)
  router.post('/tts', async (req, res) => {
    try {
      const {
        script, title, voice, language, pace,
        backend, stylePrompt, segmentDelay, mode, tags,
      } = req.body || {};

      if (!script || !title) {
        return res.status(400).json({ error: 'script and title are required' });
      }

      const result = await plugin.fullPipeline(script, title, {
        voice,
        language,
        pace,
        backend,
        stylePrompt,
        segmentDelay,
        mode: mode || 'batch',
        audioTags: tags
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : undefined,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /voices — list available voices
  router.get('/voices', (_req, res) => {
    res.json({ voices: plugin.listVoices() });
  });

  return router;
}

module.exports = { toExpressRouter };
