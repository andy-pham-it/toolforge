'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { mineSessions, MINE_SCRIPT } = require('./index');

test('MINE_SCRIPT points to an existing miner script', () => {
    assert.ok(MINE_SCRIPT, 'MINE_SCRIPT should be defined');
    assert.ok(fs.existsSync(MINE_SCRIPT), `MINE_SCRIPT should exist: ${MINE_SCRIPT}`);
});

test('mineSessions returns parsed stats + tasks (hermes default)', () => {
    const out = mineSessions({ since: '2026-08-09T00:00:00Z' });
    assert.ok(out && typeof out === 'object', 'should return an object');
    assert.ok(out.stats, 'should have stats');
    assert.ok(Array.isArray(out.tasks), 'should have tasks array');
    assert.ok(out.stats.total > 0, 'stats.total should be > 0');
});

test('mineSessions supports --opencode and --agents flags', () => {
    const out = mineSessions({ since: '2026-08-09T00:00:00Z', opencode: true, agents: true });
    assert.ok(out.opencode, 'should have opencode key when --opencode passed');
    assert.ok(out.agents, 'should have agents key when --agents passed');
});
