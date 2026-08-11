'use strict';

const { loadConfig } = require('./config');
const { markExhausted, readAuth } = require('./credential-store');
const { pickAliveProvider, classifyCapability, validateProvider, defaultModelFor } = require('./provider-selector');
const { classifyError, runHermesChat, runSessionExport } = require('./runner');
const { extractToolCalls } = require('./tool-calls');
const { cacheRun, readRun, findBySession } = require('./task-cache');

// Max concurrency = 1 (spec FR-8/Q3): second concurrent call fails fast with busy.
let busy = false;

function clampTimeoutSeconds(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 300;
  return Math.min(1800, Math.max(10, Math.round(n)));
}

function truncate(s, maxBytes) {
  if (s == null) return { text: '', truncated: false };
  const text = String(s);
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return { text, truncated: false };
  let buf = Buffer.from(text, 'utf8');
  buf = buf.subarray(0, maxBytes);
  // avoid splitting a multi-byte char
  let cut = buf.length;
  while (cut > 0 && (buf[cut - 1] & 0xc0) === 0x80) cut -= 1;
  return { text: buf.subarray(0, cut).toString('utf8'), truncated: true };
}

function capDetail(s, maxBytes) {
  if (s == null) return '';
  return truncate(s, maxBytes).text;
}

/** Best-effort parse of `--pass-session-id` output; null when unparseable (v2 note).
 * The session id is printed to STDERR (prefixed by a blank line), not stdout. */
function parseSessionId(stdout, stderr) {
  const haystack = [stdout, stderr].filter((s) => s != null).join('\n');
  if (!haystack) return null;
  const m = String(haystack).match(/session[_-]?id["']?\s*[:=]\s*["']?([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

/**
 * Orchestrator — FR-1/FR-2/FR-5/FR-9.
 * args: {prompt, provider, model, timeout_seconds, cwd, toolsets, max_turns}
 */
async function runHermesTask(args = {}, overrides = {}) {
  const cfg = overrides && typeof overrides === 'object' ? loadConfig(overrides) : loadConfig();

  // 1. Validate params (FR-2).
  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  if (!prompt) {
    return { ok: false, error: 'invalid_args', error_detail: 'prompt is required' };
  }
  const timeoutSeconds = clampTimeoutSeconds(args.timeout_seconds);
  const maxTurns = Number.isFinite(Number(args.max_turns)) && Number(args.max_turns) > 0 ? Math.round(Number(args.max_turns)) : 500;

  // 2. Concurrency lock (FR-8).
  if (busy) return { ok: false, error: 'busy', error_detail: 'another hermes_task is already running' };
  busy = true;
  const startedAt = Date.now();
  let logLineProvider = '-';
  let logLineModel = '-';
  const logLine = (status, durationMs) => {
    const err = status === 'ok' ? 'ok' : status;
    process.stderr.write(
      `[hermes_task] provider=${logLineProvider} model=${logLineModel} prompt_len=${prompt.length} timeout=${timeoutSeconds}s -> ${err} duration_ms=${durationMs}\n`
    );
  };

  try {
    // 3. Read auth (FR-7 source).
    const auth = readAuth(cfg.authPath);
    if (!auth || (!auth.credential_pool && !auth.providers)) {
      logLine('no_credential', Date.now() - startedAt);
      return { ok: false, error: 'no_credential', error_detail: 'auth.json unreadable or missing credentials' };
    }

    // 4. Resolve provider/model (FR-4).
    let provider;
    let model;
    const explicitProvider = typeof args.provider === 'string' && args.provider.trim() !== '' && args.provider !== 'auto';
    logLineProvider = explicitProvider ? args.provider.trim() : 'auto';
    if (explicitProvider) {
      provider = args.provider.trim();
      if (!validateProvider(provider, auth)) {
        logLine('provider_not_found', Date.now() - startedAt);
        return { ok: false, error: 'provider_not_found', error_detail: `provider "${provider}" not found in auth.json` };
      }
      model = typeof args.model === 'string' && args.model.trim() !== '' ? args.model.trim() : defaultModelFor(provider, cfg);
      if (!model) {
        logLine('provider_not_found', Date.now() - startedAt);
        return { ok: false, error: 'provider_not_found', error_detail: `no default model mapped for provider "${provider}"` };
      }
    } else {
      const picked = pickAliveProvider(args.prompt, auth, cfg);
      if (!picked) {
        logLine('no_credential', Date.now() - startedAt);
        return { ok: false, error: 'no_credential', error_detail: 'all providers exhausted' };
      }
      provider = picked.provider;
      model = picked.model;
    }
    logLineProvider = provider;
    logLineModel = model;

    // 5. cwd allowlist validation (AC-9).
    const cwd = typeof args.cwd === 'string' ? args.cwd : '';
    if (cwd) {
      const allow = cfg.cwdAllowlist || [];
      if (!allow.includes(cwd)) {
        logLine('cwd_not_allowed', Date.now() - startedAt);
        return { ok: false, error: 'cwd_not_allowed', error_detail: `cwd "${cwd}" not in allowlist` };
      }
    }

    // 6. Run (FR-3) + write-back on rate_limited (FR-7).
    const run = await runHermesChat(
      {
        prompt,
        provider,
        model,
        toolsets: typeof args.toolsets === 'string' ? args.toolsets : '',
        maxTurns,
        timeoutMs: timeoutSeconds * 1000,
        cwd,
      },
      cfg
    );
    const errCode = classifyError(run);
    const durationMs = run.durationMs;

    if (errCode === 'rate_limited') {
      try {
        markExhausted(cfg.authPath, provider, {
          code: '429',
          reason: 'RateLimitError',
          message: capDetail(run.stderr.split('\n').filter(Boolean).slice(-3).join(' | '), cfg.maxErrorDetailBytes),
        }, cfg);
      } catch { /* best-effort FR-7 */ }
      logLine('rate_limited', durationMs);
      return {
        ok: false,
        error: 'rate_limited',
        error_detail: capDetail(run.stderr, cfg.maxErrorDetailBytes),
        exit_code: run.exitCode,
        duration_ms: durationMs,
      };
    }

    if (errCode === 'timeout') {
      logLine('timeout', durationMs);
      return {
        ok: false,
        error: 'timeout',
        error_detail: `hermes did not finish within ${timeoutSeconds}s`,
        exit_code: 124,
        duration_ms: durationMs,
      };
    }

    if (errCode === 'spawn_failed') {
      logLine('spawn_failed', durationMs);
      return {
        ok: false,
        error: 'spawn_failed',
        error_detail: `hermes binary "${cfg.hermesBin}" not found (ENOENT)`,
        exit_code: null,
        duration_ms: durationMs,
      };
    }

    if (errCode === 'unknown') {
      logLine('unknown', durationMs);
      return {
        ok: false,
        error: 'unknown',
        error_detail: capDetail(run.stderr, cfg.maxErrorDetailBytes),
        exit_code: run.exitCode,
        duration_ms: durationMs,
      };
    }

    // 7. Success (FR-5) — digest/full modes.
    const outputMode = args.output_mode === 'full' || cfg.defaultOutputMode === 'full' ? 'full' : 'digest';
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const resultCap = outputMode === 'full' ? cfg.maxResultBytes : cfg.maxDigestResultBytes;
    const trimmed = truncate(run.stdout, resultCap);
    const sessionId = parseSessionId(run.stdout, run.stderr);
    const response = {
      ok: true,
      provider,
      model,
      task_id: taskId,
      output_mode: outputMode,
      result: trimmed.text,
      truncated: trimmed.truncated,
      exit_code: run.exitCode,
      duration_ms: durationMs,
      session_id: sessionId,
    };
    // 7b. Best-effort tool_calls + digest stats (additive; extraction failure never fails the task).
    let toolCalls = null;
    let digestStats = null;
    if (sessionId) {
      try {
        const exp = await runSessionExport(cfg.hermesBin, sessionId, cfg);
        if (exp.spawnError || exp.timedOut || exp.exitCode !== 0) {
          process.stderr.write(`[hermes_task] tool_calls extraction failed: export exit=${exp.exitCode} timedOut=${exp.timedOut}\n`);
        } else {
          const exportObj = JSON.parse(exp.stdout);
          toolCalls = extractToolCalls(exportObj, cfg);
          const toolsUsed = [];
          for (const m of exportObj.messages || []) {
            if (Array.isArray(m.tool_calls)) {
              for (const tc of m.tool_calls) {
                if (tc.function && tc.function.name && !toolsUsed.includes(tc.function.name)) toolsUsed.push(tc.function.name);
              }
            }
          }
          digestStats = {
            tool_call_count: exportObj.tool_call_count ?? (toolCalls ? toolCalls.length : 0),
            api_call_count: exportObj.api_call_count ?? null,
            message_count: exportObj.message_count ?? null,
            tools_used: toolsUsed,
          };
          if (outputMode === 'full') response.tool_calls = toolCalls;
        }
      } catch (err) {
        process.stderr.write(`[hermes_task] tool_calls extraction failed: ${err.message}\n`);
      }
    }
    if (outputMode === 'digest') response.digest = digestStats;
    // 7c. Best-effort disk cache (additive; cache write failure never fails the task).
    try {
      cacheRun(cfg, {
        task_id: taskId,
        session_id: sessionId,
        provider,
        model,
        output_mode: outputMode,
        result: run.stdout, // full uncapped stdout for on-demand detail
        tool_calls: toolCalls,
        digest: digestStats,
        prompt_len: prompt.length,
        exit_code: run.exitCode,
        duration_ms: durationMs,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      process.stderr.write(`[hermes_task] cache write failed: ${err.message}\n`);
    }
    logLine('ok', durationMs);
    return response;
  } finally {
    busy = false;
  }
}

/**
 * Companion tool (FR-5c): on-demand detail for a prior task.
 */
async function runHermesTaskDetail(args = {}, overrides = {}) {
  const cfg = overrides && typeof overrides === 'object' ? loadConfig(overrides) : loadConfig();
  const taskId = typeof args.task_id === 'string' ? args.task_id.trim() : '';
  const sessionId = typeof args.session_id === 'string' ? args.session_id.trim() : '';
  if (!taskId && !sessionId) {
    return { ok: false, error: 'invalid_args', error_detail: 'task_id or session_id is required' };
  }

  let record = taskId ? readRun(cfg, taskId) : null;
  let cached = true;
  if (!record && sessionId) {
    record = findBySession(cfg, sessionId);
    if (!record) {
      // Cache miss with session_id → live export (best-effort).
      try {
        const exp = await runSessionExport(cfg.hermesBin, sessionId, cfg);
        if (exp.spawnError || exp.timedOut || exp.exitCode !== 0) {
          return { ok: false, error: 'not_found', error_detail: `session export failed: exit=${exp.exitCode} timedOut=${exp.timedOut}` };
        }
        const exportObj = JSON.parse(exp.stdout);
        const toolCalls = extractToolCalls(exportObj, cfg);
        record = {
          task_id: `ses_${sessionId}`,
          session_id: sessionId,
          provider: exportObj.provider || null,
          model: exportObj.model || null,
          output_mode: 'full',
          result: null, // export has no single final result string
          tool_calls: toolCalls,
          digest: null,
          exit_code: 0,
          duration_ms: null,
          created_at: new Date().toISOString(),
        };
        try {
          cacheRun(cfg, record);
        } catch { /* best-effort */ }
        cached = false;
      } catch (err) {
        return { ok: false, error: 'not_found', error_detail: `session export failed: ${err.message}` };
      }
    }
  }

  if (!record) {
    return { ok: false, error: 'not_found', error_detail: 'no cached run matches task_id/session_id' };
  }

  const maxBytes = Number.isFinite(Number(args.max_bytes)) && Number(args.max_bytes) > 0 ? Math.round(Number(args.max_bytes)) : 0;
  const result = record.result == null ? null : maxBytes > 0 ? truncate(record.result, maxBytes).text : record.result;
  return {
    ok: true,
    cached,
    task_id: record.task_id || null,
    session_id: record.session_id || null,
    provider: record.provider || null,
    model: record.model || null,
    output_mode: record.output_mode || 'full',
    result,
    tool_calls: record.tool_calls || [],
    digest: record.digest || null,
    exit_code: record.exit_code ?? null,
    duration_ms: record.duration_ms ?? null,
  };
}

module.exports = { runHermesTask, runHermesTaskDetail };
