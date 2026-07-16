'use strict';

const { GenAIClient } = require('@andy-toolforge/genai-tools');
const { LLMClient } = require('@andy-toolforge/core');

class StockLLM {
    /**
     * @param {object} [config]
     * @param {object} [config.quickClient] - Injected quick client (for testing)
     * @param {object} [config.deepClient] - Injected deep client (for testing)
     * @param {string} [config.deepProvider='gemini'] - Provider for deepChat ('gemini' | 'groq')
     * @param {string} [config.deepModel='gemini-2.5-flash'] - Model for deepChat
     */
    constructor(config = {}) {
        this._quick = config.quickClient || new GenAIClient(config.genaiKey);
        this._deep = config.deepClient || new LLMClient({
            provider: config.deepProvider || 'gemini',
            apiKey: config.deepApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
            model: config.deepModel || 'gemini-2.5-flash',
        });
    }

    /**
     * Quick chat — lightweight response via GenAIClient (gemini-3.1-flash-lite).
     * @param {string} systemPrompt
     * @param {string} userContent
     * @returns {Promise<string>}
     */
    async quickChat(systemPrompt, userContent) {
        const prompt = `${systemPrompt}\n\n${userContent}`;
        const { text } = await this._quick.generateContent({
            model: 'gemini-3.1-flash-lite',
            prompt,
        });
        return text;
    }

    /**
     * Deep chat — full LLM response via core LLMClient.
     * @param {string} systemPrompt
     * @param {string} userContent
     * @returns {Promise<string>}
     */
    async deepChat(systemPrompt, userContent) {
        return this._deep.chat(systemPrompt, userContent);
    }
}

module.exports = { StockLLM };
