# @andy-toolforge/book-writing — Book Writing Engine

> Domain package for AI-assisted book writing: outline generation, chapter writing, consistency review, and multi-format export (md/plain/html).

## Structure

```
packages/book-writing/
  lib/
    index.js  — Entry: exports { BookWriter }
    writer.js — BookWriter  Outline, write chapters, review, export
  skills/
    postinstall.js
    book-writer.md
  package.json — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `BookWriter` | `lib/writer.js` | Full book writing lifecycle — outline, draft, review, export. |

## Conventions

- Uses core LLMClient for chapter generation.
- Skill files prefixed with `book-writing-`.

## Testing

```bash
npm test -w @andy-toolforge/book-writing
```
