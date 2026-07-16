'use strict';

const { GenAIClient, GenAIAdapter } = require('@andy-toolforge/genai-tools');
const { LLMClient, OpenAIAdapter } = require('@andy-toolforge/core');

class StockLLM {
    /**
     * @param {object} [config]
     * @param {object} [config.quickClient] - Injected quick client (for testing, GenAIClient-compatible)
     * @param {object} [config.deepClient] - Injected deep client (for testing, LLMClient-compatible)
     * @param {string} [config.deepProvider='gemini'] - Provider for deepChat ('gemini' | 'groq')
     * @param {string} [config.deepModel='gemini-2.5-flash'] - Model for deepChat
     * @param {string} [config.genaiKey] - API key for GenAI quick client (falls back to GEMINI_API_KEY)
     * @param {string} [config.deepApiKey] - API key for deep client
     */
    constructor(config = {}) {
        this._quick = config.quickClient || new GenAIClient(config.genaiKey);

        this._deep = config.deepClient || (() => {
            const deepApiKey = config.deepApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
            const adapters = [];

            if (config.deepProvider === 'gemini') {
                adapters.push(new GenAIAdapter({
                    apiKey: deepApiKey,
                    model: config.deepModel || 'gemini-2.5-flash',
                }));
            } else {
                adapters.push(new OpenAIAdapter({
                    provider: config.deepProvider || 'gemini',
                    apiKey: deepApiKey,
                    model: config.deepModel || 'gemini-2.5-flash',
                }));
            }

            const groqKey = process.env.GROQ_API_KEY;
            if (groqKey && config.deepProvider !== 'groq') {
                adapters.push(new OpenAIAdapter({
                    provider: 'groq',
                    apiKey: groqKey,
                    model: 'llama-3.3-70b-versatile',
                }));
            }

            return new LLMClient({ adapters });
        })();
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
     * Deep chat — full LLM response via CoreLLMClient (with adapter fallback).
     * @param {string} systemPrompt
     * @param {string} userContent
     * @returns {Promise<string>}
     */
    async deepChat(systemPrompt, userContent) {
        return this._deep.chat(systemPrompt, userContent);
    }
}

module.exports = { StockLLM };
