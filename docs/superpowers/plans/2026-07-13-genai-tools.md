# genai-tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `@andy-toolforge/genai-tools` package with two MCP tools — `search_grounding` (Google Search–grounded LLM answers) and `extract_structured` (schema-constrained JSON extraction from text) — auto-discovered by the MCP plugin system.

**Architecture:** New domain package under `packages/genai-tools/` with a GenAIClient wrapper around `@google/genai` SDK, two tool modules, an MCP plugin connector, and a skills file. The MCP server auto-discovers tools via `_loadPluginTools()` — no changes to `packages/mcp` needed.

**Tech Stack:** Node.js (CommonJS), `@google/genai` v2.10.0+, `@andy-toolforge/core` (Logger reference), `node:test` for unit tests.

## Global Constraints

- CommonJS (`require` / `module.exports`) — no ESM.
- All source files under `packages/genai-tools/lib/`.
- Package scope: `@andy-toolforge/genai-tools`.
- All unit tests use Node built-in `node:test` / `node:assert` — no jest/mocha/vitest.
- No changes to `packages/mcp` — tools auto-register via plugin discovery.
- API key read from `process.env.GEMINI_API_KEY`, fallback `process.env.GOOGLE_API_KEY`.
- Model defaults: `gemini-2.5-flash` (primary), `gemini-3.1-flash-lite` (cheap fallback). `gemma-4-9b-it` only for extract_structured (lightweight extraction).
- Skill file: `packages/genai-tools/skills/genai-tools.md`, installed to `.opencode/skills/genai-tools-tools.md`.

---
### Task 1: Scaffold Package

**Files:**
- Create: `packages/genai-tools/package.json`
- Create: `packages/genai-tools/lib/index.js` (stub)
- Modify: `package.json` (root — add workspace entry)

**Interfaces:**
- Produces: An installable npm package `@andy-toolforge/genai-tools@0.1.0`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@andy-toolforge/genai-tools",
  "version": "0.1.0",
  "private": true,
  "description": "Google GenAI SDK tools: search grounding, structured extraction",
  "main": "lib/index.js",
  "engines": { "node": ">=18" },
  "dependencies": {
    "@google/genai": "^2.10.0",
    "@andy-toolforge/core": "^1.0.0"
  },
  "scripts": {
    "test": "node --test lib/**/*.test.js"
  }
}
```

- [ ] **Step 2: Create stub index.js**

```js
'use strict';

module.exports = {};
```

- [ ] **Step 3: Add workspace to root package.json**

Root `/Users/admin/personal/toolforge/package.json` — add `"packages/genai-tools"` to the `"workspaces"` array (insert it alphabetically, e.g. after `"packages/footage-generation"`).

- [ ] **Step 4: Run npm install**

Run: `npm install` from repo root
Expected: symlink created in `node_modules/@andy-toolforge/genai-tools → ../../packages/genai-tools`

- [ ] **Step 5: Verify package loads**

Run: `node -e "require('@andy-toolforge/genai-tools'); console.log('OK')"`
Expected: logs "OK"

- [ ] **Step 6: Create directory structure**

Run: `mkdir -p packages/genai-tools/lib/tools packages/genai-tools/skills`
Expected: directories exist

- [ ] **Step 7: Commit**

```bash
git add packages/genai-tools/ package.json package-lock.json
git commit -m "feat: scaffold @andy-toolforge/genai-tools package"
```

---

### Task 2: GenAI Client Wrapper

**Files:**
- Create: `packages/genai-tools/lib/genai-client.js`
- Create: `packages/genai-tools/lib/genai-client.test.js`

**Interfaces:**
- Consumes: `@google/genai` SDK, `process.env.GEMINI_API_KEY` / `GOOGLE_API_KEY`
- Produces: `GenAIClient` class with `generateContent({ model, prompt, config })` and `resolveApiKey()` static.

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('GenAIClient', () => {
  it('throws if no API key available', async () => {
    // Temporarily clear keys
    const key = process.env.GEMINI_API_KEY;
    const key2 = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      const { GenAIClient } = require('./genai-client');
      assert.throws(() => new GenAIClient(), /GEMINI_API_KEY|GOOGLE_API_KEY/);
    } finally {
      if (key) process.env.GEMINI_API_KEY = key;
      if (key2) process.env.GOOGLE_API_KEY = key2;
    }
  });

  it('resolves apiKey from GEMINI_API_KEY first', () => {
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GOOGLE_API_KEY = 'goog-key';
    try {
      const { GenAIClient } = require('./genai-client');
      assert.equal(GenAIClient.resolveApiKey(), 'gem-key');
    } finally {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it('falls back to GOOGLE_API_KEY', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = 'goog-key';
    try {
      const { GenAIClient } = require('./genai-client');
      assert.equal(GenAIClient.resolveApiKey(), 'goog-key');
    } finally {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it('calls generateContent with correct args', async () => {
    const { GenAIClient } = require('./genai-client');
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const client = new GenAIClient();
      const mockResult = { text: 'hello' };
      client._client = {
        models: {
          generateContent: mock.fn(() => Promise.resolve(mockResult)),
        },
      };
      const result = await client.generateContent({
        model: 'gemini-2.5-flash',
        prompt: 'test',
        config: { temperature: 0.5 },
      });
      assert.equal(result.text, 'hello');
      assert.equal(client._client.models.generateContent.mock.calls.length, 1);
      const call = client._client.models.generateContent.mock.calls[0];
      assert.equal(call.arguments[0].model, 'gemini-2.5-flash');
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/genai-tools/lib/genai-client.test.js`
Expected: 4 tests, all FAIL (module not found or errors)

- [ ] **Step 3: Write minimal implementation**

```js
'use strict';

const { GoogleGenAI } = require('@google/genai');

class GenAIClient {
  constructor(apiKey) {
    apiKey = apiKey || GenAIClient.resolveApiKey();
    if (!apiKey) {
      throw new Error('GenAIClient: GEMINI_API_KEY or GOOGLE_API_KEY must be set');
    }
    this._client = new GoogleGenAI({ apiKey });
  }

  static resolveApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  /**
   * Generate content via the specified model.
   * @param {object} opts
   * @param {string} opts.model — Model name (e.g. 'gemini-2.5-flash')
   * @param {string} opts.prompt — User prompt text
   * @param {object} [opts.config] — Additional config (tools, responseSchema, etc.)
   * @returns {Promise<{text: string, raw: object}>}
   */
  async generateContent({ model, prompt, config = {} }) {
    const response = await this._client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config,
    });
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, raw: response };
  }
}

module.exports = { GenAIClient };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/genai-tools/lib/genai-client.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/genai-tools/lib/genai-client.js packages/genai-tools/lib/genai-client.test.js
git commit -m "feat(genai-tools): add GenAIClient wrapper"
```

---

### Task 3: search_grounding Tool

**Files:**
- Create: `packages/genai-tools/lib/tools/search-grounding.js`
- Create: `packages/genai-tools/lib/tools/search-grounding.test.js`

**Interfaces:**
- Consumes: `GenAIClient` (from Task 2)
- Produces: `async function searchGrounding({ query, model })` returning `{ answer, citations: [{title, uri, snippet}], model }`

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('searchGrounding', () => {
  it('returns answer with citations on success', async () => {
    const { searchGrounding } = require('./search-grounding');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: 'The Eiffel Tower is in Paris.',
        raw: {
          candidates: [{
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: 'https://example.com', title: 'Example' } }
              ],
              groundingSupports: [
                { segment: { text: 'Eiffel Tower' }, groundingChunkIndices: [0], confidenceScores: [0.95] }
              ]
            }
          }]
        }
      })),
    };

    const result = await searchGrounding(mockClient, {
      query: 'Where is the Eiffel Tower?',
      model: 'gemini-2.5-flash',
    });

    assert.ok(result.answer.includes('Paris'));
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].uri, 'https://example.com');
    assert.equal(result.citations[0].title, 'Example');
    assert.equal(result.model, 'gemini-2.5-flash');
  });

  it('returns empty citations when grounding is missing', async () => {
    const { searchGrounding } = require('./search-grounding');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: 'Some answer.',
        raw: { candidates: [{ content: { parts: [{ text: 'Some answer.' }] } }] },
      })),
    };

    const result = await searchGrounding(mockClient, {
      query: 'Test question',
    });

    assert.ok(result.answer);
    assert.deepEqual(result.citations, []);
  });

  it('throws if query is empty', async () => {
    const { searchGrounding } = require('./search-grounding');
    const mockClient = { generateContent: mock.fn() };
    await assert.rejects(
      () => searchGrounding(mockClient, { query: '', model: 'gemini-2.5-flash' }),
      /query/
    );
  });

  it('uses default model when not specified', async () => {
    const { searchGrounding } = require('./search-grounding');
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const { GenAIClient } = require('../genai-client');
      const client = new GenAIClient();
      client._client = {
        models: {
          generateContent: mock.fn(() => Promise.resolve({ text: 'ok', raw: {} })),
        },
      };
      const result = await searchGrounding(client, { query: 'test' });
      // Verify the config passed includes googleSearch tool
      const call = client._client.models.generateContent.mock.calls[0];
      assert.ok(call.arguments[0].config.tools);
      assert.deepEqual(call.arguments[0].config.tools, [{ googleSearch: {} }]);
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/genai-tools/lib/tools/search-grounding.test.js`
Expected: 4 tests FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```js
'use strict';

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Answer a query using Google Search–grounded Gemini.
 * @param {import('../genai-client').GenAIClient} client
 * @param {object} opts
 * @param {string} opts.query — The question to answer
 * @param {string} [opts.model] — Model name (default: gemini-2.5-flash)
 * @returns {Promise<{answer: string, citations: Array<{title: string, uri: string, snippet: string}>, model: string}>}
 */
async function searchGrounding(client, { query, model = DEFAULT_MODEL }) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('search_grounding: "query" must be a non-empty string');
  }

  const { text, raw } = await client.generateContent({
    model,
    prompt: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const citations = [];
  const groundingMeta = raw?.candidates?.[0]?.groundingMetadata;
  if (groundingMeta?.groundingChunks) {
    for (const chunk of groundingMeta.groundingChunks) {
      citations.push({
        title: chunk.web?.title || '',
        uri: chunk.web?.uri || '',
        snippet: chunk.web?.snippet || '',
      });
    }
  }

  return { answer: text, citations, model };
}

module.exports = { searchGrounding };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/genai-tools/lib/tools/search-grounding.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/genai-tools/lib/tools/search-grounding.js packages/genai-tools/lib/tools/search-grounding.test.js
git commit -m "feat(genai-tools): add search_grounding tool"
```

---

### Task 4: extract_structured Tool

**Files:**
- Create: `packages/genai-tools/lib/tools/extract-structured.js`
- Create: `packages/genai-tools/lib/tools/extract-structured.test.js`

**Interfaces:**
- Consumes: `GenAIClient` (from Task 2)
- Produces: `async function extractStructured({ content, schema, instruction, model })` returning `{ data: object, model: string }`

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const assert = require('node:assert/strict');
const { describe, it, mock } = require('node:test');

describe('extractStructured', () => {
  it('returns parsed JSON data from response', async () => {
    const { extractStructured } = require('./extract-structured');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: JSON.stringify({ name: 'Alice', age: 30 }),
        raw: {},
      })),
    };

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    };

    const result = await extractStructured(mockClient, {
      content: 'Alice is 30 years old.',
      schema,
      model: 'gemini-2.5-flash',
    });

    assert.deepEqual(result.data, { name: 'Alice', age: 30 });
    assert.equal(result.model, 'gemini-2.5-flash');
  });

  it('sends responseSchema and responseMimeType in config', async () => {
    const { extractStructured } = require('./extract-structured');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({
        text: JSON.stringify({ result: true }),
        raw: {},
      })),
    };

    const schema = { type: 'object', properties: { result: { type: 'boolean' } } };

    const result = await extractStructured(mockClient, {
      content: 'It is true.',
      schema,
    });

    const call = mockClient.generateContent.mock.calls[0];
    assert.equal(call.arguments[0].config.responseMimeType, 'application/json');
    assert.deepEqual(call.arguments[0].config.responseSchema, schema);
  });

  it('throws if content is empty', async () => {
    const { extractStructured } = require('./extract-structured');
    const mockClient = { generateContent: mock.fn() };
    await assert.rejects(
      () => extractStructured(mockClient, { content: '', schema: {} }),
      /content/
    );
  });

  it('throws if schema is missing', async () => {
    const { extractStructured } = require('./extract-structured');
    const mockClient = { generateContent: mock.fn() };
    await assert.rejects(
      () => extractStructured(mockClient, { content: 'test' }),
      /schema/
    );
  });

  it('includes instruction in prompt when provided', async () => {
    const { extractStructured } = require('./extract-structured');

    const mockClient = {
      generateContent: mock.fn(() => Promise.resolve({ text: '{}', raw: {} })),
    };

    await extractStructured(mockClient, {
      content: 'Some content.',
      schema: { type: 'object', properties: {} },
      instruction: 'Extract key facts only',
    });

    const call = mockClient.generateContent.mock.calls[0];
    const prompt = call.arguments[0].contents[0].parts[0].text;
    assert.ok(prompt.includes('Extract key facts only'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/genai-tools/lib/tools/extract-structured.test.js`
Expected: 5 tests FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```js
'use strict';

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Extract structured JSON from content using Gemini's responseSchema.
 * @param {import('../genai-client').GenAIClient} client
 * @param {object} opts
 * @param {string} opts.content — The text content to extract from
 * @param {object} opts.schema — JSON Schema describing the desired output shape
 * @param {string} [opts.instruction] — Optional extraction instruction (e.g. "Extract key facts only")
 * @param {string} [opts.model] — Model name (default: gemini-2.5-flash)
 * @returns {Promise<{data: object, model: string}>}
 */
async function extractStructured(client, { content, schema, instruction, model = DEFAULT_MODEL }) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('extract_structured: "content" must be a non-empty string');
  }
  if (!schema || typeof schema !== 'object') {
    throw new Error('extract_structured: "schema" must be a valid JSON Schema object');
  }

  const prompt = instruction
    ? `${instruction}\n\n${content}`
    : `Extract structured data from this content according to the specified schema.\n\n${content}`;

  const { text } = await client.generateContent({
    model,
    prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    // If JSON parsing fails, return raw text wrapped in an object
    data = { raw: text };
  }

  return { data, model };
}

module.exports = { extractStructured };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test packages/genai-tools/lib/tools/extract-structured.test.js`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/genai-tools/lib/tools/extract-structured.js packages/genai-tools/lib/tools/extract-structured.test.js
git commit -m "feat(genai-tools): add extract_structured tool"
```

---

### Task 5: MCP Tools + Index + Skills

**Files:**
- Create: `packages/genai-tools/mcp-tools.js`
- Modify: `packages/genai-tools/lib/index.js` — wire exports
- Create: `packages/genai-tools/skills/genai-tools.md`

**Interfaces:**
- Consumes: `searchGrounding`, `extractStructured` from Tasks 3 and 4; `GenAIClient` from Task 2.
- Produces: MCP plugin tools `search_grounding` and `extract_structured` auto-discovered by `@andy-toolforge/mcp`.

- [ ] **Step 1: Write index.js exports**

```js
'use strict';

const { GenAIClient } = require('./genai-client');
const { searchGrounding } = require('./tools/search-grounding');
const { extractStructured } = require('./tools/extract-structured');

module.exports = {
  GenAIClient,
  searchGrounding,
  extractStructured,
};
```

- [ ] **Step 2: Write mcp-tools.js (MCP plugin connector)**

```js
'use strict';

/**
 * @andy-toolforge/genai-tools MCP plugin tools.
 * Auto-discovered by @andy-toolforge/mcp via _loadPluginTools().
 *
 * Tools:
 *   search_grounding      — Answer a query with Google Search–grounded context
 *   extract_structured    — Extract structured JSON from text using a schema
 */

const { GenAIClient } = require('./lib');
const { searchGrounding } = require('./lib/tools/search-grounding');
const { extractStructured } = require('./lib/tools/extract-structured');

// ---------------------------------------------------------------------------
// search_grounding
// ---------------------------------------------------------------------------
const searchGroundingDef = {
  name: 'search_grounding',
  description: 'Answer a question with web-grounded results from Google Search. Uses Gemini + Google Search to provide answers with citations. Use when you need up-to-date information from the web.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The question or search query to answer with web grounding' },
      model: { type: 'string', description: 'Model override (default: gemini-2.5-flash). Options: gemini-2.5-flash, gemini-3.1-flash-lite', default: 'gemini-2.5-flash' },
    },
    required: ['query'],
  },
};

async function searchGroundingHandler(llm, args) {
  const { query, model } = args;
  const apiKey = GenAIClient.resolveApiKey();
  if (!apiKey) {
    throw new Error('search_grounding: GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set');
  }

  const client = new GenAIClient(apiKey);
  const result = await searchGrounding(client, { query, model });
  return {
    content: [{ type: 'text', text: result.answer }],
    meta: {
      citations: result.citations,
      model: result.model,
    },
  };
}

// ---------------------------------------------------------------------------
// extract_structured
// ---------------------------------------------------------------------------
const extractStructuredDef = {
  name: 'extract_structured',
  description: 'Extract structured JSON data from text content using a JSON Schema. Returns parsed data matching the schema. Use when you need to extract entities, tables, or structured information from unstructured text.',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'The text content to extract data from' },
      schema: {
        type: 'object',
        description: 'JSON Schema describing the desired output structure. Must be a valid JSON Schema object (e.g. { type: "object", properties: { name: { type: "string" } } })',
      },
      instruction: { type: 'string', description: 'Optional extraction instruction to guide the model (e.g. "Extract key facts only, ignore opinions")' },
      model: { type: 'string', description: 'Model override (default: gemini-2.5-flash). Options: gemini-2.5-flash, gemini-3.1-flash-lite, gemma-4-9b-it', default: 'gemini-2.5-flash' },
    },
    required: ['content', 'schema'],
  },
};

async function extractStructuredHandler(llm, args) {
  const { content, schema, instruction, model } = args;
  const apiKey = GenAIClient.resolveApiKey();
  if (!apiKey) {
    throw new Error('extract_structured: GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set');
  }

  const client = new GenAIClient(apiKey);
  const result = await extractStructured(client, { content, schema, instruction, model });
  return {
    content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    meta: {
      model: result.model,
    },
  };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------
/**
 * @param {object} config — MCP server config (contains apiKey, llm, etc.)
 * @returns {Array<{definition: object, handler: Function}>}
 */
module.exports = function factory(config) {
  // Store apiKey for handler usage (also read from env vars)
  if (config?.apiKey) {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || config.apiKey;
    process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || config.apiKey;
  }

  return [
    { definition: searchGroundingDef, handler: searchGroundingHandler },
    { definition: extractStructuredDef, handler: extractStructuredHandler },
  ];
};
```

- [ ] **Step 3: Create skill file**

```markdown
# GenAI Tools — Search Grounding & Structured Extraction

Tools for using Google GenAI SDK features via `@andy-toolforge/genai-tools`.

## search_grounding

Answer questions using Google Search–grounded Gemini responses. Provides citations from the web.

**MCP tool:** `search_grounding`
**Input:** `query` (string, required), `model` (string, optional — default: gemini-2.5-flash)
**Output:** Answer text with citations array `[{title, uri, snippet}]`

**Usage notes:**
- Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable.
- The tool activates Google Search grounding via SDK's `tools: [{ googleSearch: {} }]`.
- Responses include `citations` metadata with source URLs and titles.
- Use `gemini-3.1-flash-lite` for cheaper/lighter queries.
- More expensive than normal LLM calls due to web search costs.

## extract_structured

Extract structured JSON data from unstructured text using Gemini's `responseSchema` feature.

**MCP tool:** `extract_structured`
**Input:** `content` (string, required), `schema` (object, required — JSON Schema), `instruction` (string, optional), `model` (string, optional — default: gemini-2.5-flash)
**Output:** JSON data matching the provided schema

**Usage notes:**
- Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable.
- `schema` must be a valid JSON Schema object compliant with the OpenAPI 3.0 subset supported by Gemini.
- Example schema: `{ type: "object", properties: { name: { type: "string" }, age: { type: "integer" } } }`
- Optional `instruction` parameter helps guide extraction focus (e.g. "Extract only numerical data").
- For lightweight extractions, `gemma-4-9b-it` is more cost-effective than `gemini-2.5-flash`.
- Returns JSON even on partial success; malformed responses fall back to `{ raw: "<text>" }`.
```

Save to `packages/genai-tools/skills/genai-tools.md`.

- [ ] **Step 4: Verify mcp-tools.js loads correctly**

Run: `node -e "const f = require('./packages/genai-tools/mcp-tools.js'); const tools = f({}); console.log('Tools:', tools.length); console.log('Names:', tools.map(t => t.definition.name));"`
Expected: `Tools: 2`, `Names: search_grounding,extract_structured`

- [ ] **Step 5: Run all unit tests**

Run: `npm test -w @andy-toolforge/genai-tools`
Expected: 13 tests PASS (4 genai-client + 4 search-grounding + 5 extract-structured)

- [ ] **Step 6: Commit**

```bash
git add packages/genai-tools/lib/index.js packages/genai-tools/mcp-tools.js packages/genai-tools/skills/genai-tools.md
git commit -m "feat(genai-tools): add MCP tools, index exports, and skill file"
```

---

### Task 6: Integration Smoke Test

**Files:**
- None (manual verification only)

- [ ] **Step 1: Verify MCP plugin discovery**

The MCP server discovers tools by loading `node_modules/@andy-toolforge/*/mcp-tools.js`. After `npm install`, verify the plugin can be required:

Run: `ls -la node_modules/@andy-toolforge/genai-tools && node -e "console.log(require.resolve('@andy-toolforge/genai-tools/mcp-tools.js'))"`
Expected: symlink exists, path resolves to `packages/genai-tools/mcp-tools.js`

- [ ] **Step 2: Verify GEMINI_API_KEY is set**

Run: `echo "Key set: ${#GEMINI_API_KEY} chars"` (if key exists)
Expected: prints character count

If key is not set, inform the user: `echo "GEMINI_API_KEY not set — tools need it at runtime"`

- [ ] **Step 3: Run all package tests one final time**

Run: `npm test -w @andy-toolforge/genai-tools`
Expected: 13 tests PASS, exit code 0

- [ ] **Step 4: Report integration status**

Summarize:
- `@andy-toolforge/genai-tools` package created at `packages/genai-tools/`
- MCP tools `search_grounding` and `extract_structured` auto-register via plugin discovery
- No changes to `packages/mcp` were needed
- Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable
- User needs to restart OpenCode (or their MCP server host) so `_loadPluginTools` picks up the new package

- [ ] **Step 5: Final commit if anything changed**

Run: `git status --short`
If tests or integration steps modified files, stage and commit.

