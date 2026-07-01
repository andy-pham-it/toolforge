# @andy-toolforge/footage-generation — Image & Video Generation

> Domain package for generating images, visuals, and video content for podcasts/automation.
> The **only domain package with real implementation** — all others are skeletons.

## Structure

```
packages/footage-generation/
  lib/
    index.js      — Entry: exports { ImageGenerator, TextOverlayer, PromptWriter, LLMClient }
    generator.js  — ImageGenerator  Spawns image/video generation from script prompts
    overlay.js    — TextOverlayer  Overlays text on images (via sharp)
    writer.js     — PromptWriter  Builds prompts from templates + context
    llm.js        — LLMClient  Extends core LLMClient; adds domain methods + skill file loading
  skills/
    postinstall.js              — Symlinks skill .md files → .opencode/skills/ with prefix
    workflow-podcast-processor.md
    podcast-cover-generator.md
    browser-automation-opportunities.md
  templates/
    env.example
    prompts-template.md
  package.json    — deps: @andy-toolforge/core, sharp
```

## Key Classes

| Class | File | Purpose |
|-------|------|---------|
| `ImageGenerator` | `lib/generator.js` | Orchestrates image/video generation. `generate(script, options)`. |
| `TextOverlayer` | `lib/overlay.js` | Sharp-based text rendering on images. `overlay(imagePath, text, opts)`. |
| `PromptWriter` | `lib/writer.js` | Loads prompt templates, substitutes context variables. `buildPrompt(name, ctx)`. |
| `LLMClient` | `lib/llm.js` | **Extends core `LLMClient`** with `analyzeScript()`, `generateXxx()` and skill-file loading. |

## Domain-Specific LLM

- `lib/llm.js` extends core's `LLMClient` — never duplicates core's `chat()` logic
- Adds domain methods (`analyzeScript`, `generateEpisodeArt`, etc.)
- Reads skill files from `.opencode/skills/footage-generation-*.md` via `resolveSkillFile()`

## Skill File Rules

- Skill `.md` files live in `skills/`
- `postinstall.js` symlinks them to the client project's `.opencode/skills/` directory
- **Prefix all skill file names** with `footage-generation-` to prevent collisions with other domain packages
- LLMClient loads skills by prefix, not by full path

## Conventions

- Dependencies: `@andy-toolforge/core` + `sharp`. Never depend on another domain package.
- No footage-generation logic belongs in `@andy-toolforge/core`.
- Templates directory for reusable prompt/config examples (not node_modules).

## Testing

```bash
npm test -w @andy-toolforge/footage-generation
```
