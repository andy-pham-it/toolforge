const { Logger, LLMClient } = require('@andy-toolforge/core');
const { ContentResearcherError } = require('./errors');

class ContentResearcher {
    constructor(config = {}) {
        this.logger = config.logger || new Logger('ContentResearcher');
        this.llmClient = config.llmClient || null;
        this.browserManager = config.browserManager || null;
    }

    async discoverTrends(niche, platform = 'all', options = {}) {
        if (!niche || typeof niche !== 'string') {
            throw new ContentResearcherError('niche must be a non-empty string', { niche });
        }
        if (!this.llmClient) {
            throw new ContentResearcherError('LLMClient is required for trend discovery');
        }

        this.logger.info('discoverTrends', { niche, platform, options });

        const prompt = `You are a trend researcher. Analyze current trends in the "${niche}" niche${platform !== 'all' ? ` on ${platform}` : ''}${options.region ? ` in ${options.region}` : ''}.

Return a JSON array of trend objects with these fields:
- name: string (trend name)
- description: string (brief description)
- momentum: "rising" | "stable" | "declining"
- relatedKeywords: string[] (3-5 related keywords)

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const trends = typeof response === 'string' ? JSON.parse(response) : response;
            return { trends, niche, platform };
        } catch (err) {
            throw new ContentResearcherError('Failed to discover trends', {
                niche, platform, originalError: err.message,
            });
        }
    }

    async analyzeKeywords(niche, language = 'vi') {
        if (!niche || typeof niche !== 'string') {
            throw new ContentResearcherError('niche must be a non-empty string', { niche });
        }
        if (!this.llmClient) {
            throw new ContentResearcherError('LLMClient is required for keyword analysis');
        }

        this.logger.info('analyzeKeywords', { niche, language });

        const prompt = `You are a keyword researcher. Analyze the "${niche}" niche for ${language} language content.

Return a JSON object with:
- primaryKeywords: array of { keyword: string, volume: "high" | "medium" | "low", difficulty: number (1-100) }
- longTailKeywords: string[] (5-10 long-tail variations)
- suggestedTags: string[] (5-8 tags)

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const data = typeof response === 'string' ? JSON.parse(response) : response;
            return { ...data, niche, language };
        } catch (err) {
            throw new ContentResearcherError('Failed to analyze keywords', {
                niche, language, originalError: err.message,
            });
        }
    }

    async analyzeCompetitor(url) {
        if (!url || typeof url !== 'string') {
            throw new ContentResearcherError('url must be a non-empty string', { url });
        }
        if (!this.llmClient) {
            throw new ContentResearcherError('LLMClient is required for competitor analysis');
        }

        this.logger.info('analyzeCompetitor', { url });

        let pageContent = '';
        if (this.browserManager) {
            try {
                const page = await this.browserManager.newPage();
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
                pageContent = await page.evaluate(() => document.body.innerText.slice(0, 5000));
                await page.close();
            } catch {
                this.logger.warn('analyzeCompetitor', 'Browser fetch failed, using LLM only');
            }
        }

        const prompt = `You are a competitor analyst. Analyze this content from "${url}":

${pageContent ? `--- Page content (first 5000 chars) ---\n${pageContent}\n---` : '(No page content available — analyze based on URL only)'}

Return a JSON object with:
- contentStrategy: string (brief analysis of their approach)
- strengths: string[]
- weaknesses: string[]
- estimatedAudience: string
- contentTypeMix: { written: number(%), video: number(%), other: number(%) }
- recommendedActions: string[] (3-5)

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const analysis = typeof response === 'string' ? JSON.parse(response) : response;
            return { url, ...analysis };
        } catch (err) {
            throw new ContentResearcherError('Failed to analyze competitor', {
                url, originalError: err.message,
            });
        }
    }

    async findContentGaps(niche, competitors = []) {
        if (!niche || typeof niche !== 'string') {
            throw new ContentResearcherError('niche must be a non-empty string', { niche });
        }
        if (!Array.isArray(competitors)) {
            throw new ContentResearcherError('competitors must be an array', { competitors });
        }
        if (!this.llmClient) {
            throw new ContentResearcherError('LLMClient is required for gap analysis');
        }

        this.logger.info('findContentGaps', { niche, competitorCount: competitors.length });

        const competitorList = competitors.length > 0
            ? competitors.map((c, i) => `${i + 1}. ${c}`).join('\n')
            : '(No specific competitors provided)';

        const prompt = `You are a content strategist. Analyze content gaps in the "${niche}" niche.

Competitors: ${competitorList}

Return a JSON object with:
- gaps: array of { topic: string, whyUncovered: string, opportunity: "high" | "medium" | "low", suggestedFormat: string }
- topOpportunities: string[] (3 topics most worth pursuing)
- marketTrend: string

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const data = typeof response === 'string' ? JSON.parse(response) : response;
            return { niche, ...data };
        } catch (err) {
            throw new ContentResearcherError('Failed to find content gaps', {
                niche, originalError: err.message,
            });
        }
    }

    async generateContentIdeas(niche, count = 10) {
        if (!niche || typeof niche !== 'string') {
            throw new ContentResearcherError('niche must be a non-empty string', { niche });
        }
        if (!Number.isInteger(count) || count < 1 || count > 50) {
            throw new ContentResearcherError('count must be an integer between 1 and 50', { count });
        }
        if (!this.llmClient) {
            throw new ContentResearcherError('LLMClient is required for idea generation');
        }

        this.logger.info('generateContentIdeas', { niche, count });

        const prompt = `You are a content strategist. Generate ${count} content ideas for the "${niche}" niche.

Return a JSON array of idea objects with these fields:
- title: string (catchy working title)
- format: "blog" | "video" | "infographic" | "podcast" | "social"
- targetAudience: string
- estimatedEffort: "easy" | "medium" | "hard"
- whyWorks: string (1 sentence)
- primaryKeyword: string

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const ideas = typeof response === 'string' ? JSON.parse(response) : response;
            return { ideas, niche, count };
        } catch (err) {
            throw new ContentResearcherError('Failed to generate content ideas', {
                niche, originalError: err.message,
            });
        }
    }
}

module.exports = ContentResearcher;
