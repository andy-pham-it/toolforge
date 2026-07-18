'use strict';

const fs = require('fs');
const path = require('path');

/**
 * scaffoldSeries — Create a series directory with outline and lesson scaffolds.
 *
 * Generates:
 *   00-muc-luc.md        — Table of contents with metadata
 *   <NN>-<slug>.md       — Lesson scaffolds (1 per lesson)
 *   images/              — Empty images directory
 *
 * @param {object} options
 * @param {string} options.outputDir     — Directory to create the series in
 * @param {string} options.topic         — Series topic
 * @param {number} [options.lessonCount] — Number of lessons (default 5)
 * @param {string} [options.language]    — Language (vi|en, default vi)
 * @param {string[]} [options.lessonTitles] — Optional explicit lesson titles
 * @param {object} [options.llm]         — LLMClient instance (creates default if omitted)
 * @returns {Promise<{ seriesDir: string, tocFile: string, lessonFiles: string[] }>}
 */
async function scaffoldSeries(options) {
    const { topic, lessonCount = 5, outputDir, language = 'vi', lessonTitles, llm } = options;

    if (!topic) throw new Error('topic is required');
    if (!outputDir) throw new Error('outputDir is required');

    // Resolve series directory name from topic
    const slug = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

    const seriesDir = path.resolve(outputDir, slug);
    const imagesDir = path.join(seriesDir, 'images');

    // Check for existing series
    if (fs.existsSync(seriesDir)) {
        throw new Error(`Series directory already exists: ${seriesDir}`);
    }

    // Generate lesson titles if not provided
    let titles = lessonTitles;
    if (!titles) {
        titles = await _generateLessonTitles({ topic, lessonCount, language, llm });
    }

    // Create directories
    fs.mkdirSync(seriesDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });

    // Write 00-muc-luc.md (table of contents)
    const tocContent = _buildToc({ topic, slug, language, titles });
    const tocFile = path.join(seriesDir, '00-muc-luc.md');
    fs.writeFileSync(tocFile, tocContent, 'utf-8');

    // Write lesson scaffolds
    const lessonFiles = [];
    for (let i = 0; i < titles.length; i++) {
        const idx = String(i + 1).padStart(2, '0');
        const lessonSlug = titles[i]
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50);
        const lessonFile = path.join(seriesDir, `${idx}-${lessonSlug}.md`);
        const lessonContent = _buildLessonScaffold({
            index: i + 1,
            title: titles[i],
            seriesTopic: topic,
            slug: lessonSlug,
            language,
        });
        fs.writeFileSync(lessonFile, lessonContent, 'utf-8');
        lessonFiles.push(lessonFile);
    }

    return { seriesDir, tocFile, lessonFiles };
}

/**
 * Generate lesson titles via LLM.
 */
async function _generateLessonTitles({ topic, lessonCount, language, llm }) {
    const { LLMClient } = require('@andy-toolforge/core');
    const client = llm || new LLMClient();

    const prompt = [
        `Generate ${lessonCount} lesson titles for a series on "${topic}".`,
        `Language: ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
        `Format: return exactly one title per line, no numbering, no extra text.`,
        `Each title should be 3-8 words, descriptive, and progress logically.`,
    ].join('\n');

    const result = await client.chat(prompt);
    const titles = result
        .split('\n')
        .map(l => l.replace(/^[\d\s.\)\-]+\s*/, '').trim())
        .filter(Boolean)
        .slice(0, lessonCount);

    // Pad with generic titles if LLM returned fewer
    while (titles.length < lessonCount) {
        const idx = titles.length + 1;
        titles.push(`${language === 'vi' ? 'Bài học' : 'Lesson'} ${idx}`);
    }

    return titles;
}

/**
 * Build table of contents Markdown.
 */
function _buildToc({ topic, slug, language, titles }) {
    const isVi = language === 'vi';
    const now = new Date().toISOString().slice(0, 10);

    const lines = [
        `# ${topic}`,
        ``,
        `> ${isVi ? 'Series kiến thức về' : 'Knowledge series on'} **${topic}**`,
        ``,
        `**${isVi ? 'Số bài học' : 'Lessons'}:** ${titles.length}`,
        `**${isVi ? 'Ngày tạo' : 'Created'}:** ${now}`,
        `**Slug:** \`${slug}\``,
        ``,
        `---`,
        ``,
        `## ${isVi ? 'Mục lục' : 'Table of Contents'}`,
        ``,
    ];

    titles.forEach((title, i) => {
        const idx = String(i + 1).padStart(2, '0');
        const lessonSlug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50);
        lines.push(`${i + 1}. [${title}](${idx}-${lessonSlug}.md)`);
    });

    lines.push('');

    return lines.join('\n');
}

/**
 * Build a single lesson scaffold file.
 */
function _buildLessonScaffold({ index, title, seriesTopic, slug, language }) {
    const isVi = language === 'vi';

    return [
        `# ${title}`,
        ``,
        `---`,
        ``,
        `## ${isVi ? 'Mục tiêu bài học' : 'Learning Objectives'}`,
        ``,
        `- ${isVi ? '_Mục tiêu 1_' : '_Objective 1_'}`,
        `- ${isVi ? '_Mục tiêu 2_' : '_Objective 2_'}`,
        `- ${isVi ? '_Mục tiêu 3_' : '_Objective 3_'}`,
        ``,
        `## ${isVi ? 'Kiến thức nền tảng' : 'Prerequisites'}`,
        ``,
        `- ${isVi ? '_Kiến thức cần có_' : '_Required knowledge_'}`,
        ``,
        `## ${isVi ? 'Nội dung chính' : 'Main Content'}`,
        ``,
        `### ${isVi ? 'Phần 1' : 'Section 1'}`,
        ``,
        `${isVi ? '_Nội dung phần 1_' : '_Content for section 1_'}`,
        ``,
        `### ${isVi ? 'Phần 2' : 'Section 2'}`,
        ``,
        `${isVi ? '_Nội dung phần 2_' : '_Content for section 2_'}`,
        ``,
        `### ${isVi ? 'Phần 3' : 'Section 3'}`,
        ``,
        `${isVi ? '_Nội dung phần 3_' : '_Content for section 3_'}`,
        ``,
        `## ${isVi ? 'Bài tập' : 'Exercises'}`,
        ``,
        `1. ${isVi ? '_Bài tập 1_' : '_Exercise 1_'}`,
        `2. ${isVi ? '_Bài tập 2_' : '_Exercise 2_'}`,
        `3. ${isVi ? '_Bài tập 3_' : '_Exercise 3_'}`,
        ``,
        `## ${isVi ? 'Tóm tắt' : 'Summary'}`,
        ``,
        `- ${isVi ? '_Điểm chính cần nhớ_' : '_Key takeaways_'}`,
        ``,
        `## ${isVi ? 'Tài liệu tham khảo' : 'References'}`,
        ``,
        `- ${isVi ? '_Tài liệu đọc thêm_' : '_Further reading_'}`,
        ``,
    ].join('\n');
}

module.exports = { scaffoldSeries, _generateLessonTitles, _buildToc, _buildLessonScaffold };
