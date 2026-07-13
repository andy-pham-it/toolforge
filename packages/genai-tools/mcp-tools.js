'use strict';

/**
 * @andy-toolforge/genai-tools MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp.
 *
 * Tools:
 *   search_grounding     — Answer a query using Google Search–grounded Gemini
 *   extract_structured   — Extract structured JSON from text via Gemini responseSchema
 */

const { GenAIClient, searchGrounding, extractStructured } = require('./lib');

// ---------------------------------------------------------------------------
// search_grounding
// ---------------------------------------------------------------------------
const searchGroundingDef = {
    name: 'search_grounding',
    description: 'Answer a query using Google Search–grounded Gemini. Returns an answer with cited sources. Uses Gemini\'s built-in Google Search grounding — not a vector or keyword search.',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The question or topic to search for. Be specific for best results.' },
            model: { type: 'string', description: 'Model override (default: gemini-2.5-flash). Also supports gemini-3.1-flash-lite for faster/cheaper responses.', default: 'gemini-2.5-flash' },
        },
        required: ['query'],
    },
};

async function searchGroundingHandler(llm, args) {
    const { query, model } = args;
    const apiKey = module.exports._pluginConfig?.apiKey;
    const client = new GenAIClient(apiKey);
    return await searchGrounding(client, { query, model });
}

// ---------------------------------------------------------------------------
// extract_structured
// ---------------------------------------------------------------------------
const extractStructuredDef = {
    name: 'extract_structured',
    description: 'Extract structured JSON data from text using Gemini\'s responseSchema. Provide content and a JSON Schema — the model returns data matching that schema. Ideal for parsing invoices, extracting fields from articles, or converting unstructured text into structured records.',
    inputSchema: {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'The text content to extract structured data from.' },
            schema: { type: 'object', description: 'JSON Schema describing the desired output shape. Example: {"type":"object","properties":{"title":{"type":"string"},"date":{"type":"string"},"amount":{"type":"number"}}}' },
            instruction: { type: 'string', description: 'Optional extraction instruction (e.g. "Extract key facts only" or "Extract all named entities"). Overrides the default "Extract structured data from this content according to the specified schema."' },
            model: { type: 'string', description: 'Model override (default: gemini-2.5-flash). Also supports gemini-3.1-flash-lite, gemma-4-9b-it.', default: 'gemini-2.5-flash' },
        },
        required: ['content', 'schema'],
    },
};

async function extractStructuredHandler(llm, args) {
    const { content, schema, instruction, model } = args;
    const apiKey = module.exports._pluginConfig?.apiKey;
    const client = new GenAIClient(apiKey);
    return await extractStructured(client, { content, schema, instruction, model });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function (config = {}) {
    // Store config for handlers (MCP server passes { apiKey, provider, model })
    module.exports._pluginConfig = config;
    return [
        { definition: searchGroundingDef, handler: searchGroundingHandler },
        { definition: extractStructuredDef, handler: extractStructuredHandler },
    ];
};
