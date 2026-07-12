'use strict';

const { LLMClient } = require('@andy-toolforge/core');
const { GoogleGenAI } = require('@google/genai');

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

const INJECT_TAGS_SYSTEM_PROMPT = `You are a podcast segment analyzer. Analyze each segment for text-to-speech generation and enhance it with audio tags.

For each segment, determine:
1. **Content type**: narrative, philosophical, technical, emotional, dialogue, storytelling, educational, humorous, descriptive
2. **Pacing**: slow (complex/explanatory content), normal (narrative/storytelling), fast (exciting/urgent)
3. **Tone/emotion**: calm, excited, serious, cheerful, mysterious, warm, authoritative, curious, nostalgic, dramatic

Available audio tags (inject as [tag] markers at the START of segment text):
[slow], [normal], [fast], [philosophical], [storyteller], [conversational], [authoritative],
[calm], [excited], [serious], [cheerful], [mysterious], [warm], [curious], [dramatic],
[whispers], [laughs], [emphatic], [nostalgic]

Rules:
- Inject 1-3 tags at the start — e.g. "[slow][philosophical] Content..."
- If existing audioTags already cover the tone, don't duplicate
- Each segment should be ~30-60 seconds spoken (~70-150 words for Vietnamese, ~90-200 for English)
- If a segment is significantly longer, suggest a split point
- Pacing MUST match content density: philosophical/technical → slow, narrative → normal, exciting → fast

Return ONLY valid JSON. No markdown, no code fences.`;

class TTSPlanner {
    /**
     * @param {Object} config
     * @param {Object} [config.llm] - An LLMClient-compatible instance with chat() method
     * @param {number} [config.maxRetries=1] - Max retries on invalid JSON
     */
    constructor(config = {}) {
        this.llm = config.llm || this._createDefaultLLM();
        this.maxRetries = config.maxRetries ?? 1;
        this._genAI = config.genai || null;
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
                    model: 'gemini-3.1-flash-lite',
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

    /**
     * Enhance segments with audio tags based on content analysis.
     * Uses an AI reasoning model to analyze tone, pacing, and style.
     *
     * @param {Array} segments - Segments from plan()
     * @param {string} originalScript - Full original script (for sourceRef computation)
     * @param {Object} [options]
     * @param {string} [options.backend='google-api'] - 'google-api' or 'gemini-web'
     * @param {string} [options.stylePrompt=''] - Additional style/tone guidance
     * @param {string} [options.model] - Model override (e.g. 'gemini-2.5-pro-exp-03-25')
     * @param {AbortSignal} [options.signal] - AbortSignal
     * @returns {Promise<Array>} Enhanced segments with tags, originalText, sourceRef
     */
    async injectTags(segments, originalScript = '', options = {}) {
        if (!Array.isArray(segments) || segments.length === 0) {
            return [];
        }

        const { backend = 'google-api', stylePrompt = '', model, signal } = options;

        // Compute sourceRef by matching text positions in the original script
        const withRef = this._computeSourceRef(segments, originalScript);

        let enhanced;
        if (backend === 'google-api') {
            enhanced = await this._injectTagsWithGoogleAI(withRef, originalScript, { stylePrompt, model, signal });
        } else if (backend === 'gemini-web') {
            enhanced = await this._injectTagsWithGeminiWeb(withRef, originalScript, { stylePrompt, signal });
        } else {
            throw new Error(`TTSPlanner: unknown injectTags backend "${backend}"`);
        }

        // Merge AI results back into original segments (preserve all fields)
        return this._mergeInjectResults(segments, enhanced);
    }

    /**
     * Inject tags into a script (or pre-segmented segments) and return
     * both a human-readable tagged script string and structured tagged segments.
     *
     * @param {string|Array} scriptOrSegments - Full script text OR array of segments from plan()
     * @param {string} title - Episode title (required if auto-segmenting a string)
     * @param {Object} [options]
     * @param {string} [options.backend='google-api'] - Tag injection backend
     * @param {string} [options.stylePrompt=''] - Style/tone guidance
     * @param {string} [options.model] - Gemini model override
     * @param {AbortSignal} [options.signal] - Cancellation signal
     * @param {string} [options.voice='auto'] - Voice override for plan()
     * @param {string} [options.language='auto'] - Language override for plan()
     * @param {string} [options.pace='normal'] - Pace override for plan()
     * @returns {Promise<{tagged_script: string, tagged_segments: Array, metadata: Object}>}
     */
    async injectTagsToScript(scriptOrSegments, title, options = {}) {
        // Validate input
        if (typeof scriptOrSegments === 'string') {
            if (!scriptOrSegments.trim()) {
                throw new Error('TTSPlanner.injectTagsToScript: scriptOrSegments must be a non-empty string or array');
            }
        } else if (Array.isArray(scriptOrSegments)) {
            if (scriptOrSegments.length === 0) {
                throw new Error('inject_tts_tags: no segments to tag');
            }
        } else {
            throw new Error('inject_tts_tags: invalid input — must be a string or array of segments');
        }

        const { backend = 'google-api', stylePrompt = '', model, signal, voice, language, pace } = options;
        const originalScript = typeof scriptOrSegments === 'string' ? scriptOrSegments : (options.originalScript || '');

        // Step 1: Auto-segment if given a string
        let segments, metadata;
        if (typeof scriptOrSegments === 'string') {
            try {
                const planResult = await this.plan(scriptOrSegments, title, { voice, language, pace });
                segments = planResult.segments;
                metadata = planResult.metadata;
            } catch (err) {
                throw new Error(`inject_tts_tags: script auto-segmentation failed — ${err.message}`);
            }
        } else {
            segments = scriptOrSegments;
            metadata = {};
        }

        // Step 2: Inject tags
        let enhanced;
        try {
            enhanced = await this.injectTags(segments, originalScript, {
                backend,
                stylePrompt,
                model,
                signal,
            });
        } catch (err) {
            throw new Error(`inject_tts_tags: tag injection failed — ${err.message}`);
        }

        // Step 3: Reconstruct tagged script string
        const taggedScript = this._reconstructTaggedScript(enhanced);

        return {
            tagged_script: taggedScript,
            tagged_segments: enhanced,
            metadata,
        };
    }

    /**
     * Reconstruct a full tagged script string from enhanced segments.
     * Each segment's text (with [tag] markers) joined by double newlines.
     * @private
     */
    _reconstructTaggedScript(enhancedSegments) {
        return enhancedSegments
            .map(s => s.text || '')
            .filter(Boolean)
            .join('\n\n');
    }

    /**
     * Compute character offset sourceRef for each segment.
     * @private
     */
    _computeSourceRef(segments, originalScript) {
        if (!originalScript) {
            return segments.map(s => ({ ...s, sourceRef: null }));
        }
        let searchFrom = 0;
        return segments.map(seg => {
            // Try to find the exact text; fall back to null
            const cleanText = seg.text.replace(/\[.*?\]/g, '').trim();
            const idx = originalScript.indexOf(cleanText, searchFrom);
            if (idx >= 0) {
                searchFrom = idx + cleanText.length;
                return { ...seg, sourceRef: { startChar: idx, endChar: idx + cleanText.length } };
            }
            return { ...seg, sourceRef: null };
        });
    }

    /**
     * Inject tags via @google/genai SDK (Gemini REST API).
     * @private
     */
    async _injectTagsWithGoogleAI(segments, originalScript, { stylePrompt, model, signal } = {}) {
        const genAI = this._genAI || this._createDefaultGenAI();
        if (!genAI) {
            throw new Error(
                'TTSPlanner: GoogleGenAI not available for injectTags. ' +
                'Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.'
            );
        }

        const effectiveModel = model || 'gemini-3.1-flash-lite';

        const userPrompt = [
            originalScript ? `Full script context:\n${originalScript}\n` : '',
            stylePrompt ? `Style guidance: ${stylePrompt}\n` : '',
            `Segments to analyze:\n${JSON.stringify(segments.map(s => ({
                id: s.id,
                text: s.text,
                title: s.title,
                pace: s.pace,
                existingTags: s.audioTags || [],
            })), null, 2)}`,
            '',
            `For each segment, return:
            - "text": original text with [tag] markers prepended
            - "audioTags": array of tag names (without brackets)
            - "pace": "slow" | "normal" | "fast"
            - "tone": emotional tone name
            - "suggestedSplit": null or { "splitAt": "sentence to split at", "reason": "why" }
            - "sourceRef": { "startChar": N, "endChar": N } — character offset in original script`,
        ].filter(Boolean).join('\n');

        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await genAI.models.generateContent({
                    model: effectiveModel,
                    contents: [
                        { role: 'user', parts: [{ text: INJECT_TAGS_SYSTEM_PROMPT }] },
                        { role: 'user', parts: [{ text: userPrompt }] },
                    ],
                    config: {
                        responseMimeType: 'application/json',
                        temperature: 0.3,
                    },
                });

                const text = response.text;
                if (!text) throw new Error('Empty response from AI');

                const parsed = typeof text === 'string' ? JSON.parse(text) : text;

                // Handle both { segments: [...] } and direct [...] formats
                let result = parsed;
                if (Array.isArray(parsed)) {
                    result = { segments: parsed };
                }

                if (!result.segments || !Array.isArray(result.segments)) {
                    throw new Error('AI returned invalid structure: missing segments array');
                }

                return result.segments;
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await this._sleep(delay);
                }
            }
        }

        throw new Error(`TTSPlanner: injectTags failed after ${this.maxRetries + 1} attempts — ${lastError.message}`);
    }

    /**
     * Inject tags via Puppeteer + Gemini web UI.
     * Uses a persistent Chrome profile for session persistence.
     * @private
     */
    async _injectTagsWithGeminiWeb(segments, originalScript, { stylePrompt, signal } = {}) {
        const GeminiWebClient = require('./gemini-web');

        const userPrompt = [
            INJECT_TAGS_SYSTEM_PROMPT,
            '',
            originalScript ? `Full script context:\n${originalScript}\n` : '',
            stylePrompt ? `Style guidance: ${stylePrompt}\n` : '',
            `Segments to analyze:\n${JSON.stringify(segments.map(s => ({
                id: s.id,
                text: s.text,
                title: s.title,
                pace: s.pace,
                existingTags: s.audioTags || [],
            })), null, 2)}`,
            '',
            'Respond ONLY with valid JSON. No markdown, no code fences, no extra text.',
        ].filter(Boolean).join('\n');

        const client = new GeminiWebClient();
        let page;

        try {
            page = await client.getPage();

            // Check abort signal before navigation
            if (signal?.aborted) throw new Error('ABORTED');

            await page.setViewport({ width: 1400, height: 900 });
            await client.navigateToChat(page);

            // Check sign-in state
            const signedIn = await client.checkSignedIn(page);
            if (!signedIn) {
                throw new Error(
                    'Gemini Web requires sign-in. Please log in to gemini.google.com ' +
                    'in your Chrome browser, then re-run.'
                );
            }

            if (signal?.aborted) throw new Error('ABORTED');

            // Send prompt
            await client.sendPrompt(page, userPrompt);

            if (signal?.aborted) throw new Error('ABORTED');

            // Wait for response
            const responseText = await client.waitForResponse(page, 120000);

            if (!responseText || responseText.length < 50) {
                throw new Error('Gemini Web returned an empty or too-short response');
            }

            // Parse JSON from the response
            // First try to clean markdown fences
            const cleaned = responseText
                .replace(/^```(?:json)?\s*|\s*```$/g, '')
                .trim();

            // Find JSON object in the response
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not find valid JSON in Gemini Web response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.segments || !Array.isArray(parsed.segments)) {
                throw new Error('Gemini Web returned invalid structure: missing segments array');
            }

            return parsed.segments;
        } catch (err) {
            if (err.message === 'ABORTED') {
                throw err;
            }
            throw new Error(`TTSPlanner: gemini-web failed — ${err.message}`);
        } finally {
            if (page) try { await page.close(); } catch {}
            try { await client.close(); } catch {}
        }
    }

    /**
     * Merge AI-enhanced tags back into original segment objects.
     * Preserves all original fields; overwrites text, audioTags, pace.
     * @private
     */
    _mergeInjectResults(originalSegments, enhancedSegments) {
        const enhancedMap = new Map();
        enhancedSegments.forEach((s, i) => {
            // Some models strip the id field — fall back by position
            const id = s.id != null ? s.id : (originalSegments[i] ? originalSegments[i].id : i + 1);
            enhancedMap.set(id, { ...s, id });
        });

        return originalSegments.map(orig => {
            const enh = enhancedMap.get(orig.id);
            if (!enh) {
                return { ...orig, tagsInjected: false };
            }

            return {
                ...orig,
                text: enh.text || orig.text,
                originalText: orig.text,
                audioTags: enh.audioTags || orig.audioTags || [],
                pace: enh.pace || orig.pace,
                tagsInjected: true,
                tone: enh.tone || null,
                estimatedDuration: orig.estimatedDuration,
                suggestedSplit: enh.suggestedSplit || null,
                sourceRef: orig.sourceRef || enh.sourceRef || null,
                // Keep original audioTags in a separate field if needed
                originalAudioTags: orig.audioTags || [],
            };
        });
    }

    /**
     * Create a default GoogleGenAI instance from env vars.
     * @private
     */
    _createDefaultGenAI() {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return null;
        try {
            return new GoogleGenAI({ apiKey });
        } catch {
            return null;
        }
    }

    /** @private */
    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

module.exports = TTSPlanner;
