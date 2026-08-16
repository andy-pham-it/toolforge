'use strict';

// mcp-tools.js — @andy-toolforge/mcp auto-discovery convention.
// Exports function(config) => [{definition, handler}].

const { KnowledgeBase } = require('./lib/index');

const addDefinition = {
    name: 'kb_add',
    description:
        'Add a structured entry to the local knowledge base (~/.toolforge/kb JSON store). ' +
        'Always persists to filesystem; mirrors to Supermemory/Serena CLIs on a best-effort basis when available. ' +
        'Returns the stored entry (id + createdAt).',
    inputSchema: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['note', 'fact', 'decision', 'pattern', 'error-solution', 'reference'], description: 'Entry type (default note)' },
            text: { type: 'string', description: 'The knowledge content (required)' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags for filtering/search' },
            source: { type: 'string', description: 'Where this knowledge came from' },
        },
        required: ['text'],
    },
};

const searchDefinition = {
    name: 'kb_search',
    description:
        'Search the local knowledge base by full-text substring (text/type/source) and optional tag filter. ' +
        'Returns matching entries, newest first.',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Case-insensitive substring to search for' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Entry must contain at least one of these tags' },
            limit: { type: 'number', description: 'Max results (default 50)' },
        },
    },
};

const listDefinition = {
    name: 'kb_list',
    description:
        'List entries in the local knowledge base, optionally filtered by tags and/or type. ' +
        'Newest first. Use to survey what is stored.',
    inputSchema: {
        type: 'object',
        properties: {
            tags: { type: 'array', items: { type: 'string' }, description: 'Filter to entries containing at least one of these tags' },
            type: { type: 'string', description: 'Filter by entry type (note, fact, decision, pattern, error-solution, reference)' },
            limit: { type: 'number', description: 'Max results (default 100)' },
        },
    },
};

const getDefinition = {
    name: 'kb_get',
    description: 'Fetch one entry from the local knowledge base by id. Returns null when not found.',
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'string', description: 'Entry id (returned by kb_add / kb_search / kb_list)' },
        },
        required: ['id'],
    },
};

const forgetDefinition = {
    name: 'kb_forget',
    description: 'Remove one entry from the local knowledge base by id. Returns { ok, removed }.',
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'string', description: 'Entry id to remove' },
        },
        required: ['id'],
    },
};

const statusDefinition = {
    name: 'kb_status',
    description:
        'Knowledge base health: store directory, entry count, and which external adapters (supermemory/serena CLIs) are available on PATH.',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};

function kbOf(config = {}) {
    const dir = config && config.knowledgeBase && config.knowledgeBase.dir;
    return new KnowledgeBase(dir ? { dir } : {});
}

module.exports = function (config = {}) {
    const kb = kbOf(config);
    return [
        {
            definition: addDefinition,
            handler: async (llm, args) => kb.add(args || {}),
        },
        {
            definition: searchDefinition,
            handler: async (llm, args) => kb.search(args || {}),
        },
        {
            definition: listDefinition,
            handler: async (llm, args) => kb.list(args || {}),
        },
        {
            definition: getDefinition,
            handler: async (llm, args) => kb.get((args || {}).id),
        },
        {
            definition: forgetDefinition,
            handler: async (llm, args) => kb.forget((args || {}).id),
        },
        {
            definition: statusDefinition,
            handler: async () => kb.status(),
        },
    ];
};
