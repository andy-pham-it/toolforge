const { Logger, LLMClient } = require('@andy-toolforge/core');
const { ContentPlannerError } = require('./errors');

class ContentPlanner {
    constructor(config = {}) {
        this.logger = config.logger || new Logger('ContentPlanner');
        this.llmClient = config.llmClient || null;
    }

    async buildCalendar(niche, frequency = 'weekly', options = {}) {
        if (!niche || typeof niche !== 'string') {
            throw new ContentPlannerError('niche must be a non-empty string', { niche });
        }
        const validFrequencies = ['daily', 'weekly', 'monthly'];
        if (!validFrequencies.includes(frequency)) {
            throw new ContentPlannerError(`frequency must be one of: ${validFrequencies.join(', ')}`, { frequency });
        }
        if (!this.llmClient) {
            throw new ContentPlannerError('LLMClient is required for calendar generation');
        }

        this.logger.info('buildCalendar', { niche, frequency, options });

        const postCount = frequency === 'daily' ? 7 : frequency === 'weekly' ? 4 : 4;
        const prompt = `You are a content calendar strategist. Build a ${frequency} content calendar for the "${niche}" niche${options.period ? ` for ${options.period}` : ''}.

Generate ${postCount} content slots. Return a JSON array of calendar items with:
- date: string (relative, e.g. "Mon", "Week 1")
- title: string
- format: "blog" | "video" | "social" | "podcast" | "infographic"
- goal: "awareness" | "engagement" | "conversion" | "education"
- notes: string (brief context)

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const calendar = typeof response === 'string' ? JSON.parse(response) : response;
            return { calendar, niche, frequency };
        } catch (err) {
            throw new ContentPlannerError('Failed to build calendar', {
                niche, frequency, originalError: err.message,
            });
        }
    }

    async createContentStrategy(niche, goals = []) {
        if (!niche || typeof niche !== 'string') {
            throw new ContentPlannerError('niche must be a non-empty string', { niche });
        }
        if (!Array.isArray(goals)) {
            throw new ContentPlannerError('goals must be an array', { goals });
        }
        if (!this.llmClient) {
            throw new ContentPlannerError('LLMClient is required for strategy generation');
        }

        this.logger.info('createContentStrategy', { niche, goals });

        const prompt = `You are a content strategist. Create a comprehensive content strategy for the "${niche}" niche.

Goals: ${goals.length > 0 ? goals.join(', ') : '(General growth)'}

Return a JSON object with:
- mission: string (one-sentence content mission)
- targetAudience: string
- contentPillars: string[] (3-5 pillars)
- recommendedFormats: string[]
- publishingCadence: string
- distributionChannels: string[]
- successMetrics: string[]
- competitiveAngle: string

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const strategy = typeof response === 'string' ? JSON.parse(response) : response;
            return { niche, ...strategy };
        } catch (err) {
            throw new ContentPlannerError('Failed to create content strategy', {
                niche, originalError: err.message,
            });
        }
    }

    async generateBatchPlan(calendar, weekRange = 1) {
        if (!Array.isArray(calendar) || calendar.length === 0) {
            throw new ContentPlannerError('calendar must be a non-empty array', { calendar });
        }
        if (!Number.isInteger(weekRange) || weekRange < 1) {
            throw new ContentPlannerError('weekRange must be a positive integer', { weekRange });
        }
        if (!this.llmClient) {
            throw new ContentPlannerError('LLMClient is required for batch planning');
        }

        this.logger.info('generateBatchPlan', { calendarLength: calendar.length, weekRange });

        const prompt = `You are a production planner. Create a batch production plan for the following ${weekRange}-week content calendar:

${calendar.map((item, i) => `${i + 1}. [${item.date}] ${item.title} (${item.format})`).join('\n')}

Return a JSON object with:
- productionOrder: array of { day: string, task: string, assignee: string, estimatedHours: number }
- dependencies: string[]
- totalEstimatedHours: number
- bottlenecks: string[]
- recommendations: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const plan = typeof response === 'string' ? JSON.parse(response) : response;
            return { plan, weekRange };
        } catch (err) {
            throw new ContentPlannerError('Failed to generate batch plan', {
                originalError: err.message,
            });
        }
    }

    async suggestOptimalTimes(targetAudience, platforms = []) {
        if (!targetAudience || typeof targetAudience !== 'string') {
            throw new ContentPlannerError('targetAudience must be a non-empty string', { targetAudience });
        }
        if (!Array.isArray(platforms)) {
            throw new ContentPlannerError('platforms must be an array', { platforms });
        }
        if (!this.llmClient) {
            throw new ContentPlannerError('LLMClient is required for optimal time suggestion');
        }

        this.logger.info('suggestOptimalTimes', { targetAudience, platforms });

        const platformList = platforms.length > 0
            ? platforms.join(', ')
            : 'YouTube, TikTok, Facebook, Blog';

        const prompt = `You are a social media timing analyst. Suggest optimal posting times for "${targetAudience}" on these platforms: ${platformList}.

Return a JSON object with:
- recommendations: array of { platform: string, bestTime: string, bestDay: string, rationale: string }
- generalAdvice: string

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const data = typeof response === 'string' ? JSON.parse(response) : response;
            return { targetAudience, ...data };
        } catch (err) {
            throw new ContentPlannerError('Failed to suggest optimal times', {
                originalError: err.message,
            });
        }
    }
}

module.exports = ContentPlanner;
