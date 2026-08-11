'use strict';

// capability -> ordered [(provider, model)]
// Model IDs from nx-with-angular/docs/model-aliases-cheatsheet.md (2026-08-09).
// ALIVE providers (auth.json 2026-08-10): nvidia, huggingface, gemini, kimi-coding.
// NOTE: cheatsheet's nvidia/hf free models route via OpenRouter (dead 402) or
// OpenCode Zen (dead 429) — so gemini is the only alive provider with confirmed
// free model IDs. Gemini models use BARE IDs (no provider prefix), matching the
// cheatsheet Gemini table and hermes _normalize_model_for_provider (prefixes
// stripped only for opencode-zen/opencode-go/copilot).
module.exports = {
  // gemini-3.5-flash-lite replaces gemini-2.5-flash (user change 2026-08-10)
  reasoning: [
    ['gemini', 'gemini-3.1-flash-lite'],
    ['gemini', 'gemini-3-flash'],
    ['gemini', 'gemini-3.5-flash-lite'],
    ['openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
    ['openrouter', 'nvidia/nemotron-3-super-120b-a12b:free'],
    ['opencode-zen', 'deepseek-v4-flash-free'], // default model for explicit provider=opencode-zen (user 2026-08-11)
  ],
  coding: [
    ['gemini', 'gemini-3.1-flash-lite'],
    ['gemini', 'gemini-3-flash'],
    ['opencode-zen', 'mimo-v2.5-free'],
    ['opencode-zen', 'cohere/north-mini-code:free'], // North Mini Code (Free) via OpenCode Zen
    ['opencode-zen', 'deepseek-v4-flash-free'],
    ['openrouter', 'cohere/north-mini-code:free'],
  ],
  vision: [
    ['gemini', 'gemini-3.5-flash-lite'],
    ['gemini', 'gemini-3.1-flash-lite'],
    ['openrouter', 'google/gemma-4-31b-it:free'],
  ], // gemma-4-31b (free-vision)
  multimodal: [
    ['gemini', 'gemini-3.1-flash-lite'],
    ['openrouter', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'],
  ],
  planning: [['gemini', 'gemini-3.1-flash-lite']],
  'image-gen': [
    ['gemini', 'imagen-4.0-fast-generate'],
    ['gemini', 'imagen-4.0-generate'],
  ], // Imagen 4 Generate; execution out of scope v1
  voice: [['gemini', 'gemini-3.1-flash-tts']], // execution out of scope v1
  chat: [
    ['gemini', 'gemini-3.1-flash-lite'],
    ['openrouter', 'nvidia/nemotron-nano-9b-v2:free'],
    ['opencode-zen', 'mimo-v2.5-free'],
    ['openrouter', 'poolside/laguna-s-2.1:free'],
    ['openrouter', 'poolside/laguna-xs-2.1:free'],
    ['opencode-zen', 'deepseek-v4-flash-free'],
  ],
};
