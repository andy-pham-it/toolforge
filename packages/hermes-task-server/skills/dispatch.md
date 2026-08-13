# Hermes Dispatch

Dispatch one-shot agentic tasks to the local Hermes Agent CLI using `@andy-toolforge/hermes-task-server` MCP tools.

## hermes_task

```javascript
const res = await hermes_task({
    prompt: 'Summarize this article: ...',
    provider: 'auto',        // or explicit: 'gemini', 'opencode-zen', 'openrouter', 'nvidia', 'huggingface'
    output_mode: 'digest',   // 'digest' (8KB cap) or 'full' (200KB + tool_calls)
    timeout_seconds: 300,    // clamp 10-1800
});
```

Response: `{ ok, provider, model, task_id, result, truncated, exit_code, duration_ms, session_id, digest: { tool_call_count, api_call_count, message_count, tools_used } }`.

Provider selection: `auto` picks the first ALIVE free-tier provider (tiebreak: nvidia -> huggingface -> gemini -> kimi-coding). Dead/rate-limited credentials are skipped automatically. Use `hermes_models` to inspect liveness.

## hermes_task_detail

```javascript
const detail = await hermes_task_detail({ task_id: '...', session_id: '...', max_bytes: 0 });
// { ok, cached, result, tool_calls, exit_code, duration_ms }
```

Lookup by `task_id` (disk cache `~/.hermes/hermes-task-cache/`), fallback `session_id`.

## hermes_models

```javascript
const models = await hermes_models({ provider: 'gemini', input_type: 'text', limit: 10 });
```

Merges `provider_models_cache.json` + `auth.json` liveness + capability map. Note: cache is refreshed by `hermes model` (TTY required — cannot be refreshed programmatically).

## Errors

`busy`, `no_credential`, `provider_not_found`, `cwd_not_allowed`, `timeout`, `rate_limited`, `spawn_failed`, `unknown`.

## Tips

- Always pass a self-contained prompt (cwd is not allowed).
- `digest` mode is enough for summaries/verification; use `full` for tool-call inspection.
- MCP server ceiling: 600000ms (10 min) — keep `timeout_seconds` below that.
- Env: `HERMES_AUTH_PATH` (~/.hermes/auth.json), `HERMES_BIN` (hermes).