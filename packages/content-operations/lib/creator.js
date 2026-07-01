const { Logger, LLMClient } = require('@andy-toolforge/core');
const { ContentCreatorError } = require('./errors');

class ContentCreator {
    constructor(config = {}) {
        this.logger = config.logger || new Logger('ContentCreator');
        this.llmClient = config.llmClient || null;
    }

    async writeBlogPost(topic, options = {}) {
        if (!topic || typeof topic !== 'string') {
            throw new ContentCreatorError('topic must be a non-empty string', { topic });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for blog writing');
        }

        this.logger.info('writeBlogPost', { topic, options });

        const wordCount = options.wordCount || 1500;
        const tone = options.tone || 'informative';
        const language = options.language || 'vi';

        const prompt = `You are a blog writer. Write a blog post about "${topic}".

Constraints:
- Target word count: ~${wordCount} words
- Tone: ${tone}
- Language: ${language}
${options.targetAudience ? `- Target audience: ${options.targetAudience}` : ''}
${options.seoKeywords ? `- SEO keywords: ${options.seoKeywords.join(', ')}` : ''}

Return a JSON object with:
- title: string (H1, SEO-optimized)
- metaDescription: string (150-160 chars)
- slug: string (URL-friendly)
- content: string (full HTML body with h2, h3, p tags)
- estimatedReadingTime: number (minutes)
- keywordsUsed: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const post = typeof response === 'string' ? JSON.parse(response) : response;
            return { topic, ...post };
        } catch (err) {
            throw new ContentCreatorError('Failed to write blog post', {
                topic, originalError: err.message,
            });
        }
    }

    async writeScript(topic, duration = 60, format = 'youtube') {
        if (!topic || typeof topic !== 'string') {
            throw new ContentCreatorError('topic must be a non-empty string', { topic });
        }
        if (!Number.isInteger(duration) || duration < 15 || duration > 3600) {
            throw new ContentCreatorError('duration must be an integer between 15 and 3600', { duration });
        }
        const validFormats = ['youtube', 'tiktok', 'podcast', 'short'];
        if (!validFormats.includes(format)) {
            throw new ContentCreatorError(`format must be one of: ${validFormats.join(', ')}`, { format });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for script writing');
        }

        this.logger.info('writeScript', { topic, duration, format });

        const prompt = `You are a scriptwriter. Write a ${duration}-second ${format} script about "${topic}".

Return a JSON object with:
- hook: string (first 5-10 seconds hook)
- segments: array of { timestamp: string, duration: string, visual: string, dialogue: string }
- callToAction: string
- estimatedWordCount: number
- keyTakeaways: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const script = typeof response === 'string' ? JSON.parse(response) : response;
            return { topic, duration, format, ...script };
        } catch (err) {
            throw new ContentCreatorError('Failed to write script', {
                topic, originalError: err.message,
            });
        }
    }

    async writeSocialPost(content, platform = 'facebook', tone = 'professional') {
        if (!content || typeof content !== 'string') {
            throw new ContentCreatorError('content must be a non-empty string', { content });
        }
        const validPlatforms = ['facebook', 'twitter', 'linkedin', 'instagram', 'tiktok'];
        if (!validPlatforms.includes(platform)) {
            throw new ContentCreatorError(`platform must be one of: ${validPlatforms.join(', ')}`, { platform });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for social post writing');
        }

        this.logger.info('writeSocialPost', { platform, tone, contentLength: content.length });

        const prompt = `You are a social media copywriter. Repurpose this content into a ${platform} post with a ${tone} tone.

Original content: "${content}"

Return a JSON object with:
- post: string (platform-optimized post text)
- hashtags: string[] (3-5 platform-appropriate hashtags)
- bestPostingTime: string
- characterCount: number
- tips: string[] (2-3 tips)

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const post = typeof response === 'string' ? JSON.parse(response) : response;
            return { platform, ...post };
        } catch (err) {
            throw new ContentCreatorError('Failed to write social post', {
                platform, originalError: err.message,
            });
        }
    }

    async optimizeForSEO(content, platform = 'blog', keywords = []) {
        if (!content || typeof content !== 'string') {
            throw new ContentCreatorError('content must be a non-empty string', { content });
        }
        if (!Array.isArray(keywords)) {
            throw new ContentCreatorError('keywords must be an array', { keywords });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for SEO optimization');
        }

        this.logger.info('optimizeForSEO', { platform, keywordCount: keywords.length, contentLength: content.length });

        const prompt = `You are an SEO specialist. Optimize the following content for ${platform} SEO${keywords.length > 0 ? ` targeting keywords: ${keywords.join(', ')}` : ''}.

Content: "${content.slice(0, 4000)}"

Return a JSON object with:
- optimizedContent: string (improved version)
- seoScore: number (1-100)
- improvements: string[]
- keywordDensity: object (per keyword with percentage)
- missingElements: string[]
- recommendations: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { platform, ...result };
        } catch (err) {
            throw new ContentCreatorError('Failed to optimize for SEO', {
                platform, originalError: err.message,
            });
        }
    }

    async generateHashtags(topic, platform = 'tiktok', count = 5) {
        if (!topic || typeof topic !== 'string') {
            throw new ContentCreatorError('topic must be a non-empty string', { topic });
        }
        if (!Number.isInteger(count) || count < 1 || count > 30) {
            throw new ContentCreatorError('count must be an integer between 1 and 30', { count });
        }
        const validPlatforms = ['tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'youtube'];
        if (!validPlatforms.includes(platform)) {
            throw new ContentCreatorError(`platform must be one of: ${validPlatforms.join(', ')}`, { platform });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for hashtag generation');
        }

        this.logger.info('generateHashtags', { topic, platform, count });

        const prompt = `You are a hashtag strategist. Generate ${count} hashtags for a ${platform} post about "${topic}".

Return a JSON object with:
- hashtags: string[] (${count} hashtags without # prefix)
- categories: { highVolume: string[], niche: string[], brand: string[] }
- recommendation: string (best 3 to use)

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { topic, platform, ...result };
        } catch (err) {
            throw new ContentCreatorError('Failed to generate hashtags', {
                topic, platform, originalError: err.message,
            });
        }
    }

    async generateThumbnailIdeas(topic, platform = 'youtube') {
        if (!topic || typeof topic !== 'string') {
            throw new ContentCreatorError('topic must be a non-empty string', { topic });
        }
        const validPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
        if (!validPlatforms.includes(platform)) {
            throw new ContentCreatorError(`platform must be one of: ${validPlatforms.join(', ')}`, { platform });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for thumbnail ideation');
        }

        this.logger.info('generateThumbnailIdeas', { topic, platform });

        const prompt = `You are a thumbnail designer. Generate thumbnail ideas for a ${platform} video about "${topic}".

Return a JSON object with:
- ideas: array of { title: string, description: string, visualElements: string[], textOverlay: string, colorScheme: string, style: string }
- topPick: string
- compositionTips: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { topic, platform, ...result };
        } catch (err) {
            throw new ContentCreatorError('Failed to generate thumbnail ideas', {
                topic, platform, originalError: err.message,
            });
        }
    }

    async expandOutline(outline, depth = 2) {
        if (!outline || typeof outline !== 'string') {
            throw new ContentCreatorError('outline must be a non-empty string', { outline });
        }
        if (!Number.isInteger(depth) || depth < 1 || depth > 4) {
            throw new ContentCreatorError('depth must be an integer between 1 and 4', { depth });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for outline expansion');
        }

        this.logger.info('expandOutline', { outlineLength: outline.length, depth });

        const prompt = `You are a content expander. Expand the following outline to depth level ${depth}.

Outline: "${outline}"

Return a JSON object with:
- expandedOutline: string (detailed outline)
- sections: array of { heading: string, subheadings: string[], keyPoints: string[], suggestedWordCount: number }
- totalEstimatedWords: number

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { ...result };
        } catch (err) {
            throw new ContentCreatorError('Failed to expand outline', {
                originalError: err.message,
            });
        }
    }

    async suggestHeadlines(keywords, count = 5) {
        if (!Array.isArray(keywords) || keywords.length === 0) {
            throw new ContentCreatorError('keywords must be a non-empty array', { keywords });
        }
        if (!Number.isInteger(count) || count < 1 || count > 20) {
            throw new ContentCreatorError('count must be an integer between 1 and 20', { count });
        }
        if (!this.llmClient) {
            throw new ContentCreatorError('LLMClient is required for headline suggestions');
        }

        this.logger.info('suggestHeadlines', { keywords, count });

        const prompt = `You are a headline writer. Generate ${count} compelling headlines targeting keywords: ${keywords.join(', ')}.

Return a JSON object with:
- headlines: array of { headline: string, type: string, estimatedCTR: "high" | "medium" | "low", emotionalAppeal: string }
- bestPick: string
- tips: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { ...result };
        } catch (err) {
            throw new ContentCreatorError('Failed to suggest headlines', {
                originalError: err.message,
            });
        }
    }
}

module.exports = ContentCreator;
