const { Logger } = require('@andy-toolforge/core');

class MarketResearcher {
    constructor(config = {}) {
        this.llm = config.llmClient;
        this.logger = config.logger || new Logger('MarketResearcher');
    }

    /**
     * Crawl competitor data from a URL.
     * @param {string} url - Competitor website URL
     * @returns {Promise<object>} Competitor profile
     */
    async crawlCompetitor(url) {
        if (typeof url !== 'string' || url.trim().length === 0) {
            throw new Error('URL must be a non-empty string');
        }
        this._ensureLLM();

        const prompt = `You are a competitive intelligence analyst.

Competitor URL: "${url}"

Analyze this competitor based on what you know. Respond in JSON with this structure:
{
  "name": "Company name",
  "website": "${url}",
  "description": "What they do (1-2 sentences)",
  "products": ["Product 1", "Product 2"],
  "targetMarket": "Their target audience",
  "pricingModel": "e.g. freemium, subscription, enterprise",
  "estimatedScale": "e.g. startup, mid-market, enterprise",
  "keyStrengths": ["Strength 1", "Strength 2"],
  "keyWeaknesses": ["Weakness 1", "Weakness 2"]
}`;

        const result = await this.llm.chat('', prompt, true);
        const profile = this._safeJsonParse(result, {
            name: url,
            website: url,
            description: '',
            products: [],
            targetMarket: '',
            pricingModel: '',
            estimatedScale: '',
            keyStrengths: [],
            keyWeaknesses: [],
        });

        this.logger.info(`Crawled competitor: "${profile.name}"`);
        return profile;
    }

    /**
     * Analyze pricing data from competitors.
     * @param {Array<object>} data - Array of pricing entries
     * @returns {Promise<object>} Pricing analysis
     */
    async analyzePricing(data) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Pricing data must be a non-empty array');
        }
        this._ensureLLM();

        const dataStr = JSON.stringify(data, null, 2);
        const prompt = `You are a pricing strategy analyst.

Analyze this competitor pricing data and provide strategic insights:

${dataStr}

Respond in JSON with this structure:
{
  "summary": "Overall pricing landscape (1-2 sentences)",
  "priceRange": { "min": 0, "max": 0, "currency": "USD" },
  "commonModels": ["freemium", "subscription"],
  "competitors": [
    {
      "name": "Competitor name",
      "pricePoint": "premium|mid-range|budget",
      "strategy": "Description of their pricing approach"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "marketPosition": "Description of where pricing fits in market"
}`;

        const result = await this.llm.chat('', prompt, true);
        const analysis = this._safeJsonParse(result, {
            summary: '',
            priceRange: { min: 0, max: 0, currency: 'USD' },
            commonModels: [],
            competitors: [],
            recommendations: [],
            marketPosition: '',
        });

        this.logger.info(`Analyzed pricing for ${data.length} entries`);
        return analysis;
    }

    /**
     * Generate SWOT analysis from competitor data.
     * @param {Array<object>} competitorData - Array of competitor profiles
     * @returns {Promise<object>} SWOT analysis
     */
    async swotAnalysis(competitorData) {
        if (!Array.isArray(competitorData) || competitorData.length === 0) {
            throw new Error('Competitor data must be a non-empty array');
        }
        this._ensureLLM();

        const dataStr = JSON.stringify(competitorData, null, 2);
        const prompt = `You are a strategic business analyst.

Perform a SWOT analysis based on this competitive data:

${dataStr}

Respond in JSON with this structure:
{
  "summary": "Overall competitive landscape summary",
  "strengths": [
    { "factor": "Strength description", "impact": "high|medium|low", "source": "Which competitor(s)" }
  ],
  "weaknesses": [
    { "factor": "Weakness description", "impact": "high|medium|low", "source": "Which competitor(s)" }
  ],
  "opportunities": [
    { "factor": "Opportunity description", "potential": "high|medium|low", "actionable": true }
  ],
  "threats": [
    { "factor": "Threat description", "severity": "high|medium|low", "urgency": "immediate|short-term|long-term" }
  ],
  "recommendations": ["Strategic recommendation 1", "Strategic recommendation 2"]
}`;

        const result = await this.llm.chat('', prompt, true);
        const swot = this._safeJsonParse(result, {
            summary: '',
            strengths: [],
            weaknesses: [],
            opportunities: [],
            threats: [],
            recommendations: [],
        });

        this.logger.info(`Generated SWOT from ${competitorData.length} competitors`);
        return swot;
    }

    /**
     * Generate a comprehensive business analysis report.
     * @param {object} findings - All findings to include in the report
     * @param {string} format - Output format: 'markdown' | 'plain'
     * @returns {Promise<string>} Formatted report
     */
    async generateReport(findings, format = 'markdown') {
        if (!findings || typeof findings !== 'object') {
            throw new Error('Findings must be a non-empty object');
        }
        if (!['markdown', 'plain'].includes(format)) {
            throw new Error('Format must be one of: markdown, plain');
        }
        this._ensureLLM();

        const dataStr = JSON.stringify(findings, null, 2);
        const prompt = `You are a business intelligence report writer.

Generate a professional ${format} business analysis report from this data:

${dataStr}

The report should include:
1. Executive summary
2. Competitive landscape overview
3. Key findings and insights
4. Strategic recommendations
5. Action items with priority

Use clear headings and bullet points. Format as ${format}.`;

        const result = await this.llm.chat('', prompt, false);
        const report = result.trim();

        this.logger.info(`Generated ${format} report (${report.length} chars)`);
        return report;
    }

    /**
     * Analyze market trends for given keywords.
     * @param {Array<string>} keywords - Keywords to analyze
     * @returns {Promise<object>} Trend analysis
     */
    async trackTrends(keywords) {
        if (!Array.isArray(keywords) || keywords.length === 0) {
            throw new Error('Keywords must be a non-empty array');
        }
        this._ensureLLM();

        const keywordList = keywords.map(k => `- ${k}`).join('\n');
        const prompt = `You are a market trends analyst.

Analyze current market trends for these keywords:

${keywordList}

Respond in JSON with this structure:
{
  "summary": "Overall trend analysis summary",
  "keywords": [
    {
      "keyword": "keyword name",
      "trend": "rising|stable|declining",
      "momentum": "high|medium|low",
      "notes": "Analysis of this keyword's trajectory"
    }
  ],
  "emergingPatterns": ["Pattern 1", "Pattern 2"],
  "industryInsights": ["Insight 1", "Insight 2"],
  "recommendedActions": ["Action 1", "Action 2"]
}`;

        const result = await this.llm.chat('', prompt, true);
        const trends = this._safeJsonParse(result, {
            summary: '',
            keywords: [],
            emergingPatterns: [],
            industryInsights: [],
            recommendedActions: [],
        });

        this.logger.info(`Tracked trends for ${keywords.length} keywords`);
        return trends;
    }

    // ---- Private helpers ----

    _ensureLLM() {
        if (!this.llm || typeof this.llm.chat !== 'function') {
            throw new Error('LLMClient is required. Pass { llmClient } to constructor.');
        }
    }

    _safeJsonParse(raw, defaults) {
        try {
            return JSON.parse(raw);
        } catch {
            this.logger.warn('LLM returned invalid JSON, using defaults');
            return defaults;
        }
    }
}

module.exports = MarketResearcher;
