'use strict';

// module-object reference so tests can mock childProcess.spawn (repo convention)
const childProcess = require('child_process');

/**
 * FR-3/FR-6/FR-8: spawn `hermes chat` with a plain argv list (no shell),
 * process-group kill on timeout (no orphan), exit 124 on timeout.
 */

/**
 * Build the hermes chat argv (bin first). Exported for test assertions.
 * --ignore-user-config is MANDATORY (Q1 fix): strips config.yaml's
 * model.default + fallback_providers so opencode-zen never enters the
 * fallback chain (429 -> "Retrying API call in 600s" hang).
 */
function buildArgv({ bin, prompt, provider, model, toolsets, maxTurns, cwd }) {
  const argv = [bin || 'hermes', 'chat', '-q', prompt];
  if (provider && provider !== 'auto') argv.push('--provider', provider);
  if (model) argv.push('-m', model);
  if (toolsets) argv.push('-t', toolsets);
  argv.push('--max-turns', String(maxTurns == null ? 500 : maxTurns));
  argv.push('-Q', '--accept-hooks', '--ignore-user-config');
  if (cwd) argv.push('--in', cwd);
  argv.push('--pass-session-id');
  return argv;
}

/**
 * Run hermes chat. Resolves {stdout, stderr, exitCode, durationMs, timedOut, spawnError}.
 * On spawn error (ENOENT) resolves with spawnError set; on timeout kills the
 * process group and reports exitCode 124 + timedOut true.
 */
function runHermesChat(opts, cfg = {}) {
  const bin = cfg.hermesBin || 'hermes';
  const argv = buildArgv({
    bin,
    prompt: opts.prompt,
    provider: opts.provider,
    model: opts.model,
    toolsets: opts.toolsets,
    maxTurns: opts.maxTurns,
    cwd: opts.cwd,
  });
  const timeoutMs = opts.timeoutMs || 300000;
  const killGraceMs = cfg.killGraceMs != null ? cfg.killGraceMs : 5000;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(bin, argv.slice(1), {
        cwd: cfg.spawnCwd,
        detached: true, // own process group -> group kill, no orphan
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        spawnError: err,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL'); // whole group
      } catch { /* already gone */ }
    }, timeoutMs + killGraceMs);
    if (typeof timer.unref === 'function') timer.unref();

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        timedOut,
        spawnError: err,
      });
    });
    child.on('exit', (code, _signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: timedOut ? 124 : code,
        durationMs: Date.now() - startedAt,
        timedOut,
        spawnError: null,
      });
    });
  });
}

/**
 * FR-6 error taxonomy. Returns one of:
 * timeout | rate_limited | spawn_failed | unknown | null (success).
 */
function classifyError({ exitCode, stderr, timedOut, spawnError } = {}) {
  if (spawnError && spawnError.code === 'ENOENT') return 'spawn_failed';
  if (timedOut || exitCode === 124) return 'timeout';
  if (stderr && /429|RateLimitError|FreeUsageLimitError/.test(stderr)) return 'rate_limited';
  if (exitCode !== 0 && exitCode !== null) return 'unknown';
  return null;
}

/**
 * Run `hermes sessions export --format jsonl --session-id <id> - --yes`.
 * Outputs a single JSON object on stdout. Resolves {stdout, exitCode, timedOut, spawnError}
 * with the same timeout + process-group-kill semantics as runHermesChat; JSON
 * parsing is left to the caller. Short-lived local CLI call (default 15s cap).
 */
function runSessionExport(bin, sessionId, cfg = {}) {
  const argv = [bin || 'hermes', 'sessions', 'export', '--format', 'jsonl', '--session-id', sessionId, '-', '--yes'];
  const timeoutMs = cfg.sessionExportTimeoutMs != null ? cfg.sessionExportTimeoutMs : 15000;
  const killGraceMs = cfg.killGraceMs != null ? cfg.killGraceMs : 5000;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(bin, argv.slice(1), {
        cwd: cfg.spawnCwd,
        detached: true, // own process group -> group kill, no orphan
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        stdout: '',
        exitCode: null,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        spawnError: err,
      });
      return;
    }

    let stdout = '';
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL'); // whole group
      } catch { /* already gone */ }
    }, timeoutMs + killGraceMs);
    if (typeof timer.unref === 'function') timer.unref();

    child.stdout.on('data', (d) => { stdout += d; });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        timedOut,
        spawnError: err,
      });
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        exitCode: timedOut ? 124 : code,
        durationMs: Date.now() - startedAt,
        timedOut,
        spawnError: null,
      });
    });
  });
}

module.exports = { buildArgv, classifyError, runHermesChat, runSessionExport };
