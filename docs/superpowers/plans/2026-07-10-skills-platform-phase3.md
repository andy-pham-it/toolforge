# Skills Platform Phase 3 — Quality Pass Implementation Plan

> **For agentic workers:** Execute one batch per subagent call. Each batch produces an independent commit. Batches can run in parallel.

**Goal:** Apply prerequisites, error recovery, MCP integration, and cross-domain references to all 29 existing skill files.

**Architecture:** 5 independent batches by domain grouping. Each batch appends 4 sections (Prerequisites, Error Recovery, Integration, Related Skills) to each file. Some files also need YAML frontmatter added.

## Global Constraints

- Keep existing emoji headers (📥📤🎯📋 etc.) if present — do NOT remove them
- YAML frontmatter with `name` and `description` required for any file missing them
- `description` starts with "Use when..." and uses third person
- Add sections in this order after existing content: `## Prerequisites`, `## Error Recovery`, `## Integration`, `## Related Skills`
- Integration section MUST include `skill_mcp(mcp_name="andy-toolforge", tool_name="...")` alternative
- Integration section MUST cross-link to the domain's hub skill
- Do NOT change existing content — only append new sections
- Keep original file's style (emoji headers, code block style, etc.)

---

## Section Templates

### Prerequisites (insert after last existing section block)

```markdown
## 📋 Prerequisites

- **Input:** [what data/content the agent needs before starting]
- **API Keys:** [if any API keys are needed — which env vars]
- **Dependencies:** [npm packages, MCP tools, etc.]
- **Related skills:** [links to hub skill or related workflow skills]
```

### Error Recovery

```markdown
## ⚠️ Error Recovery

| Error | Cause | Solution |
|-------|-------|----------|
| [Error message / symptom] | [Root cause] | [Fix: try Y] |
```

### Integration

```markdown
## 🔗 Integration

**MCP Alternative:** All tools in this skill are available via MCP:
`skill_mcp(mcp_name="andy-toolforge", tool_name="<tool-name>")`

**Works with:** [list related hub skills or domain workflows]
```

### Related Skills

```markdown
## 📎 Related Skills

- `toolforge-<domain>-hub` — [description]
- `toolforge-<other-domain>-hub` — [description]
```

---

### Batch 1: voice-assistant + tts-generator (3 files, no YAML yet)

**Files:**
- Modify: `packages/voice-assistant/skills/workflow.md`
- Modify: `packages/tts-generator/skills/tts-generator-workflow.md`
- Modify: `packages/tts-generator/skills/tts-voice-selection.md`

**voice-assistant/workflow.md**
- Add YAML: name=voice-assistant-workflow, desc="Use when configuring or running voice assistant sessions for interactive AI conversations."
- Prerequisites: Input=conversation context/goal, API Keys=GEMINI_API_KEY
- Error Recovery: session timeout→retry shorter segments; voice not responding→reduce maxTurns
- Integration: skill_mcp(voice_assistant_session, voice_assistant_configure), works with tts-generator-hub

**tts-generator/tts-generator-workflow.md**
- Add YAML: name=tts-generator-workflow, desc="Use when converting podcast/video scripts to speech using Gemini TTS."
- Prerequisites: Input=script text+title, API Keys=GEMINI_API_KEY
- Error Recovery: rate limit→increase segment_delay; TTS error→retry different voice
- Integration: skill_mcp(generate_tts), works with footage-generation-hub, voice-assistant-hub

**tts-generator/tts-voice-selection.md**
- Add YAML: name=tts-voice-selection, desc="Use when choosing a Gemini TTS voice with style guidance and tone matching."
- Prerequisites: Content tone analysis, Input=script sample
- Error Recovery: voice unavailable→fallback list; tone mismatch→try multiple voices
- Integration: skill_mcp(list_tts_voices) for full catalog

---

### Batch 2: footage-generation (4 files)

**Files:**
- Modify: `packages/footage-generation/skills/batch-image-generator.md`
- Modify: `packages/footage-generation/skills/browser-automation-opportunities.md`
- Modify: `packages/footage-generation/skills/podcast-cover-generator.md`
- Modify: `packages/footage-generation/skills/workflow-podcast-processor.md`

**All:** Add YAML named footage-generation-{skill} + 4 sections.
- Prerequisites: Input=script/segment data, API Keys=GEMINI_API_KEY, Deps=sharp for overlay
- Error Recovery: image fails→retry different prompt; browser timeout→increase wait
- Integration: skill_mcp(analyze_script, generate_prompts, generate_batch_image, suggest_cover), works with tts-generator-hub, podcast-content-strategy MCP skill

---

### Batch 3: content-research + seo-generation (7 files)

**Files:**
- Modify: `packages/content-research/skills/analyzer.md`
- Modify: `packages/content-research/skills/manager.md`
- Modify: `packages/content-research/skills/ideator.md`
- Modify: `packages/content-research/skills/summarizer.md`
- Modify: `packages/seo-generation/skills/video-podcast.md` (has YAML ✓)
- Modify: `packages/seo-generation/skills/niche-blog-generator.md` (has YAML ✓)
- Modify: `packages/seo-generation/skills/content-arbitrage.md` (has YAML ✓)

**content-research (4 files):** Add YAML named content-research-{skill} + 4 sections.
- Prerequisites: vary by tool (URL, article text, topic), API Keys=GEMINI_API_KEY
- Error Recovery: LLM timeout→retry; URL not reachable→check or cache
- Integration: skill_mcp(andy_toolforge_content_summarizer etc.), works with content-operations-hub, seo-generation-hub

**seo-generation (3 files):** Already have YAML ✓. Add only 4 sections.
- Prerequisites: Input=script/text+title, API Keys=GEMINI_API_KEY
- Error Recovery: SEO fails→verify input complete and retry
- Integration: skill_mcp(toolforge_seo_generate), works with content-operations-hub

---

### Batch 4: content-operations (7 files, all have YAML ✓)

**Files:**
- Modify: `packages/content-operations/skills/script-writing.md`
- Modify: `packages/content-operations/skills/trend-discovery.md`
- Modify: `packages/content-operations/skills/seo-optimization.md`
- Modify: `packages/content-operations/skills/performance-analysis.md`
- Modify: `packages/content-operations/skills/editorial-calendar.md`
- Modify: `packages/content-operations/skills/content-repurposing.md`
- Modify: `packages/content-operations/skills/blog-writing.md`

**All:** Already have YAML ✓. Add only 4 sections.
- Prerequisites: vary per file (keyword for trends, outline for blog, etc.)
- Error Recovery: content timeout→reduce length/retry; stale data→refresh source
- Integration: skill_mcp(toolforge_content_research), works with content-research-hub, seo-generation-hub

---

### Batch 5: ba-support + book-writing + coding-support + pm-support (8 files)

**Files:**
- Modify: `packages/ba-support/skills/ba-requirement-gatherer.md` (has YAML ✓)
- Modify: `packages/ba-support/skills/ba-competitor-analysis.md`
- Modify: `packages/book-writing/skills/book-summarizer.md`
- Modify: `packages/book-writing/skills/book-writing-assistant.md`
- Modify: `packages/coding-support/skills/coding-refactoring-advisor.md`
- Modify: `packages/coding-support/skills/coding-code-reviewer.md` (has YAML ✓)
- Modify: `packages/pm-support/skills/pm-meeting-assistant.md`
- Modify: `packages/pm-support/skills/pm-project-planner.md` (has YAML ✓)

**Without YAML (5 files):** Add YAML named {domain}-{skill} + 4 sections.
- Prerequisites: vary (URL for BA, manuscript for book, code for coding)
- Error Recovery: timeout→reduce scope; too long→process incrementally
- Integration: skill_mcp for respective tools, cross-ref to hub

**With YAML (3 files):** Add only 4 sections.
- Same pattern, tailored per tool

---

### Verification

After all batches:
- Run: `npm test --workspaces` (0 failures expected)
- Spot-check 3-5 random files for correct section placement
- Verify symlinks: `.opencode/skills/` shows all skill files
