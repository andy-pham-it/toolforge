const { LLMClient } = require('@andy-toolforge/core');

class ContentArbitrageEngine {
    constructor(llmClient) {
        if (!llmClient || typeof llmClient.chat !== 'function') {
            throw new Error('ContentArbitrageEngine requires an LLMClient instance with a chat() method');
        }
        this.llm = llmClient;
    }

    async expandToBlog(source) {
        if (!source || typeof source !== 'string' || !source.trim()) {
            throw new Error('expandToBlog: source must be a non-empty string');
        }
        const systemPrompt = `You are an expert content writer. Convert the given source content into a polished, SEO-optimized blog post.

Return a JSON object with the following structure:
{
  "title": "Catchy, keyword-rich H1 title",
  "meta": "Meta description under 160 characters for SEO",
  "content": "Full blog post body with proper H2 and H3 subsections, 2000+ words, formatted in markdown",
  "imagePrompts": ["array of 3-5 DALL-E prompt strings for featured and section images"]
}

Rules:
- Use H1 for title only, H2 for main sections, H3 for subsections
- Write at least 2000 words of content
- Include a meta description under 160 characters
- Generate 3-5 image prompts for visuals throughout the post
- Maintain a professional yet accessible tone`;

        const result = await this.llm.chat(systemPrompt, source, true);
        try {
            return JSON.parse(result);
        } catch (e) {
            throw new Error(`LLM returned invalid JSON: ${result.slice(0, 100)}`);
        }
    }

    async expandToThread(source) {
        if (!source || typeof source !== 'string' || !source.trim()) {
            throw new Error('expandToThread: source must be a non-empty string');
        }
        const systemPrompt = `You are a Twitter/X content strategist. Convert the given source content into a viral thread.

Return a JSON object with the following structure:
{
  "hook": "The first tweet — must grab attention, under 280 characters",
  "replies": [
    { "number": 1, "text": "Tweet content under 280 chars" },
    { "number": 2, "text": "..." }
  ]
}

Rules:
- Hook tweet must be under 280 characters and use a strong hook style (question, bold claim, or surprising stat)
- Include 5-10 reply tweets numbered sequentially
- Each reply must be under 280 characters
- Use line breaks within tweets for readability where appropriate
- Maintain a conversational, authentic voice
- End with a CTA tweet inviting engagement`;

        const result = await this.llm.chat(systemPrompt, source, true);
        try {
            return JSON.parse(result);
        } catch (e) {
            throw new Error(`LLM returned invalid JSON: ${result.slice(0, 100)}`);
        }
    }

    async expandToShort(source) {
        if (!source || typeof source !== 'string' || !source.trim()) {
            throw new Error('expandToShort: source must be a non-empty string');
        }
        const systemPrompt = `You are a TikTok scriptwriter. Convert the given source content into a 60-90 second video script.

Return a JSON object with the following structure:
{
  "hook": "First 3 seconds — must stop the scroll (1 sentence)",
  "patternInterrupt": "Visual or audio change that keeps attention (1-2 sentences)",
  "body": "Main content delivery — 30-45 seconds of script",
  "cta": "Call to action — last 5 seconds",
  "estimatedDuration": 75
}

Rules:
- Hook under 10 words, must create curiosity or tension
- Pattern interrupt shifts pacing or visual style midway
- Body delivers the core value in short, punchy sentences
- CTA is specific (e.g. "Follow for more" not just "Like and subscribe")
- Target 60-90 seconds total
- Write in conversational, spoken-word style — not formal prose
- Use / for short pauses, // for longer breaks`;

        const result = await this.llm.chat(systemPrompt, source, true);
        try {
            return JSON.parse(result);
        } catch (e) {
            throw new Error(`LLM returned invalid JSON: ${result.slice(0, 100)}`);
        }
    }

    async expandToPost(source) {
        if (!source || typeof source !== 'string' || !source.trim()) {
            throw new Error('expandToPost: source must be a non-empty string');
        }
        const systemPrompt = `You are a LinkedIn/Facebook content strategist. Convert the given source content into a professional social media post.

Return a JSON object with the following structure:
{
  "body": "Post content — 150-300 words, formatted with line breaks",
  "engagementQuestion": "A question to drive comments and discussion"
}

Rules:
- Write 150-300 words in a professional, authoritative tone
- Open with a strong hook or insight
- Use short paragraphs and line breaks for readability
- Include specific numbers, data points, or examples from the source
- End with an authentic engagement question that invites thoughtful comments
- Never use hashtag spam — at most 3-5 relevant tags`;

        const result = await this.llm.chat(systemPrompt, source, true);
        try {
            return JSON.parse(result);
        } catch (e) {
            throw new Error(`LLM returned invalid JSON: ${result.slice(0, 100)}`);
        }
    }

    async translateTo(targetLang, content) {
        if (!content || typeof content !== 'string' || !content.trim()) {
            throw new Error('translateTo: content must be a non-empty string');
        }
        const validLangs = ['en', 'vi', 'jp', 'kr'];
        if (!validLangs.includes(targetLang)) {
            throw new Error(`translateTo: targetLang must be one of: ${validLangs.join(', ')}`);
        }
        const langNames = { en: 'English', vi: 'Vietnamese', jp: 'Japanese', kr: 'Korean' };
        const systemPrompt = `You are a professional translator. Translate the following content to ${langNames[targetLang]} (${targetLang}).

Rules:
- Preserve the original meaning, tone, and formatting
- Adapt idioms and cultural references appropriately
- Maintain markdown formatting if present
- Return ONLY the translated text, no explanations or notes`;

        return this.llm.chat(systemPrompt, content);
    }
}

module.exports = ContentArbitrageEngine;
