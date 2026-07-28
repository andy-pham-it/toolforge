'use strict';

const path = require('path');
const { ToolInputError } = require('../lib/errors');
const { buildIndex, searchSkills } = require('../lib/skill-index');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

// TTL cache: rebuild index at most once every 30 seconds
let _cachedIndex = null;
let _cachedAt = 0;
const CACHE_TTL = 30_000;

function getSkillIndex() {
    const now = Date.now();
    if (_cachedIndex && (now - _cachedAt) < CACHE_TTL) {
        return _cachedIndex;
    }
    _cachedIndex = buildIndex(SKILLS_DIR);
    _cachedAt = now;
    return _cachedIndex;
}

const definition = {
    name: 'sdlc_search_skills',
    description: 'Search SDLC skills by keywords, triggers, or description. Returns matched skills with relevance scores.',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Natural language search query' },
            limit: { type: 'number', description: 'Max results (default: 10)', default: 10 },
        },
        required: ['query'],
    },
};

async function handler(_llm, args) {
    const { query, limit } = args;
    if (!query) throw new ToolInputError('query is required');

    const index = getSkillIndex();
    const results = searchSkills(index, query, { limit: limit || 10 });

    return {
        query,
        totalResults: results.length,
        results: results.map(r => ({
            id: r.skill.id,
            name: r.skill.name,
            score: r.score,
            description: r.skill.description,
            triggers: r.skill.triggers,
        })),
    };
}

module.exports = { definition, handler };
