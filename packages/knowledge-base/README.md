# @andy-toolforge/knowledge-base

Filesystem-first knowledge base facade for AI agents. Zero-dependency CommonJS package: a JSON store with CRUD/search, optional best-effort Supermemory/Serena adapters, MCP tools (`kb_*`), and a management skill installed into client projects.

> Part of the [@andy-toolforge](https://github.com/andy-toolforge) monorepo. CommonJS by design — no build step, works in any Node project.

## Why

Agents re-learn the same lessons every session. This package gives any project a durable, structured memory:

- **Filesystem-first** — `~/.toolforge/kb/index.json`, no service, no network, no schema.
- **Zero dependencies** — drop it in anywhere.
- **Skill + MCP** — agents get both a management skill (installed via postinstall) and `kb_*` MCP tools.
- **Best-effort adapters** — mirrors entries to Supermemory/Serena CLIs when present; silently falls back to the filesystem store otherwise.

## Install

```bash
npm install @andy-toolforge/knowledge-base
```

The postinstall copies `skills/knowledge-base-management.md` into the client project's `.opencode/skills/` (prefixed `knowledge-base-`).

## Usage

```js
const { KnowledgeBase } = require('@andy-toolforge/knowledge-base');

const kb = new KnowledgeBase(); // default dir ~/.toolforge/kb
// custom: new KnowledgeBase({ dir: './.kb' })

const entry = kb.add({
  type: 'pattern',
  text: 'Use tmp+rename for atomic file writes',
  tags: ['files', 'atomic'],
  source: 'retro-2026-08',
});
// => { id: 'pattern-use-tmp-rename-...', type: 'pattern', text: ..., tags: [...], source: ..., createdAt }

kb.get(entry.id);            // entry or null
kb.search({ query: 'atomic' });            // substring search
kb.search({ query: 'writes', tags: ['files'] });
kb.list({ type: 'pattern' });              // newest first
kb.list({ tags: ['atomic'] });
kb.forget(entry.id);         // { ok, removed }
kb.status();                 // { dir, entries, adapters: { supermemory, serena } }
```

Entry shape: `{ id, type, text, tags: string[], source, createdAt }`. Types: `note | fact | decision | pattern | error-solution | reference`. Writes are atomic (tmp + rename).

## MCP tools

`mcp-tools.js` auto-discovered by [@andy-toolforge/mcp](../mcp/): `kb_add`, `kb_search`, `kb_list`, `kb_get`, `kb_forget`, `kb_status`.

## Adapting to external memory

On `add`, if the `supermemory` (or `serena`) CLI is on PATH, the entry is mirrored to it best-effort. Failures are silent — the filesystem store is always canonical.

## Testing

```bash
npm test -w @andy-toolforge/knowledge-base
```

Uses Node's built-in test runner (`node --test`), co-located in `lib/index.test.js` (runs against a temp dir — never touches the real `~/.toolforge/kb`).

## License

MIT
