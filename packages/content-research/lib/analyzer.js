const { LLMClient } = require('./llm');
const { BrowserManager } = require('@andy-toolforge/core');

class CompetitorAnalyzer {
    constructor(config) {
        this.llm = new LLMClient(config);
        this.browserManager = new BrowserManager();
    }

    async analyze(competitorUrl, analysisScope, lang) {
        if (!competitorUrl || !analysisScope) {
            throw new Error('Missing required arguments: competitorUrl, analysisScope');
        }

        let browser;
        try {
            browser = await this.browserManager.launch();
            const page = await browser.newPage();
            await page.goto(competitorUrl, { waitUntil: 'networkidle2' });
            const pageContent = await page.content();
            return await this.llm.analyzeCompetitor(pageContent, analysisScope, lang);
        } finally {
            if (browser) {
                await this.browserManager.close();
            }
        }
    }
}

module.exports = CompetitorAnalyzer;
