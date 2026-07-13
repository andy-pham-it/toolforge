# @andy-toolforge/genai-tools — Search Grounding & Structured Extraction

## Available Tools

Two MCP tools are provided:

### 1. `search_grounding` — Google Search–grounded answers

Uses Gemini's built-in Google Search grounding to answer questions with citations from the web. The model searches the internet in real-time and returns an answer with source references.

**Use when:**
- You need a factual answer to a question that requires up-to-date web data
- The answer should include citations/sources
- The question is best answered by searching (not by the model's training data alone)

**Model selection:**
- `gemini-3.1-flash-lite` (default) — faster, cheaper, free-tier quota
- `gemini-2.5-flash` — stronger reasoning, good for complex questions

**Output format:**
```json
{
  "answer": "...",
  "citations": [{ "title": "...", "uri": "...", "snippet": "..." }],
  "model": "gemini-3.1-flash-lite"
}
```

**Error recovery:**
- Missing query → error: "query must be a non-empty string"
- API failure → error from the SDK (check GEMINI_API_KEY)
- No citations returned → `citations` array is empty; answer still contains the model's response

---

### 2. `extract_structured` — JSON extraction via responseSchema

Uses Gemini's `responseSchema` feature to extract structured JSON data from unstructured text. Provide a JSON Schema and the model returns data conforming to that schema.

**Use when:**
- You need to parse unstructured text into structured records
- You have a known output schema (e.g., invoice fields, article metadata, entity extraction)
- You want type-safe structured output from free-form content

**Model selection:**
- `gemini-3.1-flash-lite` (default) — fast extraction, free-tier quota
- `gemini-2.5-flash` — better schema adherence for complex schemas
- `gemma-4-9b-it` — lightweight option for basic extraction

**Output format:**
```json
{
  "data": { /* object conforming to provided schema */ },
  "model": "gemini-3.1-flash-lite"
}
```

**Error recovery:**
- Empty content → error: "content must be a non-empty string"
- Missing schema → error: "schema must be a valid JSON Schema object"
- JSON parse failure → `data` contains `{ "raw": "<response text>" }`

---

## General Notes

- Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable
- Both tools are synchronous (single request-response)
- No streaming support in Phase 1
- Tools are auto-discovered by `@andy-toolforge/mcp` — no manual registration needed
