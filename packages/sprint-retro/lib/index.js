'use strict';

/**
 * @andy-toolforge/sprint-retro
 *
 * Scrum-style sprint retrospective for AI agents. This package ships the
 * sprint-retro skill (installed into client projects via postinstall) plus a
 * programmatic wrapper around the bundled session miner.
 *
 * The miner reads three sources:
 *   - Hermes task cache  (~/.hermes/hermes-task-cache/*.json)
 *   - OpenCode sessions  (~/.local/share/opencode/opencode.db, --opencode)
 *   - Other agents       (Claude/Codex/etc. via coding-agent-sessions finder, --agents)
 */

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MINE_SCRIPT = path.join(__dirname, '..', 'scripts', 'mine.js');

/**
 * Run the bundled session miner and return its parsed JSON output.
 *
 * @param {object} [opts]
 * @param {string} [opts.since]  ISO start of the sprint window.
 * @param {string} [opts.until]  ISO end of the sprint window.
 * @param {boolean} [opts.opencode]  Also mine OpenCode sessions.
 * @param {boolean} [opts.agents]    Also mine other agents (Claude/Codex/etc.).
 * @returns {object} Parsed JSON: { stats, tasks, opencode?, agents? }.
 */
function mineSessions(opts = {}) {
    const args = [MINE_SCRIPT, '--json'];
    if (opts.since) args.push('--since', opts.since);
    if (opts.until) args.push('--until', opts.until);
    if (opts.opencode) args.push('--opencode');
    if (opts.agents) args.push('--agents');
    const out = execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out);
}

module.exports = { mineSessions, MINE_SCRIPT };
