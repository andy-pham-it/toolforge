'use strict';

const { describe, it, before, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// ---------------------------------------------------------------
// Mock @google/genai BEFORE requiring session.js
// The real API: new GoogleGenAI({ apiKey }) → .live.connect({ model, config, callbacks })
// ---------------------------------------------------------------
const genai = require('@google/genai');

// These are set by beforeEach and read by the mock's live.connect()
let currentMockSession;
let currentCallbacks;

mock.method(genai, 'GoogleGenAI', function () {
  return {
    live: {
      connect: mock.fn(async ({ callbacks }) => {
        currentCallbacks = callbacks || {};
        // Simulate server sending setupComplete after connection
        if (callbacks && callbacks.onmessage) {
          callbacks.onmessage({ setupComplete: true });
        }
        return currentMockSession;
      }),
    },
  };
});

const { VoiceSession } = require('./session');

describe('VoiceSession', () => {
  let session;

  beforeEach(() => {
    // Fresh mock session for each test
    currentMockSession = {
      sendRealtimeInput: mock.fn(),
      sendToolResponse: mock.fn(),
      sendClientContent: mock.fn(),
      close: mock.fn(),
    };
    currentCallbacks = {};
    session = new VoiceSession({ apiKey: 'test-key' });
  });

  // ===========================================================
  // State machine: initial
  // ===========================================================
  it('starts in idle state', () => {
    assert.strictEqual(session.state, 'idle');
  });

  // ===========================================================
  // State machine: connect → connecting → listening
  // ===========================================================
  it('transitions through connecting to listening after connect()', async () => {
    const states = [];
    session.on('stateChange', ({ to }) => states.push(to));

    await session.connect();

    assert.ok(states.includes('connecting'), 'should pass through connecting');
    assert.strictEqual(session.state, 'listening');
  });

  // ===========================================================
  // Reject connect when already connected
  // ===========================================================
  it('rejects connect() when not idle', async () => {
    await session.connect();
    assert.strictEqual(session.state, 'listening');

    await assert.rejects(
      () => session.connect(),
      /Cannot connect/
    );
  });

  // ===========================================================
  // Tool calls: server sends toolCall → state = toolCall
  // ===========================================================
  it('transitions to toolCall when server sends toolCall message', async () => {
    await session.connect();

    currentCallbacks.onmessage({
      toolCall: {
        functionCalls: [{ name: 'test_tool', args: { foo: 'bar' }, id: '1' }],
      },
    });

    assert.strictEqual(session.state, 'toolCall');
  });

  // ===========================================================
  // Tool calls: handler invoked + response sent + back to thinking
  // ===========================================================
  it('executes tool handler and sends tool response', async () => {
    const handler = mock.fn(async () => ({ result: 'done' }));
    const toolSession = new VoiceSession({
      apiKey: 'test-key',
      tools: [
        {
          name: 'my_tool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} },
          handler,
        },
      ],
    });

    await toolSession.connect();

    currentCallbacks.onmessage({
      toolCall: {
        functionCalls: [{ name: 'my_tool', args: { x: 1 }, id: '1' }],
      },
    });

    // Allow the async #handleToolCalls to settle
    // It's fire-and-forget from onmessage, but we can await a tick
    await new Promise(setImmediate);

    assert.strictEqual(handler.mock.calls.length, 1);
    assert.deepStrictEqual(handler.mock.calls[0].arguments[0], { x: 1 });

    assert.strictEqual(currentMockSession.sendToolResponse.mock.calls.length, 1);
    const sent = currentMockSession.sendToolResponse.mock.calls[0].arguments[0];
    assert.strictEqual(sent.functionResponses[0].name, 'my_tool');
    assert.deepStrictEqual(sent.functionResponses[0].response, { result: 'done' });

    assert.strictEqual(toolSession.state, 'thinking');
  });

  // ===========================================================
  // Audio response: serverContent with audio → state = speaking
  // ===========================================================
  it('transitions to speaking on audio serverContent', async () => {
    await session.connect();

    currentCallbacks.onmessage({
      serverContent: {
        modelTurn: {
          parts: [
            { inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } },
          ],
        },
      },
    });

    assert.strictEqual(session.state, 'speaking');
  });

  // ===========================================================
  // Text response: serverContent with text → state = thinking
  // ===========================================================
  it('transitions to thinking on text-only serverContent', async () => {
    await session.connect();

    currentCallbacks.onmessage({
      serverContent: {
        modelTurn: {
          parts: [{ text: 'Hello, how can I help?' }],
        },
      },
    });

    assert.strictEqual(session.state, 'thinking');
  });

  // ===========================================================
  // audio + text events emitted
  // ===========================================================
  it('emits text and audio events from serverContent parts', async () => {
    await session.connect();

    const texts = [];
    const audios = [];
    session.on('text', (t) => texts.push(t));
    session.on('audio', (a) => audios.push(a));

    currentCallbacks.onmessage({
      serverContent: {
        modelTurn: {
          parts: [
            { text: 'Sure, here is the information.' },
            { inlineData: { mimeType: 'audio/mp3', data: 'BBBB' } },
          ],
        },
      },
    });

    assert.strictEqual(texts.length, 1);
    assert.strictEqual(texts[0], 'Sure, here is the information.');
    assert.strictEqual(audios.length, 1);
    assert.strictEqual(audios[0].mimeType, 'audio/mp3');
  });

  // ===========================================================
  // turnComplete → auto-listening
  // ===========================================================
  it('returns to listening after turnComplete when autoListen is on', async () => {
    await session.connect();

    // First a speaking state
    currentCallbacks.onmessage({
      serverContent: {
        modelTurn: { parts: [{ text: 'Hello' }] },
        turnComplete: true,
      },
    });

    // Should go: thinking → turnComplete → (auto) listening
    assert.strictEqual(session.state, 'listening');
  });

  // ===========================================================
  // stopListening prevents auto-return
  // ===========================================================
  it('stays in turnComplete after turnComplete when autoListen is off', async () => {
    await session.connect();

    session.stopListening();
    assert.strictEqual(session.state, 'listening'); // still listening initially

    currentCallbacks.onmessage({
      serverContent: {
        modelTurn: { parts: [{ text: 'Done' }] },
        turnComplete: true,
      },
    });

    // autoListen is false, so should stay in turnComplete
    assert.strictEqual(session.state, 'turnComplete');
  });

  // ===========================================================
  // sendAudio delegates to SDK
  // ===========================================================
  it('sendAudio calls sendRealtimeInput on the SDK session', async () => {
    await session.connect();

    session.sendAudio({ mimeType: 'audio/pcm;rate=24000', data: 'CCCC' });

    assert.strictEqual(currentMockSession.sendRealtimeInput.mock.calls.length, 1);
    assert.deepStrictEqual(
      currentMockSession.sendRealtimeInput.mock.calls[0].arguments[0],
      { audio: { mimeType: 'audio/pcm;rate=24000', data: 'CCCC' } }
    );
  });

  // ===========================================================
  // sendText delegates to SDK
  // ===========================================================
  it('sendText calls sendClientContent on the SDK session', async () => {
    await session.connect();

    session.sendText('Hello world');

    assert.strictEqual(currentMockSession.sendClientContent.mock.calls.length, 1);
    const sent = currentMockSession.sendClientContent.mock.calls[0].arguments[0];
    assert.strictEqual(sent.turns[0].parts[0].text, 'Hello world');
    assert.strictEqual(sent.turnComplete, true);
  });

  // ===========================================================
  // disconnect → idle + close()
  // ===========================================================
  it('disconnect transitions to idle and calls close()', async () => {
    await session.connect();

    await session.disconnect();

    assert.strictEqual(session.state, 'idle');
    assert.strictEqual(currentMockSession.close.mock.calls.length, 1);
  });

  // ===========================================================
  // Error event emitted
  // ===========================================================
  it('emits error event when onerror is called', async () => {
    await session.connect();

    const errors = [];
    session.on('error', (err) => errors.push(err));

    currentCallbacks.onerror(new Error('test error'));

    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].message, 'test error');
  });

  // ===========================================================
  // Close event emitted
  // ===========================================================
  it('emits close event and resets to idle', async () => {
    await session.connect();

    const closes = [];
    session.on('close', () => closes.push(true));

    currentCallbacks.onclose();

    assert.strictEqual(closes.length, 1);
    assert.strictEqual(session.state, 'idle');
  });
});
