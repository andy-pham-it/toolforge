# inject_tts_tags — Design Spec

> **Status:** Approved  
> **Date:** 2026-07-12  
> **Feature:** Separate TTS tag injection from audio generation so users can preview/edit tagged scripts before generating audio.

---

## 1. Problem

`generate_tts` currently handles **both** AI tag injection and TTS audio generation in a single call. If users want to:
- Preview how tags will look before rendering audio
- Manually edit/inject custom tags between AI analysis and TTS
- Re-run TTS with the same tags (e.g., fix one segment's audio)

…they can't. Tags are injected, audio is generated, and the tagged script is discarded.

## 2. Goal

Allow users to **pre-tag** a script via a dedicated `inject_tts_tags` tool that returns both a human-readable tagged script string and structured tagged segments. The output can then be fed to `generate_tts`'s new `segments` parameter — bypassing re-injection.

## 3. Design

### 3.1. Approach

**Lightweight** — extends existing `TTSPlanner.injectTags()` with a new method `injectTagsToScript()` that chains:  
`script → plan() [auto-segment if needed] → injectTags() → tagged script reconstruction`

No new classes. No new dependencies. ~35 lines in `planner.js` + ~65 lines in `mcp-tools.js`.

### 3.2. New TTSPlanner method

```
injectTagsToScript(scriptOrSegments, title, options) → {
  tagged_script: string,        // Full script with [tag] markers
  tagged_segments: Array,       // Enhanced segments (with audioTags, pace, tone, etc.)
  metadata: Object               // From plan() if auto-segmented, else {}
}
```

**`options` object:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backend` | `string` | `'google-api'` | Tag injection backend (`'google-api'` or `'gemini-web'`) |
| `stylePrompt` | `string` | `''` | Additional style/tone guidance |
| `model` | `string` | `'gemini-3.1-flash-lite'` | Gemini model for tag injection |
| `signal` | `AbortSignal` | `undefined` | For cancellation |
| `voice` | `string` | `'auto'` | Voice override for plan() |
| `language` | `string` | `'auto'` | Language override for plan() |
| `pace` | `string` | `'normal'` | Pace override for plan() |

**Logic:**
1. If `scriptOrSegments` is a **string** → call `this.plan(scriptOrSegments, title, options)` first to auto-segment
2. If `scriptOrSegments` is an **array** → use directly as segments (skip plan)
3. Call `this.injectTags(segments, originalScript, { backend, stylePrompt, model, signal })`
4. Reconstruct `tagged_script` by joining tagged segments' text (with `[tag]` markers) with double-newlines
5. Return `{ tagged_script, tagged_segments: enhanced, metadata }`

### 3.3. New MCP tool: `inject_tts_tags`

```json
{
  "name": "inject_tts_tags",
  "description": "Analyze and enhance a podcast script with AI-generated audio tags for TTS expressiveness. Returns both a tagged script string and structured segments — preview/edit before generating audio.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "script":     { "type": "string", "description": "Full script to analyze and tag. If provided without segments, auto-segments via LLM." },
      "segments":   { "type": "array", "description": "Pre-segmented array (from a previous plan() call). If provided, script must still be the original full text." },
      "title":      { "type": "string", "description": "Episode title (required if script is provided for auto-segmenting)" },
      "style_prompt": { "type": "string", "description": "Optional style/tone guidance for tag injection" },
      "tag_backend": { "type": "string", "enum": ["google-api", "gemini-web"], "description": "AI backend for tag injection", "default": "google-api" },
      "model":      { "type": "string", "description": "Gemini model override (e.g. 'gemini-3.1-flash-lite')" }
    }
  },
  "output": {
    "tagged_script": "string - full script with [tag] markers prepended to each segment",
    "tagged_segments": "Array - enhanced segments with audioTags, pace, tone, suggestedSplit, sourceRef",
    "metadata": "Object - segmentation metadata (from plan() if auto-segmented)"
  }
}
```

### 3.4. Updates to `generate_tts`

| Change | Before | After |
|--------|--------|-------|
| `tag_backend` default | `undefined` | `null` (no auto-injection) |
| New param `segments` | — | Accept pre-tagged segments array; if provided, skip plan() and use directly |
| `script` behavior | Required | Still required if no `segments`; optional if `segments` provided |

**Logic change:** If `segments` param is provided, skip `planner.plan()` entirely and use the pre-tagged segments directly. The `tag_backend` param becomes a user-opt-in — the recommended workflow is: `inject_tts_tags` → preview → `generate_tts` with segments.

### 3.5. Tagged script format

Each segment's text with `[tag]` markers prepended, joined by blank lines:

```
[slow][philosophical] In a world where time flows like a river...

[normal][curious] But what if we could see beyond the surface?

[fast][excited] Let me tell you a story that will change everything!
```

The `[tag]` markers use the standard Gemini TTS format (lowercase, opening-only, square brackets). Tags at the start of each segment affect the delivery of that segment.

### 3.6. File changes

| File | Change |
|------|--------|
| `packages/tts-generator/lib/planner.js` | Add `injectTagsToScript()` method (+~35 lines) |
| `packages/tts-generator/mcp-tools.js` | Add `inject_tts_tags` tool definition + handler; update `generate_tts` to support `segments` param and `tag_backend: null` default (+~65 lines) |

## 4. Edge cases & error handling

| Case | Behavior |
|------|----------|
| Neither `script` nor `segments` provided | Return validation error |
| Both `script` and `segments` provided | Use `segments` directly; `script` used for `sourceRef` computation only |
| `segments` provided but `script` omitted | `sourceRef` will be null; tags injected without position tracking |
| Auto-segmentation fails | Error message: "inject_tts_tags: script auto-segmentation failed" |
| Tag injection fails | Error message: "inject_tts_tags: tag injection failed" |
| Empty segments array | Error: "inject_tts_tags: no segments to tag" |

## 5. Migration / backward compatibility

- `tag_backend` default changes from `undefined` (no auto-injection) to... wait, currently `tag_backend` defaults to `undefined` in the MCP schema, which means if not provided, **no injection happens** in the handler (line: `if (tag_backend) { ... }`). So the default change is just ergonomic — making it clearer that tag_backend is optional.
- Existing callers that pass `tag_backend` continue to work identically.
- Existing callers that don't pass `tag_backend` also continue to work (same as before — skip injection).
- New `segments` param is additive — callers that don't use it get current behavior.

## 6. Test plan

- **Unit test (planner.js):** `injectTagsToScript` with string input → verify plan() called + injectTags() called + tagged_script reconstructed
- **Unit test (planner.js):** `injectTagsToScript` with array input → verify injectTags() called, plan() skipped
- **Unit test (planner.js):** tagged_script format — verify [tag] markers appear at segment starts
- **Integration:** Call `inject_tts_tags` MCP tool with a real script → verify tagged_script and tagged_segments returned
- **Integration:** Pass output segments to `generate_tts` segements param → verify audio generated without re-injection
