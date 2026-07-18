'use strict';

/**
 * generateLesson — Generate a complete lesson plan from topic + audience.
 *
 * Uses @andy-toolforge/core LLMClient to produce structured Markdown
 * with learning objectives, sections, exercises, and summaries.
 *
 * @param {object} options
 * @param {string} options.topic          — Lesson topic (e.g. "JavaScript Promises")
 * @param {string} options.audience       — Target audience (e.g. "beginner developers")
 * @param {string[]} [options.objectives] — Optional specific learning objectives
 * @param {string} [options.language]     — Output language (vi|en, default vi)
 * @param {object} [options.llm]          — LLMClient instance (creates default if omitted)
 * @returns {Promise<{ title: string, markdown: string, sections: number }>}
 */
async function generateLesson(options) {
    const { topic, audience, objectives, language = 'vi', llm } = options;

    if (!topic) throw new Error('topic is required');
    if (!audience) throw new Error('audience is required');

    const { LLMClient } = require('@andy-toolforge/core');
    const client = llm || new LLMClient();

    const objectivesSection = objectives?.length
        ? `\n## Mục tiêu cụ thể\n- ${objectives.join('\n- ')}`
        : '';

    const prompt = [
        `Bạn là chuyên gia thiết kế bài giảng. Hãy tạo một giáo án hoàn chỉnh bằng tiếng ${language === 'vi' ? 'Việt' : 'Anh'} cho chủ đề sau.`,
        ``,
        `Chủ đề: ${topic}`,
        `Đối tượng: ${audience}`,
        objectivesSection,
        ``,
        `Yêu cầu cấu trúc:`,
        `1. Tiêu đề bài học`,
        `2. Mục tiêu học tập (3-5 mục tiêu SMART)`,
        `3. Kiến thức nền tảng cần có`,
        `4. Các khái niệm chính (giải thích ngắn gọn, có ví dụ)`,
        `5. Nội dung bài học chia thành 3-5 phần, mỗi phần có:`,
        `   - Giải thích lý thuyết`,
        `   - Ví dụ minh họa`,
        `   - Câu hỏi tương tác hoặc bài tập ngắn`,
        `6. Bài tập tổng hợp (2-3 bài)`,
        `7. Tóm tắt bài học`,
        `8. Tài liệu tham khảo / đọc thêm`,
        ``,
        `Định dạng: Markdown, rõ ràng, có cấu trúc. Dùng tiếng ${language === 'vi' ? 'Việt' : 'Anh'}.`,
        `Bắt đầu bằng tiêu đề cấp 1 (#).`,
    ].filter(Boolean).join('\n');

    const result = await client.chat(prompt);

    // Count sections (## headings)
    const sections = (result.match(/^## /gm) || []).length;

    // Extract title from first # heading
    const titleMatch = result.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : topic;

    return { title, markdown: result, sections };
}

module.exports = { generateLesson };
