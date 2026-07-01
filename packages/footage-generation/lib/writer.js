const fs = require('fs');
const path = require('path');

class PromptWriter {
    static writePromptsFile(folderPath, segments, lang) {
        let content = '# DANH SÁCH PROMPT TẠO ẢNH CHO VIDEO PODCAST\n\n';
        
        segments.forEach((seg, index) => {
            const stt = index + 1;
            content += `### 📌 Phân cảnh ${stt}: ${seg.title}\n`;
            content += `* **Nội dung tóm tắt:** ${seg.summary}\n`;
            content += `* **Loại visual:** ${seg.visualType}\n`;
            content += `* **Thời gian xuất hiện trong video:** ${seg.startTime} — ${seg.endTime}\n\n`;
            
            const prompts = ['a', 'b', 'c', 'd', 'e'];
            const labels = {
                'a': 'chính',
                'b': 'phụ 1',
                'c': 'phụ 2',
                'd': 'phụ 3',
                'e': 'phụ 4'
            };

            prompts.forEach(p => {
                const promptText = seg.prompts[p] || '';
                const fileName = `${stt}_${seg.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${p}.png`;
                content += `**--- Ảnh ${p.toUpperCase()} (${labels[p]}) ---**\n`;
                content += '* **Tên file:** `' + fileName + '`\n';
                content += `* **🚀 Prompt:**\n\`\`\`text\n${promptText}\n\`\`\`\n`;
                content += `* **🔄 Phương án chỉnh sửa nhanh:**\n`;
                content += `  * *Để đổi góc nhìn/gần hơn:* ${seg.editSuggestions.zoom}\n`;
                content += `  * *Để đổi không gian/bối cảnh:* ${seg.editSuggestions.context}\n`;
                content += `  * *Để tăng giảm sắc thái:* ${seg.editSuggestions.mood}\n\n`;
            });
            content += '---\n\n';
        });

        fs.writeFileSync(path.join(folderPath, 'prompts.md'), content);
    }

    static writeMappingFile(folderPath, title, totalDuration, segments) {
        let content = `# MAPPING ẢNH → PHÂN ĐOẠN VIDEO PODCAST\n\n`;
        content += `**Tập:** ${title}\n`;
        content += `**Tổng thời lượng:** ${totalDuration}\n`;
        content += `**Tổng số ảnh:** ${segments.length * 5}\n\n---\n\n`;

        content += `## ⏱️ TIMELINE TỔNG QUAN\n\n\`\`\`\n`;
        // Simple ASCII timeline
        let timeline = '';
        segments.forEach((seg, i) => {
            timeline += `${seg.startTime} ┤ ${seg.endTime} ┤████ ${i+1}a-e ████\n`;
        });
        content += timeline + '\n\`\`\`\n\n---\n\n';

        content += `## 📋 MAPPING CHI TIẾT\n\n`;
        segments.forEach((seg, index) => {
            const stt = index + 1;
            content += `### [${seg.startTime} → ${seg.endTime}] — ${seg.title}\n`;
            content += `| Ảnh | File | Vai trò | Nội dung kịch bản tương ứng | Ghi chú khi edit |\n`;
            content += `|-----|------|---------|----------------------------|------------------|\n`;
            
            const prompts = ['a', 'b', 'c', 'd', 'e'];
            const roles = { 'a': 'Chính', 'b': 'Phụ 1', 'c': 'Phụ 2', 'd': 'Phụ 3', 'e': 'Phụ 4' };
            
            prompts.forEach(p => {
                const filename = `${stt}_${seg.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${p}.png`;
                content += '| ' + stt + p + ' | `' + filename + '` | ' + roles[p] + ' | ' + seg.summary + ' | Xen kẽ, tạo nhịp |\n';
            });
            
            content += `\n**Gợi ý edit:**\n- ${seg.startTime} → ${seg.endTime}: A (chính) + D (điểm nhấn), xen kẽ B, C, E\n\n`;
        });

        fs.writeFileSync(path.join(folderPath, 'mapping-phan-canh.md'), content);
    }

    static writeCoverPrompts(folderPath, coverData) {
        let content = '# DANH SÁCH PROMPT - COVERS\n\n';
        
        // Series Cover
        content += `### 📌 Phân cảnh 1: Series Cover\n`;
        content += `* **Tên file ảnh:** \`cover_series.png\`\n`;
        content += `* **🚀 Prompt tạo ảnh:**\n\`\`\`text\n${coverData.seriesCover.prompt}\n\`\`\`\n\n`;
        
        // Chapter Covers
        coverData.chapterCovers.forEach((chap, i) => {
            content += `### 📌 Phân cảnh ${i + 2}: Chapter ${chap.chapter} Cover\n`;
            content += `* **Tên file ảnh:** \`chapter${chap.chapter}_cover.png\`\n`;
            content += `* **🚀 Prompt tạo ảnh:**\n\`\`\`text\n${chap.prompt}\n\`\`\`\n\n`;
        });

        fs.writeFileSync(path.join(folderPath, 'prompts-covers.md'), content);
    }
}

module.exports = PromptWriter;
