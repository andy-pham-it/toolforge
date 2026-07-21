# @andy-toolforge/authoring

> Lesson/curriculum authoring tools — generate lessons, scaffold series, embed images, validate structure.

## Installation

```bash
npm install @andy-toolforge/authoring
```

## Setup

### Gemini API Key (for image generation)

`embed_images_to_markdown` requires a Gemini API key to generate images:

```bash
export GEMINI_API_KEY="your-key-here"
```

Or pass `apiKey` directly when calling the function / MCP tool.

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Usage

### As a library

```js
const { generateLesson, scaffoldSeries, embedImagesToMarkdown, validateSeries } = require('@andy-toolforge/authoring');

// Generate a lesson plan using LLM
const lesson = await generateLesson({
  topic: 'JavaScript Promises',
  audience: 'beginner developers',
  language: 'vi',
});

// Scaffold a series directory
const series = await scaffoldSeries({
  topic: 'Python for Data Science',
  outputDir: './courses',
  lessonCount: 5,
});

// Replace image placeholders with generated images
const result = await embedImagesToMarkdown({
  markdown: '# My Doc\n\n![illustration](placeholder:a diagram of X)',
  apiKey: process.env.GEMINI_API_KEY,
});

// Validate a series directory
const report = await validateSeries({
  seriesDir: './courses/python-data-science',
});
```

### As MCP tools (via @andy-toolforge/mcp)

4 tools are auto-discovered when `@andy-toolforge/authoring` is installed alongside `@andy-toolforge/mcp`:

| Tool | Description |
|------|-------------|
| `generate_lesson` | Generate a lesson plan from topic + audience using LLM |
| `scaffold_series` | Create series directory with TOC and lesson scaffolds |
| `embed_images_to_markdown` | Replace `![alt](placeholder:desc)` with generated images |
| `validate_series` | Validate series file structure, metadata, and links |

The MCP server scans `node_modules/@andy-toolforge/*/mcp-tools.js` and registers them automatically.

## MCP Tools

### generate_lesson

**Parameters:**
- `topic` (string, required) — Lesson topic
- `audience` (string, required) — Target audience
- `objectives` (string[], optional) — Specific learning objectives
- `language` (string, optional) — Output language (`vi` or `en`, default `vi`)

**Returns:** `{ title, markdown, sections }`

### scaffold_series

**Parameters:**
- `topic` (string, required) — Series topic
- `outputDir` (string, required) — Parent directory for the series
- `lessonCount` (number, optional) — Number of lessons (default 5)
- `language` (string, optional) — Language (`vi` or `en`, default `vi`)

**Returns:** `{ seriesDir, tocFile, lessonFiles[] }`

### embed_images_to_markdown

**Parameters:**
- `markdown` (string, required) — Markdown with `![alt](placeholder:description)` placeholders
- `outputDir` (string, optional) — Output directory (default `./images`)
- `apiKey` (string, optional) — Gemini API key (defaults to `GEMINI_API_KEY` env var)

**Returns:** `{ markdown, images[] }`

### validate_series

**Parameters:**
- `seriesDir` (string, required) — Path to series directory

**Returns:** Report with errors, warnings, stats

## Testing

```bash
npm test -w @andy-toolforge/authoring
```
