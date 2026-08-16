#!/usr/bin/env node
/**
 * sprint-retro: mine.js
 *
 * Mines the Hermes task cache (~/.hermes/hermes-task-cache/*.json) and
 * produces a structured retrospective report: task counts by provider/model,
 * tool/api call totals from digests, and a per-task listing (prompt + result)
 * so the agent can synthesize lessons and candidate patterns.
 *
 * Usage:
 *   node mine.js [--since ISO] [--until ISO] [--json] [--opencode] [--agents]
 *
 *   --since / --until  filter tasks by created_at (ISO 8601). Default: all.
 *   --json             emit raw JSON instead of the human-readable report.
 *   --opencode         also mine the local opencode.db SQLite session store
 *                      (~/.local/share/opencode/opencode.db) and append an
 *                      OpenCode session mining section to the report.
 *   --agents           also mine other coding-agent sessions (claude, codex,
 *                      openclaw, droid, amp, kodu, cursor-cli, aider, roo-code,
 *                      kilo-code, kilo-cli, kiro, senpi, goose, hermes, crush,
 *                      zed, gemini, kimi, qwen, codebuff) by shelling out to the
 *                      oh-my-opencode coding-agent-sessions finder
 *                      (find-agent-sessions.py) when it is installed.
 *
 * Exit code 0 on success. Prints report to stdout.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CACHE_DIR = process.env.HERMES_TASK_CACHE || path.join(process.env.HOME || '', '.hermes', 'hermes-task-cache');
const OPENCODE_DB = process.env.OPENCODE_DB || path.join(process.env.HOME || '', '.local', 'share', 'opencode', 'opencode.db');
const AGENTS_FINDER = process.env.AGENTS_FINDER || path.join(
    process.env.HOME || '',
    '.cache', 'opencode', 'packages', 'oh-my-opencode@latest', 'node_modules',
    'oh-my-opencode', 'dist', 'skills', 'coding-agent-sessions', 'scripts', 'find-agent-sessions.py'
);

function parseArgs(argv) {
    const opts = { since: null, until: null, json: false, opencode: false, agents: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--since') opts.since = argv[++i];
        else if (a === '--until') opts.until = argv[++i];
        else if (a === '--json') opts.json = true;
        else if (a === '--opencode') opts.opencode = true;
        else if (a === '--agents') opts.agents = true;
    }
    return opts;
}

function loadTasks() {
    if (!fs.existsSync(CACHE_DIR)) {
        throw new Error(`Hermes task cache not found: ${CACHE_DIR}`);
    }
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
    const tasks = [];
    for (const f of files) {
        try {
            const raw = fs.readFileSync(path.join(CACHE_DIR, f), 'utf8');
            const t = JSON.parse(raw);
            if (t && typeof t === 'object') tasks.push(t);
        } catch (e) {
            // skip unparseable file
        }
    }
    return tasks;
}

function inWindow(t, opts) {
    if (!t.created_at) return true;
    const ts = new Date(t.created_at).getTime();
    if (opts.since && ts < new Date(opts.since).getTime()) return false;
    if (opts.until && ts > new Date(opts.until).getTime()) return false;
    return true;
}

function sanitize(t) {
    const strip = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ') : v);
    const out = {};
    for (const [k, v] of Object.entries(t)) {
        if (typeof v === 'string') out[k] = strip(v);
        else if (v && typeof v === 'object') out[k] = JSON.parse(strip(JSON.stringify(v)));
        else out[k] = v;
    }
    return out;
}

function summarize(tasks) {
    const byProvider = {};
    const byModel = {};
    let toolCalls = 0;
    let apiCalls = 0;
    let withDigest = 0;
    let failed = 0;
    for (const t of tasks) {
        const p = t.provider || 'unknown';
        const m = t.model || 'unknown';
        byProvider[p] = (byProvider[p] || 0) + 1;
        byModel[m] = (byModel[m] || 0) + 1;
        if (t.exit_code && t.exit_code !== 0) failed++;
        if (t.digest) {
            withDigest++;
            toolCalls += t.digest.tool_call_count || 0;
            apiCalls += t.digest.api_call_count || 0;
        }
    }
    return { total: tasks.length, byProvider, byModel, toolCalls, apiCalls, withDigest, failed };
}

function humanReport(tasks, opts, stats) {
    const lines = [];
    lines.push('# Sprint Retro — Hermes task mining');
    lines.push('');
    lines.push(`Window: ${opts.since || 'start'} → ${opts.until || 'now'}`);
    lines.push(`Tasks: ${stats.total}  (failed: ${stats.failed})`);
    lines.push('');
    lines.push('## By provider');
    for (const [k, v] of Object.entries(stats.byProvider).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${k}: ${v}`);
    }
    lines.push('');
    lines.push('## By model');
    for (const [k, v] of Object.entries(stats.byModel).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${k}: ${v}`);
    }
    lines.push('');
    lines.push(`Digest tool_calls: ${stats.toolCalls}  api_calls: ${stats.apiCalls}  (${stats.withDigest} tasks with digest)`);
    lines.push('');
    lines.push('## Tasks');
    for (const t of tasks) {
        const when = t.created_at ? new Date(t.created_at).toISOString() : '?';
        const ok = t.exit_code === 0 || t.exit_code == null ? 'ok' : `FAIL(${t.exit_code})`;
        lines.push(`- [${ok}] ${when} ${t.provider}/${t.model} ${t.task_id}`);
        if (t.result) lines.push(`    result: ${String(t.result).slice(0, 200)}`);
    }
    return lines.join('\n');
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const tasks = loadTasks().filter((t) => inWindow(t, opts));
    const stats = summarize(tasks);
    if (opts.json) {
        const clean = tasks.map((t) => sanitize(t));
        let out = { stats, tasks: clean };
        if (opts.opencode) {
            const oc = opencodeMine(opts);
            out.opencode = oc;
        }
        if (opts.agents) {
            out.agents = agentsMine(opts);
        }
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    } else {
        let report = humanReport(tasks, opts, stats);
        if (opts.opencode) {
            const oc = opencodeMine(opts);
            report += '\n' + opencodeHumanReport(oc, opts);
        }
        if (opts.agents) {
            const ag = agentsMine(opts);
            report += '\n' + agentsHumanReport(ag, opts);
        }
        process.stdout.write(report + '\n');
    }
}

/**
 * Mine the local opencode.db SQLite session store.
 * Returns { sessions: [...], total, toolCalls } or throws on failure.
 * Uses node:sqlite (Node 22.5+); falls back to the sqlite3 CLI if unavailable.
 */
function opencodeMine(opts) {
    const sinceMs = opts.since ? new Date(opts.since).getTime() : 0;
    const untilMs = opts.until ? new Date(opts.until).getTime() : Number.MAX_SAFE_INTEGER;

    let db;
    try {
        db = new (require('node:sqlite').DatabaseSync)(OPENCODE_DB, { readOnly: true });
    } catch (e) {
        throw new Error(`Cannot open opencode.db (${OPENCODE_DB}): ${e.message}. ` +
            'OpenCode session mining requires Node 22.5+ (node:sqlite).');
    }

    try {
        const rows = db.prepare(
            'SELECT id, title, directory, time_created, agent, model FROM session ' +
            'WHERE time_created >= ? AND time_created <= ? ORDER BY time_created DESC'
        ).all(sinceMs, untilMs);

        const msgCountStmt = db.prepare('SELECT count(*) AS n FROM message WHERE session_id = ?');
        const sessions = rows.map((r) => {
            let roleBreakdown = {};
            let messageCount = 0;
            try {
                const msgRows = db.prepare(
                    'SELECT data FROM message WHERE session_id = ? ORDER BY time_created'
                ).all(r.id);
                messageCount = msgRows.length;
                for (const m of msgRows) {
                    const d = JSON.parse(m.data);
                    const role = d && d.role ? d.role : 'unknown';
                    roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
                }
            } catch (e) {
                roleBreakdown = { error: e.message };
            }
            let model = r.model;
            try {
                const md = JSON.parse(r.model);
                model = md && md.id ? md.id : r.model;
            } catch (e) { /* keep raw model string */ }
            return {
                id: r.id,
                title: r.title,
                directory: r.directory,
                time_created: r.time_created,
                agent: r.agent,
                model,
                messageCount,
                roleBreakdown,
            };
        });

        let toolCalls = 0;
        for (const s of sessions) {
            try {
                const partRows = db.prepare(
                    'SELECT data FROM part WHERE session_id = ?'
                ).all(s.id);
                for (const p of partRows) {
                    const d = JSON.parse(p.data);
                    if (d && d.type === 'tool') toolCalls++;
                }
            } catch (e) { /* skip */ }
        }

        return { sessions, total: sessions.length, toolCalls };
    } finally {
        db.close();
    }
}

function opencodeHumanReport(oc, opts) {
    const lines = [];
    lines.push('# Sprint Retro — OpenCode session mining');
    lines.push('');
    lines.push(`Window: ${opts.since || 'start'} → ${opts.until || 'now'}`);
    lines.push(`Sessions: ${oc.total}  (tool-call parts: ${oc.toolCalls})`);
    lines.push('');
    lines.push('## Sessions');
    for (const s of oc.sessions) {
        const when = new Date(s.time_created).toISOString();
        const roles = Object.entries(s.roleBreakdown)
            .map(([k, v]) => `${k}:${v}`).join(', ');
        lines.push(`- ${when} ${s.agent || '?'} ${s.model || '?'} msgs=${s.messageCount} (${roles}) ${s.id}`);
        if (s.title) lines.push(`    title: ${s.title.slice(0, 160)}`);
        if (s.directory) lines.push(`    dir: ${s.directory}`);
    }
    return lines.join('\n');
}

/**
 * Mine other coding-agent sessions (claude, codex, etc.) by shelling out to
 * the oh-my-opencode coding-agent-sessions finder (find-agent-sessions.py).
 * Returns { sessions: [...], total, platforms } or throws on failure.
 */
function agentsMine(opts) {
    if (!fs.existsSync(AGENTS_FINDER)) {
        throw new Error(`coding-agent-sessions finder not found: ${AGENTS_FINDER}. ` +
            'Install oh-my-opencode or set AGENTS_FINDER to find-agent-sessions.py.');
    }
    const args = ['list', '--limit', '500'];
    if (opts.since) args.push('--from', opts.since.slice(0, 10));
    if (opts.until) args.push('--to', opts.until.slice(0, 10));
    let raw;
    try {
        raw = execFileSync('python3', [AGENTS_FINDER, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
        throw new Error(`find-agent-sessions.py failed: ${e.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`find-agent-sessions.py returned non-JSON output: ${e.message}`);
    }
    const results = (parsed && parsed.results) || [];
    const platforms = {};
    for (const r of results) platforms[r.platform] = (platforms[r.platform] || 0) + 1;
    return { sessions: results, total: results.length, platforms };
}

function agentsHumanReport(ag, opts) {
    const lines = [];
    lines.push('# Sprint Retro — Other agent session mining');
    lines.push('');
    lines.push(`Window: ${opts.since || 'start'} → ${opts.until || 'now'}`);
    lines.push(`Sessions: ${ag.total}`);
    lines.push('');
    lines.push('## By platform');
    for (const [k, v] of Object.entries(ag.platforms).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${k}: ${v}`);
    }
    lines.push('');
    lines.push('## Sessions');
    for (const s of ag.sessions) {
        const when = s.created_at || '?';
        const model = s.model || '?';
        lines.push(`- ${when} [${s.platform}] ${s.agent || '?'} ${model} ${s.id}`);
        if (s.first_user_message) lines.push(`    first: ${String(s.first_user_message).slice(0, 160)}`);
        if (s.cwd) lines.push(`    cwd: ${s.cwd}`);
    }
    return lines.join('\n');
}

try {
    main();
} catch (e) {
    process.stderr.write(`mine.js: ${e.message}\n`);
    process.exit(1);
}
