'use strict';

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Answer a query using Google Search–grounded Gemini.
 * @param {import('../genai-client').GenAIClient} client
 * @param {object} opts
 * @param {string} opts.query — The question to answer
 * @param {string} [opts.model] — Model name (default: gemini-2.5-flash)
 * @returns {Promise<{answer: string, citations: Array<{title: string, uri: string, snippet: string}>, model: string}>}
 */
async function searchGrounding(client, { query, model = DEFAULT_MODEL }) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('search_grounding: "query" must be a non-empty string');
  }

  const { text, raw } = await client.generateContent({
    model,
    prompt: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const citations = [];
  const groundingMeta = raw?.candidates?.[0]?.groundingMetadata;
  if (groundingMeta?.groundingChunks) {
    for (const chunk of groundingMeta.groundingChunks) {
      citations.push({
        title: chunk.web?.title || '',
        uri: chunk.web?.uri || '',
        snippet: chunk.web?.snippet || '',
      });
    }
  }

  return { answer: text, citations, model };
}

module.exports = { searchGrounding };
