'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { MCPErrorTracker } = require('./mcp-error-tracker');

async function waitForLines(filePath, expected) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
      if (lines.length >= expected) return lines;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
}

describe('MCPErrorTracker', () => {
  it('wrap success logs ok entry and returns the handler result', async () => {
    const tracker = new MCPErrorTracker();
    const wrapped = tracker.wrap('t', async () => 'ok');

    const result = await wrapped(null, {});

    assert.equal(result, 'ok');
    const stats = tracker.getStats();
    assert.equal(stats.totalCalls, 1);
    assert.equal(stats.totalErrors, 0);
    assert.equal(stats.recentLogs.length, 1);
    assert.equal(stats.recentLogs[0].type, 'ok');
    assert.equal(stats.recentLogs[0].tool, 't');
    assert.equal(typeof stats.recentLogs[0].duration, 'number');
  });

  it('wrap failure increments errorCounts, logs error entry, re-throws', async () => {
    const tracker = new MCPErrorTracker();
    const boom = Object.assign(new Error('bad input'), { code: -32602 });
    const wrapped = tracker.wrap('t', async () => { throw boom; });

    await assert.rejects(() => wrapped(null, {}), (err) => err === boom);

    const stats = tracker.getStats();
    assert.equal(stats.totalCalls, 1);
    assert.equal(stats.totalErrors, 1);
    assert.equal(stats.errorCounts['-32602'], 1);
    assert.equal(stats.recentLogs[0].type, 'error');
    assert.equal(stats.recentLogs[0].code, -32602);
  });

  it('plain Error falls back to -32000 and triggers onCritical', async () => {
    let critical = null;
    const tracker = new MCPErrorTracker({ onCritical: (info) => { critical = info; } });
    const wrapped = tracker.wrap('t', async () => { throw new Error('boom'); });

    await assert.rejects(() => wrapped(null, {}), /boom/);

    const stats = tracker.getStats();
    assert.equal(stats.errorCounts['-32000'], 1);
    assert.ok(critical);
    assert.equal(critical.tool, 't');
    assert.equal(critical.code, -32000);
    assert.equal(critical.message, 'boom');
    assert.ok(critical.stack);
  });

  it('wrapHandle re-throws and logs handle_error with method', async () => {
    const tracker = new MCPErrorTracker();
    const wrapped = tracker.wrapHandle(async (msg) => {
      throw new Error('parse fail');
    });

    await assert.rejects(() => wrapped({ method: 'tools/call' }), /parse fail/);

    const stats = tracker.getStats();
    assert.equal(stats.totalErrors, 1);
    assert.equal(stats.recentLogs[0].type, 'handle_error');
    assert.equal(stats.recentLogs[0].method, 'tools/call');
    assert.equal(stats.recentLogs[0].message, 'parse fail');
  });

  it('getStats shape correct and recentLogs FIFO cap enforced', async () => {
    const tracker = new MCPErrorTracker({ maxBuffer: 5 });
    const wrapped = tracker.wrap('t', async (_, i) => i);

    for (let i = 0; i < 7; i += 1) {
      await wrapped(null, i);
    }

    const stats = tracker.getStats();
    assert.equal(stats.totalCalls, 7);
    assert.equal(stats.totalErrors, 0);
    assert.equal(stats.recentLogs.length, 5);
    assert.equal(stats.recentLogs[0].tool, 't');
    assert.deepEqual(Object.keys(stats.errorCounts), []);
  });

  it('logPath writes valid JSONL with one JSON.parse-able line per event', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpet-'));
    const logPath = path.join(dir, 'errs.jsonl');
    const tracker = new MCPErrorTracker({ logPath });

    await tracker.wrap('ok-tool', async () => 'done')(null, {});
    const boom = Object.assign(new Error('bad'), { code: -32602 });
    await assert.rejects(() => tracker.wrap('fail-tool', async () => { throw boom; })(null, {}));

    const lines = await waitForLines(logPath, 2);
    assert.equal(lines.length, 2);

    const parsed = lines.map((line) => JSON.parse(line));
    assert.equal(parsed[0].type, 'ok');
    assert.equal(parsed[0].tool, 'ok-tool');
    assert.ok(parsed[0].timestamp);
    assert.equal(new Date(parsed[0].timestamp).toString() !== 'Invalid Date', true);
    assert.equal(parsed[1].type, 'error');
    assert.equal(parsed[1].code, -32602);
  });
});
