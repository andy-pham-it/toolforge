const { VOICES, VOICE_NAMES, getVoice, pickVoiceForTone } = require('./voices');
const TTSPlanner = require('./planner');
const TTSGenerator = require('./generator');
const OutputFormatter = require('./output');
const TTSPlugin = require('./plugin');
const { LiveTTSGenerator, LIVE_MODELS, LIVE_MODEL_NAMES } = require('./live-generator');

/**
 * @andy-toolforge/tts-generator entry point.
 * Exports all public classes and utilities.
 */
module.exports = {
    // Voice utilities
    VOICES,
    VOICE_NAMES,
    getVoice,
    pickVoiceForTone,

    // Core classes
    TTSPlanner,
    TTSGenerator,
    OutputFormatter,

    // Web plugin (Express / NestJS)
    TTSPlugin,

    // Live API (WebSocket)
    LiveTTSGenerator,
    LIVE_MODELS,
    LIVE_MODEL_NAMES,
};
