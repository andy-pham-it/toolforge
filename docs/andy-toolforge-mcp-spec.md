# andy-toolforge MCP — Specification & Implementation Plan

**Target:** MCP Server `andy-toolforge`  
**Architecture:** Config-driven, domain-agnostic, pluggable  
**Version:** 2.0  
**Date:** 2025-07-03

---

## 📋 Executive Summary

This specification defines a **general-purpose, config-driven** MCP toolset for content governance, asset lifecycle automation, and quality assurance. The tools are designed to work with **any content repository** that follows a series-based Markdown structure — not tied to Vietnamese, not tied to a specific domain taxonomy, not tied to any particular naming convention.

The reference implementation will be validated against a real production project: a Vietnamese knowledge base with **118 series** across **7 content domains** (pm, ai, finance, system, ta, it, network).

---

## 🏗️ Architecture Overview

```
andy-toolforge MCP Server
├── governance/          # Lint, validate, auto-fix metadata & structure
├── assets/              # Unified asset pipeline (prompt → fetch → optimize → embed)
├── lifecycle/           # Scaffold, sync, rename series
├── content/             # Quality review, SEO, ideation
└── analysis/            # Script analysis, competitor research, cover design
```

**Key Design Principle:** Every domain-specific value (field names, allowed values, naming patterns) is **configurable** — not hardcoded. The tool loads a `toolforge.config.ts` (or JSON) at initialization that maps the project's own conventions.

---

## ⚙️ Config-Driven Architecture (The Core)

### 2.1 Concept

The entire toolset reads its rules from a **project config file**, not from hardcoded values. This means:

- **This Vietnamese project** → config defines `domain: ['pm', 'ai', 'finance', ...]`, naming `00-muc-luc.md`, etc.
- **A French blog** → config defines `domaine: ['tech', 'design']`, naming `index.md`, etc.
- **A corporate wiki** → config defines `department: ['eng', 'product']`, naming `README.md`, etc.

**No code changes needed between projects — just a different config file.**

### 2.2 Config Schema

```typescript
// toolforge.config.ts — project authors create this once

interface ProjectConfig {
  /** Root directory containing all series (default: project root) */
  seriesRoot: string;

  /** Pattern to recognize series directories (default: contains series marker file) */
  seriesDiscovery: {
    /** Marker file that identifies a directory as a "series" */
    markerFile: string;                    // Default: '00-muc-luc.md'
    /** Glob pattern for series dirs (alternative to markerFile) */
    globPattern?: string;
  };

  /** Metadata comment configuration */
  metadata: {
    /** Regex pattern to extract metadata comment from file */
    commentPattern: string;                // Default: '<!--\\s*(.+?)\\s*-->'
    /** Delimiter between key-value pairs */
    delimiter: string;                     // Default: '|'
    /** Key-value separator */
    separator: string;                     // Default: ':'
    /** Required fields for each series */
    requiredFields: string[];              // Default: ['domain', 'level', 'files']
    /** Optional fields */
    optionalFields: string[];              // Default: ['tags', 'case-study', 'exercises',
                                           //           'prerequisites', 'next']
    /** Valid values per field (validation) */
    allowedValues: Record<string, string[]>; // Default: see §Domain Config below
  };

  /** File naming rules */
  fileNaming: {
    /** Pattern for content files (capture groups: number, slug, extension) */
    pattern: string;                       // Default: '^(\\d{2})-(.+)\\.md$'
    /** Reserved filename prefixes and their meaning */
    reservedPrefixes: Record<string, string>; // Default: see §Naming Config below
    /** Whether files must be sequential without gaps */
    enforceSequence: boolean;              // Default: true
  };

  /** Asset (image) pipeline */
  assets: {
    /** Root directory for images */
    rootDir: string;                       // Default: 'public/images'
    /** Accepted formats (in order of preference) */
    formats: { format: string; quality: number; width: number; height: number }[];
    /** Prompt file naming pattern ({series} placeholder) */
    promptFilePattern: string;             // Default: '_private/image-prompts-{series}.md'
    /** Image filename naming pattern ({series} placeholder) */
    imageFilePattern: string;              // Default: '{series-abbrev}-NN-{slug}.{ext}'
    /** Alt text template ({section}, {series} placeholders) */
    altTemplate: string;                   // Default: '{section} — {series}'
  };

  /** Registry file (where series list is maintained) */
  registry: {
    /** Path to registry file */
    path: string;                          // Default: 'lib/content.ts'
    /** Export name of the series array */
    exportName: string;                    // Default: 'SERIES_DIRS'
    /** Language for generated code (ts, js, json) */
    format: 'ts' | 'js' | 'json';         // Default: 'ts'
  };

  /** Language defaults */
  language: {
    default: string;                       // Default: 'vi'
    supported: string[];                   // Default: ['vi', 'en']
  };

  /** External tool paths */
  externalTools: {
    /** Script paths that the tool can wrap as subprocesses */
    scripts: Record<string, string>;
  };
}
```

### 2.3 Reference Config (Vietnamese Project)

```typescript
// toolforge.config.ts — Vietnamese knowledge base
export default {
  seriesRoot: '.',
  seriesDiscovery: { markerFile: '00-muc-luc.md' },

  metadata: {
    commentPattern: '<!--\\s*(.+?)\\s*-->',
    delimiter: '|',
    separator: ':',
    requiredFields: ['domain', 'level', 'files'],
    optionalFields: ['tags', 'case-study', 'exercises', 'prerequisites', 'next'],
    allowedValues: {
      domain: ['pm', 'ai', 'finance', 'system', 'ta', 'it', 'network'],
      level: ['beginner', 'intermediate', 'advanced'],
      'case-study': ['yes', 'no'],
      exercises: ['yes', 'no'],
    },
  },

  fileNaming: {
    pattern: '^(\\d{2})-(.+)\\.md$',
    reservedPrefixes: {
      '00': 'muc-luc',
      '01': 'tong-quan',
      '09': 'case-study',
      '10': 'bai-tap',
    },
    enforceSequence: true,
  },

  assets: {
    rootDir: 'public/images',
    formats: [
      { format: 'jpeg', quality: 80, width: 1600, height: 900 },
      { format: 'webp', quality: 80, width: 1600, height: 900 },
    ],
    promptFilePattern: '_private/image-prompts-{series}.md',
    imageFilePattern: '{series-abbrev}-NN-{slug}.{ext}',
    altTemplate: '{section} — {series}',
  },

  registry: {
    path: 'lib/content.ts',
    exportName: 'SERIES_DIRS',
    format: 'ts',
  },

  language: { default: 'vi', supported: ['vi', 'en'] },

  externalTools: {
    scripts: {
      geminiFetch: '_private/gemini-batch-download.cjs',
      compressImages: 'scripts/compress-images.sh',
    },
  },
} satisfies ProjectConfig;
```

### 2.4 Config Schema (JSON Schema for IDE Autocomplete)

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "title": "andy-toolforge Config",
  "type": "object",
  "properties": {
    "seriesRoot": { "type": "string" },
    "seriesDiscovery": {
      "type": "object",
      "properties": {
        "markerFile": { "type": "string" },
        "globPattern": { "type": "string" }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "commentPattern": { "type": "string" },
        "delimiter": { "type": "string" },
        "separator": { "type": "string" },
        "requiredFields": { "type": "array", "items": { "type": "string" } },
        "optionalFields": { "type": "array", "items": { "type": "string" } },
        "allowedValues": { "type": "object" }
      },
      "required": ["requiredFields", "allowedValues"]
    },
    "fileNaming": {
      "type": "object",
      "properties": {
        "pattern": { "type": "string" },
        "reservedPrefixes": { "type": "object" }
      }
    },
    "assets": {
      "type": "object",
      "properties": {
        "rootDir": { "type": "string" },
        "formats": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "format": { "type": "string", "enum": ["jpeg", "webp", "png", "avif"] },
              "quality": { "type": "integer", "minimum": 1, "maximum": 100 },
              "width": { "type": "integer" },
              "height": { "type": "integer" }
            }
          }
        }
      }
    },
    "registry": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "exportName": { "type": "string" },
        "format": { "type": "string", "enum": ["ts", "js", "json"] }
      }
    },
    "language": {
      "type": "object",
      "properties": {
        "default": { "type": "string" },
        "supported": { "type": "array", "items": { "type": "string" } }
      }
    }
  },
  "required": ["metadata", "fileNaming"]
}
```

---

## 📊 Reference Project Scan Results

The following real-world data was extracted from the reference project (Vietnamese knowledge base) to validate the tool design. **This is NOT hardcoded** — it's the output you get when running this tool against the reference project.

### Scan Summary

| Metric | Value |
|--------|-------|
| Total series (with valid metadata) | **118** |
| Actual domains in use | **7** (pm: 50, ai: 21, finance: 15, system: 12, ta: 10, it: 7, network: 3) |
| Levels | **3** (beginner: 31, intermediate: 57, advanced: 30) |
| File count range | 6–18 (most common: 7, 10, 8) |
| case-study: yes | 105 / 118 (89%) |
| exercises: yes | ~68 / 118 (58%) |
| Series with images | 13 / 118 (11%) |
| `prerequisites` usage | 0 / 118 |
| `next` usage | 0 / 118 |

### Metadata Inconsistencies Found (Why Governance Is Needed)

| Issue | Count | Example |
|-------|-------|---------|
| Extra spaces before `\|` separator | 70/118 | `case-study:yes \| exercises:yes  \| tags:...` (double space) |
| Trailing whitespace inside comment | 118/118 | `...tags:x -->` (space before `-->`) |
| Wrong field order (tags before files) | 17/118 | `tags:... \| files:...` instead of `files:... \| tags:...` |
| Empty/missing field values | 1/118 | `case-study:` with no value |

### Image Naming Convention (Discovered)

```
{series-abbrev}-NN-{slug}.jpg
Example: ta-quant-01-strategy-components.jpg
         finance-03-budget-spending.jpg
```

Images are embedded inline with `![Alt text](/images/<series>/<filename>.jpg)` but **no `_Image-name:` caption lines** are used (contrary to the documentation in AGENTS.md).

### Key Design Insight

The reference project has **0 uses** of `prerequisites` or `next` metadata fields — yet they exist in the `SeriesMeta` type. This suggests:
- Either they were planned but never adopted
- Or the tool should support them but not require them

**Config-driven design handles this:** `optionalFields: ['prerequisites', 'next']` → validated only when present.

---

## 📦 Module 1: GOVERNANCE

### 1.1 `governance_lint`

**Purpose:** Validate series metadata and file structure against config rules.

**Input Schema:**
```typescript
interface GovernanceLintInput {
  seriesDir: string;                    // e.g., "quan-ly-du-an"
  fix?: boolean;                        // Auto-fix mode
  strict?: boolean;                     // Fail on warnings
  configOverrides?: Partial<ProjectConfig>; // Override project config per run
}
```

**Validation Rules (config-driven):**

The rules below show **default behavior** for the reference project. When the `allowedValues` in config change, rule validation changes accordingly — **no code changes needed**.

| Rule ID | Check | Based on Config Field | Auto-fix |
|---------|-------|----------------------|----------|
| `META_001` | Line 1 is HTML comment | `commentPattern` | ❌ |
| `META_002` | Required fields present | `requiredFields` | ❌ |
| `META_003` | Field values ∈ `allowedValues` | `allowedValues` | ✅ (first value) |
| `META_004` | `files` count matches actual `.md` count | `reservedPrefixes` | ❌ |
| `META_005` | Optional fields follow format | `optionalFields` | ✅ |
| `FILE_001` | `markerFile` exists | `seriesDiscovery.markerFile` | ❌ |
| `FILE_002` | Files match `pattern` regex | `fileNaming.pattern` | ✅ (rename) |
| `FILE_003` | No gaps in sequence | `enforceSequence` | ❌ |
| `FILE_004` | Special files match `reservedPrefixes` | `reservedPrefixes` | ❌ |
| `IMG_001` | Image dir exists if images referenced | `assets.rootDir` | ✅ (mkdir) |
| `IMG_002` | All referenced images exist on disk | — | ❌ |
| `IMG_003` | Images use preferred format | `assets.formats[0]` | ✅ (convert) |

**Output Schema:**
```typescript
interface GovernanceLintOutput {
  seriesDir: string;
  configApplied: string;               // Config version used
  passed: boolean;
  errors: LintIssue[];
  warnings: LintIssue[];
  info: LintIssue[];
  fixed: boolean;
}

interface LintIssue {
  ruleId: string;
  message: string;
  file?: string;
  line?: number;
  fixable: boolean;
}
```

### 1.2 `governance_check_all`

**Purpose:** Run lint across all discovered series, aggregate report.

```typescript
interface GovernanceCheckAllInput {
  seriesDirs?: string[];           // Default: auto-discover using config
  parallel?: boolean;              // Default: true
  outputFormat?: 'json' | 'markdown' | 'summary'; // Default: 'summary'
}
```

**Reference Project Output (Example):**
```
╔══════════════════════════════════════════╗
║  andy-toolforge governance check-all     ║
║  Project: Vietnamese Knowledge Base      ║
║  Config: v1, 118 series discovered       ║
╚══════════════════════════════════════════╝

❶ METADATA
   META_001 (missing comment): 2/118 ❌
   META_002 (missing fields): 0/118 ✅
   META_003 (invalid values): 1/118 ❌
   META_004 (file count mismatch): 12/118 ⚠️

❷ FILE STRUCTURE
   FILE_001 (missing marker file): 0/118 ✅
   FILE_002 (invalid naming): 3/118 ❌
   FILE_003 (sequence gaps): 0/118 ✅

❸ ASSETS
   IMG_001 (missing images dir): 105/118 ⚠️
   IMG_002 (missing referenced images): 0/13 ✅
```

### 1.3 `governance_fix`

**Purpose:** Auto-fix fixable violations.

```typescript
interface GovernanceFixInput {
  seriesDir: string;
  dryRun?: boolean;        // Default: false
  rules?: string[];        // Specific rule IDs (default: all fixable)
}
```

Fix logic derives from config:
- `META_003`: Replace invalid `domain` with `allowedValues.domain[0]`
- `FILE_002`: Rename files to match `fileNaming.pattern`
- `IMG_003`: Convert via `sharp` to `assets.formats[0]` config

---

## 📦 Module 2: ASSETS (Asset Pipeline)

### 2.1 `assets_gen_prompts`

**Purpose:** Generate image prompt template from series content files.

```typescript
interface AssetsGenPromptsInput {
  seriesDir: string;
  outputPath?: string;       // Default: from config.assets.promptFilePattern
  template?: 'default' | 'detailed' | 'minimal';
  overwrite?: boolean;
}
```

**Logic:** Reads the series `markerFile` (e.g., `00-muc-luc.md`) → extracts section links → generates one prompt block per content file.

**Config-aware:** Output path respects `config.assets.promptFilePattern` (replacing `{series}`).

### 2.2 `assets_fetch`

**Purpose:** Download images via Gemini (wraps Puppeteer script).

```typescript
interface AssetsFetchInput {
  seriesDir: string;
  promptFile?: string;       // Default: from config
  outputDir?: string;        // Default: config.assets.rootDir / seriesDir
  headless?: boolean;
  resume?: boolean;          // Skip existing files
  concurrency?: number;      // Default: 2
  timeoutMs?: number;        // Default: 120000
}
```

**Behavior:**
1. Read prompt file (path from config) → parse `## NAME:` blocks
2. For each: launch Puppeteer → navigate Gemini → input prompt → click "Download full size" → save as PNG
3. Retry failed downloads up to 3x with exponential backoff
4. Save to `config.assets.rootDir / seriesDir /`

### 2.3 `assets_optimize`

**Purpose:** Compress images to target format/size using `sharp`.

```typescript
interface AssetsOptimizeInput {
  seriesDir: string;
  inputDir?: string;
  outputDir?: string;        // Default: same (overwrite)
  format?: string;           // Override config default
  width?: number;
  height?: number;
  quality?: number;
  deleteOriginals?: boolean; // Default: true
  parallel?: boolean;        // Default: true
}
```

**Config-awareness:** Defaults come from `config.assets.formats[0]`. The `format` param can override.

### 2.4 `assets_embed` ⭐

**Purpose:** Auto-embed images into Markdown files.

```typescript
interface AssetsEmbedInput {
  seriesDir: string;
  imagesDir?: string;
  dryRun?: boolean;
  strategy?: 'by-filename' | 'by-order' | 'by-alt-text'; // Default: 'by-filename'
  altTemplate?: string;      // Default: from config.assets.altTemplate
}
```

**Reference Project Behavior (based on scan):**
- Image filenames: `{series-abbrev}-NN-{slug}.jpg` (e.g., `ta-quant-09-feature-importance.jpg`)
- Images exist in `public/images/<series-dir>/`
- No `_Image-name:` caption lines currently exist
- Images embedded with simple `![Alt](/images/<series>/<file>.jpg)`

**Matching Logic:**
1. Scan `imagesDir` for images
2. Extract `{slug}` from filename (based on config pattern)
3. Find `.md` file whose section title matches `{slug}` (with fuzzy match and multilingual support)
4. Insert after the section heading

### 2.5 `assets_pipeline` ⭐

**Purpose:** Orchestrate full pipeline in one command.

```typescript
interface AssetsPipelineInput {
  seriesDir: string;
  steps?: ('gen-prompts' | 'fetch' | 'optimize' | 'embed')[];
  continueOnError?: boolean;
  // Per-step options passthrough
}
```

---

## 📦 Module 3: LIFECYCLE

### 3.1 `lifecycle_init`

**Purpose:** Scaffold a new series directory.

```typescript
interface LifecycleInitInput {
  name: string;              // Kebab-case directory name
  title: string;             // Human-readable title
  /** Dynamic fields from config.requiredFields + config.optionalFields */
  metadata: Record<string, string>;
  /** File count excludes reserved files (from config.reservedPrefixes) */
  estimatedFiles?: number;
  updateRegistry?: boolean;  // Default: true
}
```

**Key design:** `metadata` is dynamic — any fields defined in `config.metadata.requiredFields` and `config.metadata.optionalFields` are accepted. No hardcoded domain/level list.

**Generated files:** Based on `config.fileNaming.reservedPrefixes`:
- `00-{prefix}.md` for each reserved prefix (e.g., `00-muc-luc.md`, `01-tong-quan-{slug}.md`)
- `NN-{topic}.md` for content files based on `estimatedFiles`

### 3.2 `lifecycle_sync`

**Purpose:** Sync registry with filesystem.

```typescript
interface LifecycleSyncInput {
  dryRun?: boolean;
  sort?: 'alpha' | 'domain';    // Sort logic
  backup?: boolean;
}
```

**Config-awareness:**
- Discover series using `config.seriesDiscovery.markerFile` or `globPattern`
- Update `config.registry.path` at `config.registry.exportName`

### 3.3 `lifecycle_rename`

**Purpose:** Rename series directory and update all references.

```typescript
interface LifecycleRenameInput {
  oldName: string;
  newName: string;
  dryRun?: boolean;
}
```

**Updates:** Directory, image directory, prompt file, registry, cross-references.

---

## 📦 Module 4: CONTENT QUALITY

Wraps existing `andy-toolforge` MCP tools (`article_manager`, `seo_generate`, `content_ideator`).

- `content_review` — Batched article classification + tagging + summary
- `content_seo` — Batched SEO metadata generation (YouTube, TikTok, Facebook)
- `content_ideate` — New series idea generation with structure proposals

These tools are domain-agnostic — they take text content and generate metadata. No project config needed.

---

## 📦 Module 5: ANALYSIS & RESEARCH

Wraps existing `andy-toolforge` MCP tools (`analyze_script`, `competitor_analyzer`, `suggest_cover`).

- `analyze_script` — Podcast/video script → segments + image prompts + music mapping
- `analyze_competitor` — URL → SWOT analysis + content gaps
- `suggest_cover` — Title + description → visual brief + color palette + generation prompt

---

## 🔧 Core Utilities

### ProjectConfig Loader

```typescript
// Internal implementation
export function loadConfig(cwd: string): ProjectConfig {
  // 1. Look for toolforge.config.ts (or .js, .json)
  // 2. If not found, use defaults + emit warning
  // 3. Validate against schema (zod)
  // 4. Resolve all paths relative to cwd
  // 5. Return merged config
}
```

### Series Discovery

```typescript
export function discoverSeries(config: ProjectConfig): string[] {
  // 1. Scan config.seriesRoot for directories containing config.seriesDiscovery.markerFile
  // 2. Or use globPattern if provided
  // 3. Return sorted array of directory names
}
```

### Metadata Parser

```typescript
interface ParsedMetadata {
  fields: Record<string, string>;
  raw: string;
  lineNumber: number;
}

export function parseMetadataComment(
  filePath: string,
  config: ProjectConfig
): ParsedMetadata | null {
  // 1. Read marker file
  // 2. Match commentPattern regex
  // 3. Split by delimiter → key:value pairs
  // 4. Trim whitespace
  // 5. Return structured result
}
```

---

## 📦 MCP Manifest (package.json)

```json
{
  "name": "@andy-toolforge/mcp",
  "version": "2.0.0",
  "description": "Content governance & asset lifecycle MCP toolkit. Config-driven, domain-agnostic.",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "andy-toolforge": "dist/cli.js" },
  "keywords": ["mcp", "content-governance", "asset-pipeline", "lint", "markdown"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/cli.ts",
    "mcp": "node dist/index.js",
    "test": "vitest",
    "test:fixtures": "vitest run --config vitest.fixtures.config.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "commander": "^12.0.0",
    "sharp": "^0.33.0",
    "remark": "^15.0.0",
    "remark-parse": "^11.0.0",
    "remark-stringify": "^11.0.0",
    "unist-util-visit": "^5.0.0",
    "glob": "^11.0.0",
    "yaml": "^2.5.0",
    "zod": "^3.23.0",
    "chalk": "^5.3.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0",
    "tsx": "^4.16.0",
    "vitest": "^2.0.0"
  }
}
```

---

## 🧪 Testing Strategy

### Test Fixtures

Create a `test/fixtures/` directory with sample project structures:

```
test/fixtures/
├── reference-project/      # Mirror of real project (subset)
│   ├── pm-sample-series/
│   │   ├── 00-muc-luc.md
│   │   ├── 01-tong-quan-abc.md
│   │   └── ...
│   └── toolforge.config.ts
├── minimal-project/        # Minimal config (English)
│   ├── my-series/
│   │   ├── 00-index.md
│   │   └── 01-intro.md
│   └── toolforge.config.json
├── edge-cases/             # Intentionally broken
│   ├── missing-meta-series/
│   └── bad-naming-series/
└── fixtures.test.ts        # Test definitions
```

### Test Layers

| Layer | Tools | What It Tests |
|-------|-------|---------------|
| Unit | `vitest` | `parseMetadataComment()`, `discoverSeries()`, `loadConfig()` — pure functions |
| Integration | `vitest` + fixtures | Full pipeline on minimal-project and edge-cases |
| Config-agnostic | `vitest` | Same test suite passes with different configs |
| E2E | Playwright | `assets_fetch` Gemini interaction (requires Chrome) |
| Regression | Golden snapshots | `governance_lint` output, `assets_embed` markdown diff |

---

## 🚀 Implementation Phases

| Phase | Tools | Est. Effort | Depends On | Cross-Project Ready |
|-------|-------|-------------|------------|-------------------|
| **1** | `core` — Config loader, series discovery, metadata parser | 2-3 days | None | ✅ Foundation |
| **2** | `governance_lint`, `governance_check_all` | 2-3 days | Phase 1 | ✅ Config-driven |
| **3** | `assets_embed` | 3-4 days | Phase 1, `remark`/`sharp` | ✅ Config pattern |
| **4** | `assets_fetch`, `assets_optimize`, `assets_gen_prompts` | 3-4 days | Phase 1, Puppeteer | ⚠️ Gemini-specific fetch |
| **5** | `assets_pipeline` (orchestrator) | 2 days | Phase 2, 3, 4 | ✅ Orchestrator is generic |
| **6** | `lifecycle_init`, `lifecycle_sync`, `lifecycle_rename` | 2-3 days | Phase 1 | ✅ Config-driven |
| **7** | `governance_fix` | 2-3 days | Phase 2 | ✅ Config-driven |
| **8** | `content_review`, `content_seo`, `content_ideate` | 1-2 days | Existing andy-toolforge MCP | ✅ Generic wrappers |
| **9** | `analyze_script`, `analyze_competitor`, `suggest_cover` | 1-2 days | Existing andy-toolforge MCP | ✅ Generic wrappers |

**Total:** ~18-26 days for full implementation. Phase 1-2-3 provides immediate value.

---

## 🔐 Cross-Project Readiness Checklist

| Feature | This Project | Other Project A | Other Project B |
|---------|-------------|-----------------|-----------------|
| Domain values | `pm, ai, finance, system, ta, it, network` | `tech, design, business` | `engineering, product, marketing` |
| Marker file | `00-muc-luc.md` | `index.md` | `_toc.md` |
| File pattern | `^(\\d{2})-(.+)\\.md$` | `^(.+)\\.md$` | `^[A-Z].+\\.md$` |
| Reserved prefixes | `00, 01, 09, 10` | `00, 01` | (none) |
| Image format | `jpeg` 1600×900 80% | `webp` 1200×800 85% | `avif` 1920×1080 75% |
| Image dir | `public/images/` | `assets/images/` | `static/img/` |
| Registry export | `SERIES_DIRS` in `lib/content.ts` | `CATEGORIES` in `src/config.ts` | `topics.json` |
| Language | `vi` | `en` | `fr, en` |

**All of these differences are handled by changing the config file — no code changes.**

---

## 📝 Migration Notes

### For the Reference Project

| Current Manual Step | New MCP Tool | Config File Changes Needed |
|---------------------|-------------|---------------------------|
| Create `00-muc-luc.md` manually | `lifecycle_init` | `toolforge.config.ts` |
| Edit `SERIES_DIRS` in `lib/content.ts` | `lifecycle_sync` | Already matches |
| Write `_private/image-prompts-*.md` | `assets_gen_prompts` | Already matches |
| Run `node _private/gemini-batch-download.cjs` | `assets_fetch` | `externalTools.scripts.geminiFetch` |
| Run `bash scripts/compress-images.sh` | `assets_optimize` | `assets.formats` |
| Manual `![Alt](...)` insert | `assets_embed` | `assets.altTemplate` |

### For a New Project (e.g., English Technical Blog)

```
1. npm install @andy-toolforge/mcp
2. Create toolforge.config.json:
   {
     "seriesDiscovery": { "markerFile": "index.md" },
     "metadata": {
       "requiredFields": ["category", "difficulty"],
       "allowedValues": {
         "category": ["frontend", "backend", "devops"],
         "difficulty": ["beginner", "intermediate", "advanced"]
       }
     },
     "fileNaming": { "pattern": "^(.+)\\.md$" },
     "assets": {
       "rootDir": "static/img",
       "formats": [{ "format": "webp", "quality": 85, "width": 1200, "height": 800 }]
     },
     "registry": { "path": "src/topics.json", "format": "json" }
   }
3. Run: andy-toolforge governance check-all
4. Start creating content!
```

---

## 📚 Appendix: Field Reference (from Reference Project Scan)

### Actual Metadata Fields In Use

| Field | Required | Type | Actual Values Found | Coverage |
|-------|----------|------|--------------------|----------|
| `domain` | ✅ | enum | `pm, ai, finance, system, ta, it, network` | 118/118 (100%) |
| `level` | ✅ | enum | `beginner, intermediate, advanced` | 118/118 (100%) |
| `files` | ✅ | int | 6–18 (peaks at 7, 10, 8) | 118/118 (100%) |
| `case-study` | ❌ | bool | `yes, no` | 118/118 (100%) |
| `exercises` | ❌ | bool | `yes, no` | 117/118 (99% — 1 missing) |
| `tags` | ❌ | csv | 150+ unique tags | 118/118 (100%) |
| `prerequisites` | ❌ | csv | *(never used)* | 0/118 |
| `next` | ❌ | string | *(never used)* | 0/118 |

### Actual Domain Distribution

```
pm        ████████████████████████████████████████████████████  50 (42%)
ai        ████████████████████                                  21 (18%)
finance   ███████████████                                       15 (13%)
system    ████████████                                          12 (10%)
ta        ██████████                                            10 (8%)
it        ███████                                                7 (6%)
network   ███                                                    3 (3%)
```

### Actual Level Distribution

```
intermediate  ████████████████████████████████████████████████████  57 (48%)
beginner      ██████████████████████████████████                    31 (26%)
advanced      ██████████████████████████████████                    30 (25%)
```

---

*End of Specification v2.0*
