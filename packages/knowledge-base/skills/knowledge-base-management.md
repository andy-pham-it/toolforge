---
name: knowledge-base-management
description: Manage a structured local knowledge base for AI agents — store facts, decisions, patterns, and error solutions as durable entries (JSON store at ~/.toolforge/kb) with tags, search, and optional mirroring to Supermemory/Serena. Use when the user asks to remember something across sessions, save a lesson/decision/pattern, look up previously stored knowledge, review what is stored, or clean up stale memory entries.
---

# Knowledge Base Management

Give the agent a durable, structured memory that survives sessions. Unlike chat history (which is thrown away) or skill files (which encode *procedures*), the knowledge base stores *facts, decisions, patterns, and lessons* as queryable entries. This is the "remember what we learned" loop.

## Why this exists

Agents re-learn the same lessons every session. Supermemory/Serena persist memory but live outside the repo and depend on external CLIs/MCP. This package is a **filesystem-first facade** — a zero-dependency JSON store that works everywhere, plus optional best-effort adapters that mirror entries to Supermemory/Serena when those CLIs are available.

## Store

- Default location: `~/.toolforge/kb/index.json` (configurable via `dir`)
- Entry shape: `{ id, type, text, tags[], source, createdAt }`
- Types: `note`, `fact`, `decision`, `pattern`, `error-solution`, `reference`
- Writes are atomic (tmp + rename) — safe against crashes

## Workflow

### 1. Save knowledge (when to call `kb_add`)

Call `kb_add` when you discover something worth keeping across sessions:

| Situation | Type | Example |
|-----------|------|---------|
| A design decision was made | `decision` | "Chose filesystem-first store over DB — zero-dep requirement" |
| A working pattern was found | `pattern` | "Use tmp+rename for atomic file writes" |
| A bug + fix was resolved | `error-solution` | "MCP timeout clamp 10-1800s — server ceiling 600000ms" |
| A fact about the environment | `fact` | "publish.yml runs on push to main" |
| A reusable reference | `reference` | "AGENTS.md: WHERE TO LOOK table" |
| Anything else worth noting | `note` | — |

Always include `source` (where it came from) and 2-4 `tags` for future filtering.

### 2. Retrieve knowledge (before re-inventing)

Before solving something you might have solved before: `kb_search` (substring across text/type/source) or `kb_list` (survey by type/tags). Ask: "have I already stored something about this?" — especially for error-solution entries.

### 3. Review & prune (periodically)

`kb_status` → entry count + adapter availability. `kb_list` → survey what's stored. Remove stale or superseded entries with `kb_forget`.

### 4. Cross-tool sync (optional)

When the Supermemory or Serena CLIs are on PATH, `kb_add` automatically mirrors the entry to them (best-effort, never blocks). To *also* persist into Serena via MCP, use `serena_write_memory` for long-lived project memories (e.g. architecture notes) — the knowledge base remains the canonical structured store.

## Rules

- Keep entries small and specific — one fact/pattern per entry, not paragraphs.
- Prefer `pattern`/`error-solution`/`decision` over `note` when the kind is clear — they are easier to search later.
- Never store secrets or credentials in the knowledge base.
- When in doubt whether something is worth storing: store it. Retrieval is cheap; re-learning is not.
