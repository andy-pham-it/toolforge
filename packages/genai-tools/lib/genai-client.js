'use strict';

const { GoogleGenAI } = require('@google/genai');

class GenAIClient {
  constructor(apiKey) {
    apiKey = apiKey || GenAIClient.resolveApiKey();
    if (!apiKey) {
      throw new Error('GenAIClient: GEMINI_API_KEY or GOOGLE_API_KEY must be set');
    }
    this._client = new GoogleGenAI({ apiKey });
  }

  static resolveApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  /**
   * Generate content via the specified model.
   * @param {object} opts
   * @param {string} opts.model — Model name (e.g. 'gemini-2.5-flash')
   * @param {string} opts.prompt — User prompt text
   * @param {object} [opts.config] — Additional config (tools, responseSchema, etc.)
   * @returns {Promise<{text: string, raw: object}>}
   */
  async generateContent({ model, prompt, config = {} }) {
    const response = await this._client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config,
    });
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, raw: response };
  }
}

module.exports = { GenAIClient };
