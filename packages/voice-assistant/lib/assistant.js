'use strict';

const { VoiceSession } = require('./session');

/**
 * VoiceAssistant — high-level voice assistant API.
 *
 * Wraps VoiceSession with simpler lifecycle management:
 *  - `start(audioStream)` creates and connects a session, pipes mic input
 *  - `ask(text)` sends a one-shot text prompt
 *  - Events forwarded from the session as assistant-level state names
 *  - Domain customization: set systemPrompt + tools in constructor config
 */
class VoiceAssistant {
  #config;
  #session = null;
  #eventHandlers = {};

  constructor(config = {}) {
    if (!config.apiKey) {
      throw new Error('VoiceAssistant: apiKey is required');
    }
    this.#config = {
      model: 'gemini-2.5-flash-native-audio-latest',
      systemPrompt: 'You are a helpful voice assistant.',
      voice: 'Charon',
      tools: [],
      audioInput: {
        sampleRate: 24000,
        channels: 1,
        encoding: 'LINEAR16',
      },
      ...config,
    };
  }

  /**
   * Start a full-duplex voice session with an audio input stream.
   * @param {import('stream').Readable} audioStream - Node.js Readable stream
   *   emitting Buffer chunks (LINEAR16 PCM 24 kHz mono).
   * @returns {Promise<VoiceSession>}
   */
  async start(audioStream) {
    if (this.#session) {
      throw new Error(
        'VoiceAssistant: a session is already active. Call disconnect() first.'
      );
    }

    const session = new VoiceSession(this.#config);
    this.#session = session;

    // Forward state changes as assistant-level events
    session.on('stateChange', ({ to }) => {
      const eventMap = {
        listening: 'listening',
        thinking: 'thinking',
        speaking: 'speaking',
        toolCall: 'toolCall',
        turnComplete: 'turnComplete',
      };
      const event = eventMap[to];
      if (event) {
        this.#emit(event);
      }
    });

    // Forward errors
    session.on('error', (err) => {
      this.#emit('error', err);
    });

    // Forward tool calls with context
    session.on('toolCalls', (calls) => {
      this.#emit('toolCall', calls);
    });

    // Forward audio output data
    session.on('audio', (audioData) => {
      this.#emit('audio', audioData);
    });

    // Forward turn complete
    session.on('turnComplete', () => {
      this.#emit('turnComplete');
    });

    // Connect to Gemini Live API
    await session.connect();

    // Pipe audio input stream into the session (mic → Gemini)
    audioStream.on('data', (chunk) => {
      if (session.state === 'listening' || session.state === 'idle') {
        // Wrap in PCM format for the Gemini Live API
        session.sendAudio({
          mimeType: `audio/pcm;rate=${this.#config.audioInput.sampleRate}`,
          data: chunk instanceof Buffer ? chunk.toString('base64') : chunk,
        });
      }
    });

    audioStream.on('error', (err) => {
      this.#emit('error', err);
    });

    audioStream.on('end', () => {
      session.stopListening();
    });

    return session;
  }

  /**
   * One-shot text interaction (no microphone needed).
   * Sends text to the active session.
   */
  async ask(text) {
    if (!this.#session) {
      throw new Error(
        'VoiceAssistant: no active session. Call start() first.'
      );
    }

    this.#session.sendText(text);
    return 'OK';
  }

  // ==============================
  // Event emitter
  // ==============================

  on(event, handler) {
    if (!this.#eventHandlers[event]) {
      this.#eventHandlers[event] = [];
    }
    this.#eventHandlers[event].push(handler);
    return this;
  }

  off(event, handler) {
    const handlers = this.#eventHandlers[event];
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
    return this;
  }

  #emit(event, ...args) {
    const handlers = this.#eventHandlers[event];
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (err) {
          console.error(
            `VoiceAssistant: error in "${event}" handler:`,
            err
          );
        }
      }
    }
  }

  // ==============================
  // Session control
  // ==============================

  startListening() {
    if (this.#session) this.#session.startListening();
  }

  stopListening() {
    if (this.#session) this.#session.stopListening();
  }

  async disconnect() {
    if (this.#session) {
      await this.#session.disconnect();
      this.#session = null;
    }
  }
}

module.exports = { VoiceAssistant };
