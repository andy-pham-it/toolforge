const { VOICES, VOICE_NAMES, getVoice, pickVoiceForTone } = require('./voices');
const TTSPlanner = require('./planner');
const TTSGenerator = require('./generator');
const OutputFormatter = require('./output');

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
};
