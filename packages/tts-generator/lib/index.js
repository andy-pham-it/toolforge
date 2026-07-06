const { VOICES, VOICE_NAMES, getVoice, pickVoiceForTone } = require('./voices');

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

    // Core classes (filled in by subsequent tasks)
    // TTSPlanner:   require('./planner'),
    // TTSGenerator: require('./generator'),
    // OutputFormatter: require('./output'),
};
