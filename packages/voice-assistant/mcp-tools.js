'use strict';

const { VoiceAssistant } = require('./lib');

// ---------------------------------------------------------------------------
// voice_assistant_session
// ---------------------------------------------------------------------------
const sessionDef = {
  name: 'voice_assistant_session',
  description:
    'Start a bounded voice conversation. The AI agent initiates this (text over MCP), then the user speaks directly via audio. ' +
    'Gemini processes speech, calls tools if needed, and responds with voice. ' +
    'Returns session transcript on completion.',
  inputSchema: {
    type: 'object',
    properties: {
      systemPrompt: {
        type: 'string',
        description: 'Override system prompt for this session',
      },
      voice: {
        type: 'string',
        description: 'Override voice for this session',
      },
      maxTurns: {
        type: 'number',
        description: 'Max conversation turns (default: 10)',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Session idle timeout in seconds (default: 60)',
      },
    },
  },
};

async function sessionHandler(llm, args) {
  const cfg = module.exports._pluginConfig || {};

  return {
    status: 'ready',
    instructions:
      'Voice session configured. The client application should now: ' +
      '1) Initialize a VoiceAssistant with the provided config ' +
      '2) Connect the microphone audio stream via assistant.start(micStream) ' +
      '3) Handle events (listening, thinking, speaking, toolCall) ' +
      '4) Call disconnect() when done',
    config: {
      systemPrompt:
        args.systemPrompt ||
        cfg.systemPrompt ||
        'You are a helpful voice assistant.',
      voice: args.voice || cfg.voice || 'Charon',
      maxTurns: args.maxTurns || 10,
      timeoutSeconds: args.timeoutSeconds || 60,
    },
  };
}

// ---------------------------------------------------------------------------
// voice_assistant_configure
// ---------------------------------------------------------------------------
const configureDef = {
  name: 'voice_assistant_configure',
  description:
    'Configure the voice assistant settings (systemPrompt, voice, default tools). ' +
    'Stores config in memory for the current session.',
  inputSchema: {
    type: 'object',
    properties: {
      systemPrompt: {
        type: 'string',
        description: 'System prompt for the assistant',
      },
      voice: {
        type: 'string',
        description: 'Voice name for the assistant',
      },
      tools: {
        type: 'array',
        description:
          'Array of tool definitions with name, description, parameters',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
  },
};

async function configureHandler(llm, args) {
  const current = module.exports._pluginConfig || {};
  module.exports._pluginConfig = {
    ...current,
    ...args,
  };

  return {
    status: 'configured',
    config: module.exports._pluginConfig,
  };
}

// ---------------------------------------------------------------------------
// Exports — factory pattern for MCP auto-discovery
// ---------------------------------------------------------------------------
module.exports = function (config = {}) {
  module.exports._pluginConfig = config;
  return [
    { definition: sessionDef, handler: sessionHandler },
    { definition: configureDef, handler: configureHandler },
  ];
};
