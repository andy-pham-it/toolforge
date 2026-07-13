'use strict';
const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('searchGrounding', () => {
  it('returns answer with citations on success', async () => {
    const { searchGrounding } = require('./search-grounding');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: 'The Eiffel Tower is in Paris.',
        raw: {
          candidates: [{
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: 'https://example.com', title: 'Example' } }
              ],
              groundingSupports: [
                { segment: { text: 'Eiffel Tower' }, groundingChunkIndices: [0], confidenceScores: [0.95] }
              ]
            }
          }]
        }
      })),
    };

    const result = await searchGrounding(mockClient, {
      query: 'Where is the Eiffel Tower?',
      model: 'gemini-2.5-flash',
    });

    assert.ok(result.answer.includes('Paris'));
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].uri, 'https://example.com');
    assert.equal(result.citations[0].title, 'Example');
    assert.equal(result.model, 'gemini-2.5-flash');
  });

  it('returns empty citations when grounding is missing', async () => {
    const { searchGrounding } = require('./search-grounding');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: 'Some answer.',
        raw: { candidates: [{ content: { parts: [{ text: 'Some answer.' }] } }] },
      })),
    };

    const result = await searchGrounding(mockClient, {
      query: 'Test question',
    });

    assert.ok(result.answer);
    assert.deepEqual(result.citations, []);
  });

  it('throws if query is empty', async () => {
    const { searchGrounding } = require('./search-grounding');
    const mockClient = { generateContent: mock.fn() };
    await assert.rejects(
      () => searchGrounding(mockClient, { query: '', model: 'gemini-2.5-flash' }),
      /query/
    );
  });

  it('uses default model when not specified', async () => {
    const { searchGrounding } = require('./search-grounding');
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const { GenAIClient } = require('../genai-client');
      const client = new GenAIClient();
      client._client = {
        models: {
          generateContent: mock.fn(() => Promise.resolve({ text: 'ok', raw: {} })),
        },
      };
      const result = await searchGrounding(client, { query: 'test' });
      // Verify the config passed includes googleSearch tool
      const call = client._client.models.generateContent.mock.calls[0];
      assert.ok(call.arguments[0].config.tools);
      assert.deepEqual(call.arguments[0].config.tools, [{ googleSearch: {} }]);
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});
