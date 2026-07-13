'use strict';
const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('extractStructured', () => {
  it('returns parsed JSON data from response', async () => {
    const { extractStructured } = require('./extract-structured');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: JSON.stringify({ name: 'Alice', age: 30 }),
        raw: {},
      })),
    };

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    };

    const result = await extractStructured(mockClient, {
      content: 'Alice is 30 years old.',
      schema,
      model: 'gemini-2.5-flash',
    });

    assert.deepEqual(result.data, { name: 'Alice', age: 30 });
    assert.equal(result.model, 'gemini-2.5-flash');
  });

  it('sends responseSchema and responseMimeType in config', async () => {
    const { extractStructured } = require('./extract-structured');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: JSON.stringify({ result: true }),
        raw: {},
      })),
    };

    const schema = { type: 'object', properties: { result: { type: 'boolean' } } };

    await extractStructured(mockClient, {
      content: 'It is true.',
      schema,
    });

    const call = mockClient.generateContent.mock.calls[0];
    assert.equal(call.arguments[0].config.responseMimeType, 'application/json');
    assert.deepEqual(call.arguments[0].config.responseSchema, schema);
  });

  it('throws if content is empty', async () => {
    const { extractStructured } = require('./extract-structured');
    const mockClient = { generateContent: mock.fn() };
    await assert.rejects(
      () => extractStructured(mockClient, { content: '', schema: {} }),
      /content/
    );
  });

  it('throws if schema is missing', async () => {
    const { extractStructured } = require('./extract-structured');
    const mockClient = { generateContent: mock.fn() };
    await assert.rejects(
      () => extractStructured(mockClient, { content: 'test' }),
      /schema/
    );
  });

  it('includes instruction in prompt when provided', async () => {
    const { extractStructured } = require('./extract-structured');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({ text: '{}', raw: {} })),
    };

    await extractStructured(mockClient, {
      content: 'Some content.',
      schema: { type: 'object', properties: {} },
      instruction: 'Extract key facts only',
    });

    const call = mockClient.generateContent.mock.calls[0];
    const prompt = call.arguments[0].prompt;
    assert.ok(prompt.includes('Extract key facts only'));
  });
});
