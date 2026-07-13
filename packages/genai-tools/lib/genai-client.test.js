'use strict';
const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('GenAIClient', () => {
  it('throws if no API key available', async () => {
    const key = process.env.GEMINI_API_KEY;
    const key2 = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      const { GenAIClient } = require('./genai-client');
      assert.throws(() => new GenAIClient(), /GEMINI_API_KEY|GOOGLE_API_KEY/);
    } finally {
      if (key) process.env.GEMINI_API_KEY = key;
      if (key2) process.env.GOOGLE_API_KEY = key2;
    }
  });

  it('resolves apiKey from GEMINI_API_KEY first', () => {
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GOOGLE_API_KEY = 'goog-key';
    try {
      const { GenAIClient } = require('./genai-client');
      assert.equal(GenAIClient.resolveApiKey(), 'gem-key');
    } finally {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it('falls back to GOOGLE_API_KEY', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = 'goog-key';
    try {
      const { GenAIClient } = require('./genai-client');
      assert.equal(GenAIClient.resolveApiKey(), 'goog-key');
    } finally {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it('calls generateContent with correct args', async () => {
    const { GenAIClient } = require('./genai-client');
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const client = new GenAIClient();
      const mockResult = {
        candidates: [{ content: { parts: [{ text: 'hello' }] } }]
      };
      client._client = {
        models: {
          generateContent: mock.fn(() => Promise.resolve(mockResult)),
        },
      };
      const result = await client.generateContent({
        model: 'gemini-2.5-flash',
        prompt: 'test',
        config: { temperature: 0.5 },
      });
      assert.equal(result.text, 'hello');
      assert.equal(client._client.models.generateContent.mock.calls.length, 1);
      const call = client._client.models.generateContent.mock.calls[0];
      assert.equal(call.arguments[0].model, 'gemini-2.5-flash');
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});
