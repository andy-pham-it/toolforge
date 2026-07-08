'use strict';

const TTSPlanner = require('./planner');
const TTSGenerator = require('./generator');
const OutputFormatter = require('./output');
const { VOICES, pickVoiceForTone } = require('./voices');

class TTSPlugin {
  /**
   * @param {object} config
   * @param {string} config.apiKey - Gemini API key (default: GEMINI_API_KEY env)
   * @param {object} [config.planner] - TTSPlanner constructor options
   * @param {object} [config.tts] - TTSGenerator constructor options
   * @param {number} [config.segmentDelay=5000] - Delay (ms) between segment generations
   * @param {string} [config.defaultBackend] - Default tag injection backend ('google-api'|'gemini-web'|null)
   */
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      planner: config.planner || {},
      tts: config.tts || {},
      segmentDelay: config.segmentDelay ?? 5000,
      defaultBackend: config.defaultBackend || null,
    };

    if (!this.config.apiKey) {
      throw new Error(
        'TTSPlugin: apiKey is required. Set GEMINI_API_KEY or GOOGLE_API_KEY env var.'
      );
    }

    this.planner = new TTSPlanner({
      llm: this.config.planner.llm || null,
      ...this.config.planner,
    });

    this.generator = new TTSGenerator({
      apiKey: this.config.apiKey,
      tts: {
        model: this.config.tts.model || 'gemini-3.1-flash-tts-preview',
        fallback: this.config.tts.fallback || 'gemini-2.5-flash-preview-tts',
      },
      ...this.config.tts,
    });

    this.formatter = new OutputFormatter();
  }

  /**
   * Plan / segment a script into TTS-ready segments.
   * @param {string} script - Full script text
   * @param {string} title - Episode/project title
   * @param {object} [options]
   * @returns {Promise<object>} plan object with segments array + metadata
   */
  async plan(script, title, options = {}) {
    return this.planner.plan(script, title, {
      voice: options.voice || 'auto',
      language: options.language || 'auto',
      pace: options.pace || 'normal',
    });
  }

  /**
   * Inject AI-reasoned audio tags into segments.
   * @param {Array} segments - Segments from plan()
   * @param {string} script - Full original script
   * @param {object} [options]
   * @param {string} [options.backend] - 'google-api' | 'gemini-web' (defaults to config.defaultBackend)
   * @param {string} [options.stylePrompt] - Optional style guidance
   * @returns {Promise<Array>} tagged segments
   */
  async injectTags(segments, script, options = {}) {
    const backend = options.backend || this.config.defaultBackend;
    if (!backend) return segments;
    return this.planner.injectTags(segments, script, {
      backend,
      stylePrompt: options.stylePrompt || '',
    });
  }

  /**
   * Generate audio for planned segments.
   * @param {Array} segments - Segments (with voice, audioTags, etc.)
   * @param {object} [options]
   * @param {number} [options.segmentDelay] - Delay between generations (ms)
   * @param {AbortSignal} [options.signal] - Optional abort signal
   * @returns {Promise<Array>} audio results (each with id, audio Buffer, error?)
   */
  async generate(segments, options = {}) {
    return this.generator.generateBatch(segments, {
      segmentDelay: options.segmentDelay ?? this.config.segmentDelay,
      signal: options.signal || null,
    });
  }

  /**
   * Full pipeline: plan → injectTags → generate → format.
   *
   * One-call convenience for the common case. Skips tag injection if
   * no backend is configured or passed.
   *
   * @param {string} script - Full script text
   * @param {string} title - Episode/project title
   * @param {object} [options]
   * @param {string} [options.voice] - Voice override
   * @param {string} [options.language] - Language code
   * @param {string} [options.pace] - 'slow'|'normal'|'fast'
   * @param {string} [options.backend] - Tag injection backend
   * @param {string} [options.stylePrompt] - Style guidance for tags
   * @param {number} [options.segmentDelay] - Delay between generations (ms)
   * @param {string} [options.mode='batch'] - 'batch'|'single'
   * @param {string[]} [options.audioTags] - Manual audio tags to apply
   * @returns {Promise<object>} Formatted result with segments (base64 audio) + metadata
   */
  async fullPipeline(script, title, options = {}) {
    const plan = await this.planner.plan(script, title, {
      voice: options.voice || 'auto',
      language: options.language || 'auto',
      pace: options.pace || 'normal',
    });

    let segments = plan.segments.map(s => {
      let voice = s.voice;
      if (voice === 'auto' || !voice) {
        voice = options.voice && options.voice !== 'auto'
          ? options.voice
          : pickVoiceForTone('informative');
      }
      const tags = options.audioTags && options.audioTags.length > 0
        ? [...new Set([...(s.audioTags || []), ...options.audioTags])]
        : s.audioTags;
      return { ...s, voice, audioTags: tags };
    });

    const backend = options.backend || this.config.defaultBackend;
    if (backend) {
      try {
        const tagged = await this.planner.injectTags(segments, script, {
          backend,
          stylePrompt: options.stylePrompt || '',
        });
        const taggedMap = new Map(tagged.map(s => [s.id, s]));
        segments = segments.map(s => {
          const t = taggedMap.get(s.id);
          if (!t) return s;
          return { ...t, voice: s.voice };
        });
      } catch (err) {
        console.warn(`TTSPlugin.fullPipeline: tag injection failed (${err.message}), continuing`);
      }
    }

    const audioResults = await this.generator.generateBatch(segments, {
      segmentDelay: options.segmentDelay ?? this.config.segmentDelay,
    });

    const successful = audioResults.filter(r => !r.error);
    const successfulSegments = segments.filter(s =>
      !audioResults.find(r => r.error && r.id === s.id)
    );
    const failed = audioResults.filter(r => r.error).map(r => ({
      id: r.id, error: r.error,
    }));

    if (options.mode === 'single') {
      const combined = this.formatter.formatSingle(successful.map(r => r.audio));
      return {
        audio: combined.toString('base64'),
        format: successful[0]?.format || 'wav',
        segments: audioResults,
        metadata: plan.metadata,
        failedSegments: failed,
      };
    }

    const batch = this.formatter.formatBatch(
      successfulSegments,
      successful.map(r => r.audio)
    );

    return {
      segments: batch.segments.map(s => ({
        ...s,
        audio: s.audio.toString('base64'),
      })),
      metadata: plan.metadata,
      failedSegments: failed,
    };
  }

  /**
   * List available TTS voices.
   * @returns {Array<{name: string, style: string, description: string}>}
   */
  listVoices() {
    return Object.entries(VOICES).map(([name, meta]) => ({
      name,
      style: meta.style,
      description: meta.description,
    }));
  }
}

module.exports = TTSPlugin;
