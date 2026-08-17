'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { mineSessions, MINE_SCRIPT } = require('./index');

// Run fn with a temporary set of env vars, restoring the originals afterwards.
function withEnv(env, fn) {
    const saved = {};
    for (const key of Object.keys(env)) {
        saved[key] = process.env[key];
        process.env[key] = env[key];
    }
    try {
        return fn();
    } finally {
        for (const key of Object.keys(env)) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    }
}

// A minimal hermes task-cache fixture dir with one record.
function fixtureCacheDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-retro-test-'));
    fs.writeFileSync(
        path.join(dir, 't1.json'),
        JSON.stringify({
            task_id: 't1',
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            exit_code: 0,
            duration_ms: 1000,
            created_at: '2026-08-10T00:00:00Z',
            digest: { tool_call_count: 2, api_call_count: 3 },
        })
    );
    return dir;
}

test('MINE_SCRIPT points to an existing miner script', () => {
    assert.ok(MINE_SCRIPT, 'MINE_SCRIPT should be defined');
    assert.ok(fs.existsSync(MINE_SCRIPT), `MINE_SCRIPT should exist: ${MINE_SCRIPT}`);
});

test('mineSessions returns parsed stats + tasks (hermes cache via env)', () => {
    const dir = fixtureCacheDir();
    try {
        const out = withEnv({ HERMES_TASK_CACHE: dir }, () =>
            mineSessions({ since: '2026-08-09T00:00:00Z' })
        );
        assert.ok(out && typeof out === 'object', 'should return an object');
        assert.ok(out.stats, 'should have stats');
        assert.ok(Array.isArray(out.tasks), 'should have tasks array');
        assert.ok(out.stats.total > 0, 'stats.total should be > 0');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('mineSessions degrades gracefully when opencode/agents sources are missing', () => {
    const dir = fixtureCacheDir();
    try {
        const out = withEnv(
            {
                HERMES_TASK_CACHE: dir,
                OPENCODE_DB: path.join(dir, 'no-such-opencode.db'),
                AGENTS_FINDER: path.join(dir, 'no-such-finder.py'),
            },
            () => mineSessions({ since: '2026-08-09T00:00:00Z', opencode: true, agents: true })
        );
        assert.ok(out.opencode, 'should have opencode key when --opencode passed');
        assert.ok(out.agents, 'should have agents key when --agents passed');
        assert.ok(out.opencode.error, 'opencode mining should report a skip error, not throw');
        assert.ok(out.agents.error, 'agents mining should report a skip error, not throw');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});