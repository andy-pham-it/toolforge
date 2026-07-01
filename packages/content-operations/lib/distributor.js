const { Logger, LLMClient } = require('@andy-toolforge/core');
const { ContentDistributorError } = require('./errors');

class ContentDistributor {
    constructor(config = {}) {
        this.logger = config.logger || new Logger('ContentDistributor');
        this.llmClient = config.llmClient || null;
        this.browserManager = config.browserManager || null;
        this.jobQueue = config.jobQueue || null;
    }

    async repurposeContent(source, targetPlatforms = []) {
        if (!source || typeof source !== 'string') {
            throw new ContentDistributorError('source must be a non-empty string', { source });
        }
        if (!Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
            throw new ContentDistributorError('targetPlatforms must be a non-empty array', { targetPlatforms });
        }
        if (!this.llmClient) {
            throw new ContentDistributorError('LLMClient is required for content repurposing');
        }

        this.logger.info('repurposeContent', { sourceLength: source.length, targetPlatforms });

        const prompt = `You are a content repurposing strategist. Repurpose the following content for these platforms: ${targetPlatforms.join(', ')}.

Source content: "${source.slice(0, 3000)}"

Return a JSON object with:
- platformPlans: array of { platform: string, format: string, adaptedContent: string, adjustments: string[], estimatedTime: number }
- crossPromotionIdeas: string[]
- bestPlatform: string (first to publish)
- notes: string

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const plan = typeof response === 'string' ? JSON.parse(response) : response;
            return { source: source.slice(0, 100), ...plan };
        } catch (err) {
            throw new ContentDistributorError('Failed to repurpose content', {
                platforms: targetPlatforms, originalError: err.message,
            });
        }
    }

    async batchSchedule(contents, schedule = {}) {
        if (!Array.isArray(contents) || contents.length === 0) {
            throw new ContentDistributorError('contents must be a non-empty array', { contents });
        }

        this.logger.info('batchSchedule', {
            contentCount: contents.length,
            schedule,
        });

        const timeSlot = schedule.timeSlot || '09:00';
        const timezone = schedule.timezone || 'Asia/Ho_Chi_Minh';
        const intervalHours = schedule.intervalHours || 24;

        const scheduled = contents.map((content, i) => {
            const date = new Date();
            date.setDate(date.getDate() + i);
            date.setHours(parseInt(timeSlot.split(':')[0], 10));
            date.setMinutes(parseInt(timeSlot.split(':')[1], 10));
            const hoursOffset = i * intervalHours;
            date.setTime(date.getTime() + hoursOffset * 60 * 60 * 1000);

            return {
                content: content.title || content,
                scheduledAt: date.toISOString(),
                position: i + 1,
                total: contents.length,
            };
        });

        if (this.jobQueue) {
            for (const item of scheduled) {
                this.jobQueue.enqueue(() => {
                    this.logger.info('Publish scheduled content', { title: item.content, time: item.scheduledAt });
                });
            }
        }

        return {
            scheduled,
            timezone,
            totalItems: contents.length,
        };
    }

    async crossPost(platforms = [], content) {
        if (!Array.isArray(platforms) || platforms.length === 0) {
            throw new ContentDistributorError('platforms must be a non-empty array', { platforms });
        }
        if (!content || typeof content !== 'string') {
            throw new ContentDistributorError('content must be a non-empty string', { content });
        }
        if (!this.llmClient) {
            throw new ContentDistributorError('LLMClient is required for cross-posting');
        }

        this.logger.info('crossPost', { platforms, contentLength: content.length });

        const prompt = `You are a cross-posting specialist. Adapt the following content for each platform and suggest the best posting approach.

Content: "${content.slice(0, 2000)}"
Platforms: ${platforms.join(', ')}

Return a JSON object with:
- adaptations: array of { platform: string, adaptedText: string, characterCount: number, notes: string }
- postingOrder: string[]
- optimalTimes: string[]
- warnings: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { ...result };
        } catch (err) {
            throw new ContentDistributorError('Failed to cross-post', {
                platforms, originalError: err.message,
            });
        }
    }

    async generateRepurposePlan(source, targetFormats = []) {
        if (!source || typeof source !== 'string') {
            throw new ContentDistributorError('source must be a non-empty string', { source });
        }
        if (!Array.isArray(targetFormats) || targetFormats.length === 0) {
            throw new ContentDistributorError('targetFormats must be a non-empty array', { targetFormats });
        }
        if (!this.llmClient) {
            throw new ContentDistributorError('LLMClient is required for repurpose planning');
        }

        this.logger.info('generateRepurposePlan', { sourceLength: source.length, targetFormats });

        const prompt = `You are a content repurpose strategist. Create a plan to repurpose the following source content into these formats: ${targetFormats.join(', ')}.

Source: "${source.slice(0, 2000)}"

Return a JSON object with:
- plan: array of { format: string, steps: string[], tools: string[], estimatedTimeMinutes: number, difficulty: "easy" | "medium" | "hard" }
- quickestWins: string[]
- totalEstimatedTime: number
- recommendations: string[]

Return ONLY valid JSON. No markdown. No code fences.`;

        try {
            const response = await this.llmClient.chat(prompt);
            const result = typeof response === 'string' ? JSON.parse(response) : response;
            return { ...result };
        } catch (err) {
            throw new ContentDistributorError('Failed to generate repurpose plan', {
                formats: targetFormats, originalError: err.message,
            });
        }
    }
}

module.exports = ContentDistributor;
