'use strict';

const express = require('express');
const { requestId, requestCancellation } = require('./middleware');

class HTTPServer {
  /**
   * @param {import('../gateway').Gateway} gateway
   * @param {object} [opts]
   * @param {number} [opts.port=3000]
   * @param {number} [opts.timeoutMs=30000]
   */
  constructor(gateway, opts = {}) {
    this._gateway = gateway;
    this._port = opts.port != null ? opts.port : 3000;
    this._timeoutMs = opts.timeoutMs || 30000;
    this._adminKey = opts.adminKey || '';
    this._server = null;

    const app = express();
    app.use(express.json());
    app.use(requestId);
    app.use(requestCancellation);

    // Health endpoints
    app.get('/health', (req, res) => res.json(gateway.health));
    app.get('/readyz', (req, res) => res.json({ status: 'ready', gateway: true }));

    // Prometheus metrics
    app.get('/metrics', (req, res) => {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(gateway.metrics.formatPrometheus());
    });

    // Admin config (hot-reload)
    app.get('/admin/config', this._handleGetConfig.bind(this));
    app.put('/admin/config', this._handlePutConfig.bind(this));

    // List available models
    app.get('/v1/models', this._handleListModels.bind(this));

    // Chat completions (sync + streaming)
    app.post('/v1/chat/completions', this._handleChat.bind(this));

    this._app = app;
  }

  _requireAdmin(req, res) {
    const adminKey = this._adminKey;
    if (!adminKey) return true;
    const provided = req.headers['x-admin-key'] || req.query.adminKey;
    if (provided === adminKey) return true;
    res.status(403).json({ error: { message: 'Admin key required', code: 'FORBIDDEN' } });
    return false;
  }

  _handleGetConfig(req, res) {
    if (!this._requireAdmin(req, res)) return;
    res.json(this._gateway.getConfig());
  }

  async _handlePutConfig(req, res) {
    if (!this._requireAdmin(req, res)) return;
    try {
      await this._gateway.reloadConfig(req.body);
      res.json({ status: 'ok', message: 'Config reloaded' });
    } catch (err) {
      res.status(400).json({ error: { message: err.message, code: 'INVALID_CONFIG' } });
    }
  }

  _handleListModels(req, res) {
    const models = this._gateway.modelMap?.availableModels || [];
    res.json({
      object: 'list',
      data: models.map(m => ({
        id: m,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: '@andy-toolforge',
      })),
    });
  }

  async _handleChat(req, res) {
    const { model, messages, stream, temperature } = req.body;

    if (!model) {
      return res.status(400).json({ error: { message: 'model is required', code: 'INVALID_REQUEST' } });
    }
    if (!messages) {
      return res.status(400).json({ error: { message: 'messages is required', code: 'INVALID_REQUEST' } });
    }

    const request = {
      model,
      messages,
      stream: !!stream,
      temperature: temperature,
      apiKey: req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey,
      signal: req.signal,
      tenant: req.headers['x-tenant-id'] || 'default',
    };

    if (stream) {
      return this._handleStreaming(req, res, request);
    }

    // Sync
    try {
      const result = await this._gateway.chat(request);

      const response = {
        id: `chatcmpl_${req.requestId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.content || '' },
          finish_reason: 'stop',
        }],
        usage: result.usage ? {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: (result.usage.promptTokens || 0) + (result.usage.completionTokens || 0),
        } : undefined,
      };

      // Forward pipeline response headers (rate limit, tenant etc.)
      if (result.responseHeaders) {
        for (const [k, v] of Object.entries(result.responseHeaders)) {
          res.setHeader(k, v);
        }
      }
      res.json(response);
    } catch (err) {
      const status = err.statusCode || 500;
      res.status(status).json({
        error: { message: err.message, type: err.code || 'internal_error', code: status },
      });
    }
  }

  async _handleStreaming(req, res, request) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const responseStream = await this._gateway.chat(request);
      let index = 0;

      for await (const chunk of responseStream) {
        if (req.signal?.aborted) break;

        const payload = {
          id: `chatcmpl_${req.requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [{
            index,
            delta: { content: chunk.content || '', role: index === 0 ? 'assistant' : undefined },
            finish_reason: chunk.finish_reason || null,
          }],
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        index++;
      }

      // Final chunk with usage
      if (!req.signal?.aborted) {
        const finalPayload = {
          id: `chatcmpl_${req.requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [{ index, delta: {}, finish_reason: 'stop' }],
        };
        res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
        res.write('data: [DONE]\n\n');
      }
    } catch (err) {
      if (!res.writableEnded) {
        const errPayload = {
          id: `chatcmpl_${req.requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [],
          error: { message: err.message },
        };
        res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  async start() {
    return new Promise((resolve) => {
      this._server = this._app.listen(this._port, () => {
        console.log(`[llm-gateway] HTTP server listening on port ${this._port}`);
        resolve();
      });
    });
  }

  get address() {
    return this._server?.address();
  }

  async stop(timeoutMs = 5000) {
    if (!this._server) return;
    await this._gateway.drain(timeoutMs);
    return new Promise((resolve) => {
      this._server.close(() => resolve());
    });
  }
}

module.exports = HTTPServer;
