'use strict';

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Extract structured JSON from content using Gemini's responseSchema.
 * @param {import('../genai-client').GenAIClient} client
 * @param {object} opts
 * @param {string} opts.content — The text content to extract from
 * @param {object} opts.schema — JSON Schema describing the desired output shape
 * @param {string} [opts.instruction] — Optional extraction instruction (e.g. "Extract key facts only")
 * @param {string} [opts.model] — Model name (default: gemini-2.5-flash)
 * @returns {Promise<{data: object, model: string}>}
 */
async function extractStructured(client, { content, schema, instruction, model = DEFAULT_MODEL }) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('extract_structured: "content" must be a non-empty string');
  }
  if (!schema || typeof schema !== 'object') {
    throw new Error('extract_structured: "schema" must be a valid JSON Schema object');
  }

  const prompt = instruction
    ? `${instruction}\n\n${content}`
    : `Extract structured data from this content according to the specified schema.\n\n${content}`;

  const { text } = await client.generateContent({
    model,
    prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { data, model };
}

module.exports = { extractStructured };
