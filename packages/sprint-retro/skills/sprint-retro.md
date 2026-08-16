---
name: sprint-retro
description: Run a Scrum-style retrospective over recent agent work — mine opencode session logs, the Hermes task cache, and other common agents (Claude, Codex, etc.), synthesize lessons learned, and persist reusable patterns into Supermemory or Serena memory. Use this whenever the user asks for a retro, sprint retrospective, "rút kinh nghiệm", "tự học", "what did I learn", "mine my sessions", "review my past work", "đúc kết bài học", or wants to turn accumulated session/task history into durable knowledge and candidate skill files — even if they don't explicitly say "retro".
---

# Sprint Retro

Turn accumulated agent work (opencode sessions + Hermes task cache) into a structured retrospective and durable, reusable knowledge. This is the "self-learning" loop: after a sprint (or any bounded window), mine what actually happened, extract lessons, and persist them so future sessions start smarter.

## Why this exists

Agents accumulate a lot of history (session transcripts, one-shot task results) that is currently thrown away. A retro makes that history pay off: it surfaces recurring mistakes, winning patterns, and design decisions, then stores them where future sessions can retrieve them (Supermemory / Serena memory) and, when a pattern recurs, codifies it into a skill file. Without this, every session re-learns the same lessons.

## Workflow

### 1. Determine the sprint window

Ask the user (or infer from context) the time range to review. Defaults:
- If the user names a sprint/date range, use it.
- Otherwise use the last 7 days, or since the last retro if one is recorded.

### 2. Mine the Hermes task cache (deterministic, scripted)

Run the bundled miner:

```bash
node ~/.agents/skills/sprint-retro/scripts/mine.js [--since ISO] [--until ISO]
```

This reads `~/.hermes/hermes-task-cache/*.json` and reports task counts by provider/model, tool/api call totals, and a per-task listing (prompt + result). Use `--since`/`--until` to bound the window. Use `--json` if you want the raw data for further processing.

Read the output and note: which providers/models were used, how many tasks failed, and what kinds of tasks were dispatched.

### 3. Mine opencode sessions (via the bundled miner)

The `--opencode` flag reads opencode's own SQLite store (`~/.local/share/opencode/opencode.db`) directly — the `session_list`/`session_read`/`session_search` MCP tools return empty in some environments, so prefer the miner:

```bash
node ~/.agents/skills/sprint-retro/scripts/mine.js --opencode --since <ISO>
```

This lists sessions in the window (title, directory, agent, model, message count by role) and counts tool-call parts. Add `--json` to get the raw session data for further processing. Note Node may print `ExperimentalWarning: SQLite is an experimental feature` on stderr — harmless.

Pick the sessions in the window, read the notable ones, and extract: what was built, what broke, what was fixed, what decisions were made, what was left undone.

### 4. Mine other agents (Claude, Codex, etc.)

The `--agents` flag shells out to the `coding-agent-sessions` finder (from the `oh-my-opencode` package) to enumerate sessions across many common agents — claude, codex, openclaw, droid, amp, kodu, cursor-cli, aider, roo-code, kilo-code, kilo-cli, kiro, senpi, goose, hermes, crush, zed, gemini, kimi, qwen, codebuff:

```bash
node ~/.agents/skills/sprint-retro/scripts/mine.js --agents --since <ISO>
```

This reports sessions by platform (e.g. claude reads `~/.claude/transcripts/*.jsonl`, opencode reads its DB) with the first user message and cwd per session. Set `AGENTS_FINDER` to override the finder path if it is not auto-detected.

**Antigravity limitation:** Antigravity has **no transcript store** — it only keeps tokscale cache/RPC data that does not reconstruct user prompts, so it cannot be mined for retro content. Treat Antigravity as out of scope for session mining.

### 5. Synthesize the retro report

Produce a report with this exact structure:

```
# Sprint Retro — <window>
## What went well
## What went wrong
## Lessons learned
## Candidate patterns (reusable)
```

For each candidate pattern, note: the trigger (when it applies), the action (what to do), and how many times it recurred in the window.

### 6. Persist each pattern

For each candidate pattern, decide the right store and write it:

- **Supermemory** (`supermemory add`) — use the `type` that fits: `error-solution` (a bug + its fix), `learned-pattern` (a reusable approach), `architecture` (a design decision), `preference` (a user preference), `project-config`. Scope `user` or `project` as appropriate.
- **Serena memory** (`serena_write_memory`) — for project-specific knowledge organized by topic; name it meaningfully (e.g. `toolforge/lessons`).

Prefer Supermemory for cross-project/general lessons and Serena for project-specific ones. If a lesson is already stored, update it rather than duplicating.

### 7. Codify recurring patterns into skills

If a pattern recurred ≥2 times in the window (or the user asks), propose turning it into a skill file (see the `skill-creator` skill for the process). A skill is the most durable form: it ships as a `.md` with a trigger description and is available to any future session. Do not create a skill for a one-off; only for genuinely recurring work.

### 8. Report what was saved

End by telling the user exactly what you stored and where:
- N lessons → Supermemory (list types)
- M lessons → Serena memory (list names)
- K candidate skills proposed (list names)

## Notes

- Be honest: only persist patterns you actually observed in the mined data, not invented ones.
- Keep memory entries concise and self-contained (a future session may read them without the surrounding context).
- If the user only wants a report and no persistence, stop after step 4.
