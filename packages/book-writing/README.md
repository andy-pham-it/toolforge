# @andy-toolforge/book-writing

[![npm](https://img.shields.io/npm/v/@andy-toolforge/book-writing)](https://npmjs.com/package/@andy-toolforge/book-writing)
[![License](https://img.shields.io/npm/l/@andy-toolforge/book-writing)](https://github.com/andy-pham-it/toolforge)

**AI-powered book writing engine.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Sinh book outline chi tiết từ topic
- Viết chapter với continuity check (tự động nối tiếp chapter trước)
- Review manuscript cho consistency, contradictions, repetition
- Export sang markdown / plain text / HTML

## Installation

```bash
npm install @andy-toolforge/book-writing
```

Yêu cầu `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const { BookWriter } = require('@andy-toolforge/book-writing');
```

---

### BookWriter

Một class duy nhất cho toàn bộ quy trình viết sách.

**Constructor:** `new BookWriter({ llmClient, logger? })`

Cần LLMClient từ core.

---

#### generateOutline(topic, chapterCount)

Sinh book outline từ chủ đề.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `topic` | string | required | Chủ đề sách |
| `chapterCount` | number | `5` | Số chapter (1-50) |

**Return:**
```javascript
{
  title: 'Lập trình với Node.js',
  topic: 'Node.js programming',
  chapterCount: 8,
  chapters: [
    { number: 1, title: 'Giới thiệu', description: '...', keyPoints: ['...'] },
    // ...
  ],
  estimatedLength: '150-200 pages'
}
```

```javascript
const { BookWriter } = require('@andy-toolforge/book-writing');
const { LLMClient } = require('@andy-toolforge/core');

const llm = new LLMClient({ provider: 'gemini', apiKey });
const writer = new BookWriter({ llmClient: llm });

const outline = await writer.generateOutline('Lập trình với Node.js', 8);
console.log(`Book: ${outline.title}, ${outline.chapters.length} chapters`);
```

---

#### writeChapter(outline, chapterIndex, previousContent)

Viết một chapter cụ thể.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `outline` | object | required | Outline từ `generateOutline()` |
| `chapterIndex` | number | required | 1-based index |
| `previousContent` | string | `''` | Previous chapter content (500 chars cuối) cho continuity |

**Return:** `string` — Chapter content in markdown (800-2000 words)

```javascript
let prev = '';
for (let i = 1; i <= outline.chapters.length; i++) {
    const chapter = await writer.writeChapter(outline, i, prev);
    prev = chapter.slice(-500); // Pass cuối chapter trước cho continuity
    console.log(`✅ Chapter ${i} done (${chapter.length} chars)`);
}
```

---

#### reviewConsistency(manuscript)

Review manuscript cho consistency, contradictions, repetition, tone, logic gaps.

| Param | Type | Mô tả |
|-------|------|-------|
| `manuscript` | object | `{ title, chapters: [{ title, content }] }` |

**Return:**
```javascript
{
  score: 8.5,
  summary: 'Overall assessment',
  issues: [
    { type: 'contradiction', chapter: 3, severity: 'high',
      description: '...', suggestion: '...' }
  ],
  strengths: ['Clear writing style', 'Good pacing']
}
```

```javascript
const review = await writer.reviewConsistency({
    title: 'Node.js Book',
    chapters: [{ title: 'Ch.1', content: '...' }, /* ... */]
});
console.log(`Score: ${review.score}/10, Issues: ${review.issues.length}`);
```

---

#### exportFormat(manuscript, format)

Export manuscript sang định dạng mong muốn.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `manuscript` | object | required | `{ title, chapters }` |
| `format` | string | `'markdown'` | `'markdown'` \| `'plain'` \| `'html'` |

**Return:** `string` — Formatted content

```javascript
const html = await writer.exportFormat(manuscript, 'html');
// → Full HTML document with <h1>, <h2>, <p> tags
```

---

## Tutorial: Viết sách từ A→Z

```javascript
async function writeBook(topic, chapterCount) {
    const llm = new LLMClient({ provider: 'gemini', apiKey });
    const writer = new BookWriter({ llmClient: llm });

    // Bước 1: Outline
    console.log('📝 Generating outline...');
    const outline = await writer.generateOutline(topic, chapterCount);

    // Bước 2: Viết từng chapter
    const chapters = [];
    let prev = '';
    for (let i = 1; i <= outline.chapters.length; i++) {
        console.log(`✍️  Writing chapter ${i}...`);
        const content = await writer.writeChapter(outline, i, prev);
        chapters.push({ title: outline.chapters[i-1].title, content });
        prev = content.slice(-500);
    }
    const manuscript = { title: outline.title, chapters };

    // Bước 3: Review
    console.log('🔍 Reviewing...');
    const review = await writer.reviewConsistency(manuscript);

    // Bước 4: Export
    console.log('📄 Exporting...');
    const finalDoc = await writer.exportFormat(manuscript, 'markdown');

    return { manuscript, review, finalDoc };
}
```

## MCP Tools

Khi dùng với [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp):

| Tool | Description |
|------|-------------|
| `toolforge_book_outline` | Generate book outline from topic |
| `toolforge_book_write_chapter` | Write a chapter with continuity |
| `toolforge_book_review` | Review manuscript (consistency, contradictions, repetition) |
| `toolforge_book_export` | Export to markdown/plain/html |

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core) — LLMClient
- [@andy-toolforge/mcp](https://npmjs.com/package/@andy-toolforge/mcp) — MCP server
