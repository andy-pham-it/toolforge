'use strict';

const { EventEmitter } = require('events');
const { GoogleGenAI } = require('@google/genai');

const STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  TOOL_CALL: 'toolCall',
  TURN_COMPLETE: 'turnComplete',
};

class VoiceSession extends EventEmitter {
  #state = STATES.IDLE;
  #client = null;   // GoogleGenAI instance
  #session = null;  // The live session from connect()
  #config = null;
  #toolHandlers = null;
  #autoListen = true;
  #setupResolve = null;

  constructor(config = {}) {
    super();
    this.#config = config;
  }

  get state() {
    return this.#state;
  }

  #setState(newState) {
    const prev = this.#state;
    this.#state = newState;
    this.emit('stateChange', { from: prev, to: newState });
  }

  async connect(overrides = {}) {
    if (this.#state !== STATES.IDLE) {
      throw new Error(
        `Cannot connect: session is in state "${this.#state}"`
      );
    }

    this.#setState(STATES.CONNECTING);

    const config = { ...this.#config, ...overrides };

    // Create GoogleGenAI client with the provided API key
    this.#client = new GoogleGenAI({ apiKey: config.apiKey });

    // Store tool handlers keyed by name for tool-call dispatch
    this.#toolHandlers = {};
    for (const t of config.tools || []) {
      if (t.handler) {
        this.#toolHandlers[t.name] = t.handler;
      }
    }

    // Promise that resolves when the server sends setupComplete
    this.#setupResolve = null;
    const setupComplete = new Promise((resolve) => {
      this.#setupResolve = resolve;
    });

    // Connect to Gemini Live API with bidirectional audio
    this.#session = await this.#client.live.connect({
      model: config.model || 'gemini-2.5-flash-native-audio-latest',
      config: {
        systemInstruction: config.systemPrompt
          ? { parts: [{ text: config.systemPrompt }] }
          : undefined,
        voiceConfig: config.voice
          ? { prebuiltVoice: config.voice }
          : undefined,
        tools: (config.tools || []).map((t) => ({
          functionDeclarations: [
            {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          ],
        })),
      },
      callbacks: {
        onmessage: (msg) => this.#handleMessage(msg),
        onerror: (err) => this.#handleError(err),
        onclose: () => this.#handleClose(),
      },
    });

    // Wait for the server to confirm the session is ready
    await setupComplete;
    this.#setState(STATES.LISTENING);
  }

  // ==============================
  // Internal message handling
  // ==============================

  #handleMessage(msg) {
    // Setup acknowledgment — the session is now live
    if (msg.setupComplete) {
      if (this.#setupResolve) {
        this.#setupResolve();
        this.#setupResolve = null;
      }
      return;
    }

    // Tool call from the model (invoke a declared function)
    if (msg.toolCall && msg.toolCall.functionCalls) {
      this.#handleToolCalls(msg.toolCall.functionCalls);
      return;
    }

    // Server content = model's response (audio, text, or both)
    if (msg.serverContent) {
      this.#handleServerContent(msg.serverContent);
    }
  }

  async #handleToolCalls(functionCalls) {
    this.#setState(STATES.TOOL_CALL);
    this.emit('toolCalls', functionCalls);

    // Execute all tools in parallel
    const responses = await Promise.all(
      functionCalls.map(async (call) => {
        const handler = this.#toolHandlers[call.name];
        try {
          const result = handler
            ? await handler(call.args)
            : { error: `Tool "${call.name}" not found` };
          return { name: call.name, response: result, id: call.id };
        } catch (err) {
          return {
            name: call.name,
            response: { error: err.message },
            id: call.id,
          };
        }
      })
    );

    // Send tool responses back to the model
    await this.#session.sendToolResponse({ functionResponses: responses });
    this.#setState(STATES.THINKING);
  }

  #handleServerContent(serverContent) {
    const { modelTurn, turnComplete } = serverContent;

    if (modelTurn && modelTurn.parts) {
      let hasAudio = false;

      for (const part of modelTurn.parts) {
        if (part.text) {
          this.emit('text', part.text);
        }
        if (
          part.inlineData &&
          part.inlineData.mimeType &&
          part.inlineData.mimeType.startsWith('audio/')
        ) {
          hasAudio = true;
          this.emit('audio', part.inlineData);
        }
      }

      this.#setState(hasAudio ? STATES.SPEAKING : STATES.THINKING);
    }

    if (turnComplete) {
      this.#setState(STATES.TURN_COMPLETE);
      this.emit('turnComplete');
      if (this.#autoListen) {
        this.#setState(STATES.LISTENING);
      }
    }
  }

  #handleError(err) {
    this.emit('error', err);
  }

  #handleClose() {
    this.#session = null;
    this.#setState(STATES.IDLE);
    this.emit('close');
  }

  // ==============================
  // Public API
  // ==============================

  /**
   * Send raw audio for realtime input (mic stream).
   * @param {Object} chunk - { mimeType: string, data: string|Buffer }
   */
  sendAudio(chunk) {
    if (!this.#session) throw new Error('Session not connected');
    this.#session.sendRealtimeInput({ audio: chunk });
  }

  /**
   * Send text input (alternative to audio).
   */
  sendText(text) {
    if (!this.#session) throw new Error('Session not connected');
    this.#session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    });
  }

  /**
   * Re-enable auto-listening (turn auto-returns to LISTENING).
   */
  startListening() {
    this.#autoListen = true;
    if (
      this.#state === STATES.TURN_COMPLETE ||
      this.#state === STATES.IDLE
    ) {
      this.#setState(STATES.LISTENING);
    }
  }

  /**
   * Disable auto-listening (session stays in TURN_COMPLETE after model finishes).
   */
  stopListening() {
    this.#autoListen = false;
  }

  /**
   * Disconnect and reset to IDLE.
   */
  async disconnect() {
    if (this.#session) {
      try {
        this.#session.close();
      } catch {
        // Ignore close errors
      }
      this.#session = null;
    }
    this.#client = null;
    this.#toolHandlers = {};
    this.#setupResolve = null;
    this.#setState(STATES.IDLE);
  }
}

VoiceSession.STATES = STATES;

module.exports = { VoiceSession };
