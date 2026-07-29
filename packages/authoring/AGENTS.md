# @andy-toolforge/authoring — Lesson/Curriculum Authoring

> Domain package for AI-assisted authoring: lesson plan generation, series scaffolding,
> image embedding in markdown, and series structure validation.

## Structure

```
packages/authoring/
  lib/
    index.js           — Entry: exports { generateLesson, scaffoldSeries,
                            embedImagesToMarkdown, validateSeries }
    generate-lesson.js — generateLesson(topic, audience, [objectives], [language])
    scaffold-series.js — scaffoldSeries(topic, outputDir, [lessonCount], [language])
    embed-images.js    — embedImagesToMarkdown(markdown, [outputDir], [apiKey])
    validate-series.js — validateSeries(seriesDir)
  mcp-tools.js         — MCP tool handlers
  package.json         — deps: @andy-toolforge/core
```

## Exports

| Symbol | File | Purpose |
|--------|------|---------|
| `generateLesson` | `lib/generate-lesson.js` | Generate a complete lesson plan from topic + audience. Returns structured Markdown with objectives, sections, exercises, summary. Signature: `generateLesson({ topic, audience, objectives?, language? })`. |
| `scaffoldSeries` | `lib/scaffold-series.js` | Create a series directory with TOC and numbered lesson scaffolds. Creates `00-muc-luc.md`, lesson files, and `images/`. Signature: `scaffoldSeries({ topic, outputDir, lessonCount?, language? })`. |
| `embedImagesToMarkdown` | `lib/embed-images.js` | Replace image placeholders in markdown (`![alt](placeholder:desc)`) with actual generated images via Gemini Images API. Signature: `embedImagesToMarkdown(markdown, { outputDir?, apiKey? })`. |
| `validateSeries` | `lib/validate-series.js` | Validate a series directory — checks metadata, file structure, image references, internal links. Returns `{ errors, warnings, stats }`. Signature: `validateSeries(seriesDir)`. |

## Conventions

- All functions return plain objects (no classes).
- Uses core LLMClient for lesson/scaffold generation.
- Image generation uses Gemini Images API (not browser automation).
- MCP tools registered via `mcp-tools.js`.
- Skill files prefixed with `authoring-`.

## Testing

```bash
npm test -w @andy-toolforge/authoring
```

## See also

- `packages/authoring/mcp-tools.js` — MCP tool handlers
