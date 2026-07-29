# @andy-toolforge/book-writing — Book Writing Engine

> Domain package for AI-assisted book writing: outline generation, chapter writing,
> consistency review, and multi-format export (markdown/plain/HTML).
> Requires an LLMClient for all operations.

## Structure

```
packages/book-writing/
  lib/
    index.js  — Entry: exports { BookWriter }
    writer.js — BookWriter — Full book writing lifecycle
  mcp-tools.js — MCP tool handlers
  skills/
    postinstall.js
    book-writer.md
  package.json — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `BookWriter` | `lib/writer.js` | Full book writing lifecycle — outline, draft, review, export. |

### BookWriter methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `generateOutline(topic, chapterCount?)` | `(string, number=5) → Promise<object>` | Generate a book outline from topic. Returns `{ title, topic, chapters[], estimatedLength }`. Chapter count limited to 1-50. |
| `writeChapter(outline, chapterIndex, previousContent?)` | `(object, number, string='') → Promise<string>` | Write a chapter (1-based index) based on outline. Uses previous content (last 500 chars) for continuity. Returns 800-2000 word markdown. |
| `reviewConsistency(manuscript)` | `(object) → Promise<object>` | Review manuscript for contradictions, repetition, missing references, tone inconsistencies, logic gaps. Returns `{ score, issues[], strengths[] }`. |
| `exportFormat(manuscript, format?)` | `(object, 'markdown'|'plain'|'html') → Promise<string>` | Export manuscript to specified format. Includes proper HTML/CSS for 'html' format. |

## Conventions

- Uses core LLMClient for all generation/review.
- Constructor requires `{ llmClient: LLMClient }`.
- Skill files prefixed with `book-writing-`.
- MCP tools registered via `mcp-tools.js`.
- Chapter content is vanilla markdown; H2 for subsections.
- Private `_ensureLLM()`, `_safeJsonParse()`, `_escapeHtml()` helpers.

## Testing

```bash
npm test -w @andy-toolforge/book-writing
```
