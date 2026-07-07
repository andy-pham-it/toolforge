'use strict';

const { LLMClient } = require('@andy-toolforge/core');

const PLANNER_SYSTEM_PROMPT = `You are a script segmentation expert for podcast production. Analyze the given script and split it into logical segments for text-to-speech generation.

Rules:
- Split at natural boundaries: topic shifts, paragraph transitions, logical sections
- Each segment should be 30-120 seconds when spoken (roughly 70-280 words)
- Assign an appropriate voice from: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat
- If unsure which voice, set voice to "auto"
- Add audio tags for expressiveness from: determination, enthusiasm, adoration, interest, awe, admiration, nervousness, frustration, excitement, curiosity, hope, annoyance, amusement, aggression, tension, agitation, confusion, anger, positive, neutral, negative, whispers, laughs
- Language is detected from text: "vi" for Vietnamese, "en" for English, "auto" if mixed
- Pace: "slow" for complex/philosophical content, "normal" for narrative, "fast" for exciting parts

Return ONLY valid JSON with this exact structure:
{
  "segments": [
    {
      "id": number,
      "text": "exact segment text",
      "title": "short descriptive title",
      "voice": "voice name or auto",
      "pace": "slow|normal|fast",
      "audioTags": ["tag1", "tag2"],
      "language": "vi|en|auto",
      "estimatedDuration": seconds
    }
  ],
  "metadata": {
    "totalEstimatedDuration": total_seconds,
    "voiceCount": number_of_unique_voices,
    "languages": ["vi", "en"]
  }
}`;

class TTSPlanner {
    /**
     * @param {Object} config
     * @param {Object} [config.llm] - An LLMClient-compatible instance with chat() method
     * @param {number} [config.maxRetries=1] - Max retries on invalid JSON
     */
    constructor(config = {}) {
        this.llm = config.llm || this._createDefaultLLM();
        this.maxRetries = config.maxRetries ?? 1;
    }

    /**
     * Create a default LLM for segmentation when none is explicitly provided.
     * Uses environment variables to auto-configure: GROQ_API_KEY → groq/gemma-4-26b-it,
     * falling back to GEMINI_API_KEY or OPENAI_API_KEY.
     * @returns {LLMClient|null}
     */
    _createDefaultLLM() {
        try {
            if (process.env.GROQ_API_KEY) {
                return new LLMClient({
                    provider: 'groq',
                    apiKey: process.env.GROQ_API_KEY,
                    model: 'gemma-4-26b-it',
                });
            }
            if (process.env.GEMINI_API_KEY) {
                return new LLMClient({
                    provider: 'gemini',
                    apiKey: process.env.GEMINI_API_KEY,
                    model: 'gemini-2.5-flash-lite',
                });
            }
            if (process.env.OPENAI_API_KEY) {
                return new LLMClient({
                    provider: 'openai',
                    apiKey: process.env.OPENAI_API_KEY,
                    model: 'gpt-4o-mini',
                });
            }
        } catch (err) {
            console.warn(`TTSPlanner: could not create default LLM (${err.message})`);
        }
        return null;
    }

    /**
     * Analyze a script and produce a SegmentPlan.
     * Falls back to regex paragraph splitting if LLM is unavailable or fails.
     *
     * @param {string} script - Full script text
     * @param {string} title - Episode title
     * @param {Object} [options]
     * @param {string} [options.voice] - Override voice for all segments ("auto")
     * @returns {Promise<{segments: Array, metadata: Object}>}
     */
    async plan(script, title, options = {}) {
        // Try LLM first
        if (this.llm && typeof this.llm.chat === 'function') {
            try {
                return await this._planWithLLM(script, title, options);
            } catch (err) {
                console.warn(`TTSPlanner: LLM failed (${err.message}), falling back to regex split`);
            }
        }

        // Fallback: regex paragraph splitting
        return this._planWithFallback(script, title, options);
    }

    async _planWithLLM(script, title, options) {
        const userPrompt = [
            `Episode title: ${title}`,
            options.voice ? `Voice override: ${options.voice}` : '',
            options.language ? `Language: ${options.language}` : '',
            options.pace ? `Pace: ${options.pace}` : '',
            '',
            `Script:`,
            script,
        ].filter(Boolean).join('\n');

        let lastError;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const raw = await this.llm.chat(PLANNER_SYSTEM_PROMPT, userPrompt, true);
                const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed.segments || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
                    throw new Error('LLM returned empty segments array');
                }

                return parsed;
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    console.warn(`TTSPlanner: retry ${attempt + 1}/${this.maxRetries} after invalid response`);
                }
            }
        }

        throw new Error(`TTSPlanner: failed to parse LLM response after ${this.maxRetries + 1} attempts — ${lastError.message}`);
    }

    _planWithFallback(script, title, options) {
        // Split by blank lines (double newline or more)
        const paragraphs = script
            .split(/\n\s*\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (paragraphs.length === 0) {
            // Single block — treat as one segment
            paragraphs.push(script.trim());
        }

        const segments = paragraphs.map((text, i) => {
            // Rough estimate: ~150 words per minute, ~3 chars/word for Vietnamese
            const wordCount = text.split(/\s+/).length;
            const estimatedDuration = Math.max(5, Math.round(wordCount / 3));

            return {
                id: i + 1,
                text,
                title: `Segment ${i + 1}`,
                voice: options.voice || 'auto',
                pace: options.pace || 'normal',
                audioTags: [],
                language: options.language || 'auto',
                estimatedDuration,
            };
        });

        const voices = new Set(segments.map(s => s.voice).filter(v => v !== 'auto'));
        const languages = new Set(segments.map(s => s.language).filter(l => l !== 'auto'));

        return {
            segments,
            metadata: {
                totalEstimatedDuration: segments.reduce((sum, s) => sum + s.estimatedDuration, 0),
                voiceCount: voices.size || 1,
                languages: languages.size > 0 ? [...languages] : ['auto'],
            },
        };
    }
}

module.exports = TTSPlanner;
