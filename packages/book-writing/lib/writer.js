/**
 * BookWriter — AI-powered book writing engine.
 *
 * Generates outlines, writes chapters, reviews consistency,
 * and exports to multiple formats. Requires an LLMClient.
 */
const { Logger } = require('@andy-toolforge/core');

class BookWriter {
    constructor(config = {}) {
        this.llm = config.llmClient;
        this.logger = config.logger || new Logger('BookWriter');
    }

    /**
     * Generate a book outline from a topic.
     * @param {string} topic - Book topic
     * @param {number} [chapterCount] - Number of chapters (default: 5)
     * @returns {Promise<object>} Outline with title, chapters, estimated length
     */
    async generateOutline(topic, chapterCount = 5) {
        if (typeof topic !== 'string' || topic.trim().length === 0) {
            throw new Error('Topic must be a non-empty string');
        }
        if (typeof chapterCount !== 'number' || chapterCount < 1 || chapterCount > 50) {
            throw new Error('Chapter count must be between 1 and 50');
        }
        this._ensureLLM();

        const prompt = `You are a professional book outline generator.

Topic: "${topic}"
Number of chapters: ${chapterCount}

Create a detailed book outline. Respond in JSON with this structure:
{
  "title": "Book title",
  "topic": "${topic}",
  "chapterCount": ${chapterCount},
  "chapters": [
    {
      "number": 1,
      "title": "Chapter title",
      "description": "Brief description (1-2 sentences)",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "estimatedLength": "e.g. 150-200 pages"
}`;

        const result = await this.llm.chat('', prompt, true);
        const outline = this._safeJsonParse(result, {
            title: topic,
            topic,
            chapterCount,
            chapters: [],
            estimatedLength: 'Unknown',
        });

        this.logger.info(`Generated outline: "${outline.title}" (${outline.chapters.length} chapters)`);
        return outline;
    }

    /**
     * Write a specific chapter based on the outline.
     * @param {object} outline - Book outline (from generateOutline)
     * @param {number} chapterIndex - 1-based chapter index
     * @param {string} [previousContent] - Previous chapter content for continuity
     * @returns {Promise<string>} Chapter content
     */
    async writeChapter(outline, chapterIndex, previousContent = '') {
        if (!outline || !outline.chapters || !Array.isArray(outline.chapters)) {
            throw new Error('Outline must have a chapters array');
        }
        if (typeof chapterIndex !== 'number' || chapterIndex < 1 || chapterIndex > outline.chapters.length) {
            throw new Error(`Chapter index must be between 1 and ${outline.chapters.length}`);
        }
        this._ensureLLM();

        const chapter = outline.chapters[chapterIndex - 1];
        const keyPoints = (chapter.keyPoints || []).join(', ');
        const totalChapters = outline.chapters.length;

        const continuitySection = previousContent
            ? `\n\nPrevious chapter ending (for continuity):\n"""\n${previousContent.slice(-500)}\n"""`
            : '';

        const prompt = `You are a professional book writer. Write chapter ${chapterIndex} of ${totalChapters}.

Book: "${outline.title}"
Topic: "${outline.topic}"

Chapter ${chapterIndex}: "${chapter.title}"
Description: ${chapter.description || ''}
Key points to cover: ${keyPoints}
${continuitySection}

Write 800-2000 words of engaging content. Use markdown with H2 (##) for subsections.
Focus on substance, examples, and actionable insights.`;

        const content = await this.llm.chat('', prompt, false);
        const trimmed = content.trim();

        this.logger.info(`Wrote chapter ${chapterIndex}: "${chapter.title}" (${trimmed.length} chars)`);
        return trimmed;
    }

    /**
     * Review a manuscript for consistency issues.
     * @param {object} manuscript - Manuscript with title and chapters array
     * @returns {Promise<object>} Review results with issues and score
     */
    async reviewConsistency(manuscript) {
        if (!manuscript || !manuscript.chapters || !Array.isArray(manuscript.chapters)) {
            throw new Error('Manuscript must have a chapters array');
        }
        if (manuscript.chapters.length === 0) {
            throw new Error('Manuscript must have at least one chapter');
        }
        this._ensureLLM();

        const summary = manuscript.chapters.map((ch, i) => {
            const preview = (ch.content || '').slice(0, 300);
            return `Chapter ${i + 1}: "${ch.title || 'Untitled'}"\nPreview: ${preview}...`;
        }).join('\n\n---\n\n');

        const prompt = `You are a professional book editor. Review this manuscript for consistency.

Title: "${manuscript.title || 'Untitled'}"

Content summary by chapter:
${summary}

Analyze for:
1. Contradictions between chapters
2. Repetition of ideas or phrases
3. Missing references (promised topics not covered)
4. Tone/style inconsistencies
5. Plot/logic gaps

Respond in JSON with this EXACT structure:
{
  "score": 8.5,
  "summary": "Overall assessment (1-2 sentences)",
  "issues": [
    {
      "type": "contradiction|repetition|missing_reference|tone_inconsistency|logic_gap",
      "chapter": 1,
      "severity": "high|medium|low",
      "description": "Issue description",
      "suggestion": "How to fix"
    }
  ],
  "strengths": ["Strength 1", "Strength 2"]
}`;

        const result = await this.llm.chat('', prompt, true);
        const review = this._safeJsonParse(result, {
            score: 0,
            summary: 'Could not parse review',
            issues: [],
            strengths: [],
        });

        this.logger.info(`Review complete: score ${review.score}, ${review.issues.length} issues found`);
        return review;
    }

    /**
     * Export a manuscript to the specified format.
     * @param {object} manuscript - Manuscript with title and chapters
     * @param {string} format - 'markdown' | 'plain' | 'html'
     * @returns {Promise<string>} Formatted output
     */
    async exportFormat(manuscript, format = 'markdown') {
        if (!manuscript || !manuscript.chapters || !Array.isArray(manuscript.chapters)) {
            throw new Error('Manuscript must have a chapters array');
        }
        if (!['markdown', 'plain', 'html'].includes(format)) {
            throw new Error('Format must be one of: markdown, plain, html');
        }

        const title = manuscript.title || 'Untitled';

        switch (format) {
            case 'markdown':
                return this._exportMarkdown(title, manuscript.chapters);
            case 'plain':
                return this._exportPlain(title, manuscript.chapters);
            case 'html':
                return this._exportHtml(title, manuscript.chapters);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    // ---- Private helpers ----

    _ensureLLM() {
        if (!this.llm || typeof this.llm.chat !== 'function') {
            throw new Error('LLMClient is required. Pass { llmClient } to constructor.');
        }
    }

    _safeJsonParse(raw, defaults) {
        try {
            return JSON.parse(raw);
        } catch {
            this.logger.warn('LLM returned invalid JSON, using defaults');
            return defaults;
        }
    }

    _exportMarkdown(title, chapters) {
        const parts = [`# ${title}\n`];
        for (const ch of chapters) {
            const chapterTitle = ch.title || `Chapter`;
            const content = ch.content || '';
            parts.push(`\n## ${chapterTitle}\n`);
            parts.push(content);
        }
        return parts.join('\n');
    }

    _exportPlain(title, chapters) {
        const parts = [`${title}\n${'='.repeat(title.length)}\n`];
        for (const ch of chapters) {
            const chapterTitle = ch.title || `Chapter`;
            const content = (ch.content || '').replace(/[#*_`\[\]]/g, '').replace(/\n{3,}/g, '\n\n');
            parts.push(`\n${chapterTitle}\n${'-'.repeat(chapterTitle.length)}\n`);
            parts.push(content);
        }
        return parts.join('\n');
    }

    _exportHtml(title, chapters) {
        let body = `<h1>${this._escapeHtml(title)}</h1>\n`;
        for (const ch of chapters) {
            const chapterTitle = ch.title || 'Chapter';
            body += `<h2>${this._escapeHtml(chapterTitle)}</h2>\n`;
            const content = (ch.content || '')
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\n\n/g, '</p>\n<p>')
                .replace(/^(.+)$/gm, (m) => m.startsWith('<') ? m : `${m}<br/>`);
            body += `<p>${content}</p>\n`;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${this._escapeHtml(title)}</title></head>
<body>
${body}
</body>
</html>`;
    }

    _escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

module.exports = BookWriter;
