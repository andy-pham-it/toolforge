# Gói `@andy-toolforge/content-research` - Kế hoạch triển khai

> **Dành cho các tác nhân AI:** KỸ NĂNG PHỤ BẮT BUỘC: Sử dụng superpowers:subagent-driven-development (được khuyến nghị) hoặc superpowers:executing-plans để triển khai kế hoạch này từng tác vụ một. Các bước sử dụng cú pháp hộp kiểm (`- [ ]`) để theo dõi.

**Mục tiêu:** Triển khai gói npm `@andy-toolforge/content-research` mới, cung cấp 4 công cụ con để tóm tắt nghiên cứu nội dung, tạo ý tưởng nội dung, quản lý bài viết và phân tích đối thủ cạnh tranh, tận dụng cả khả năng LLM và tự động hóa trình duyệt.

**Kiến trúc:** Gói này sẽ là một phần của monorepo Toolforge, tuân thủ kiến trúc CommonJS. Mỗi công cụ con sẽ có một module riêng trong `lib/`. Một `LLMClient` mở rộng sẽ xử lý việc tải các skill file dành riêng cho domain. Các skill file sẽ được symlink vào `.opencode/skills/` với tiền tố `content-research-`.

**Ngăn xếp công nghệ:** Node.js (CommonJS), `@andy-toolforge/core`, `@andy-toolforge/footage-generation` (nếu cần cho các tác vụ liên quan đến hình ảnh/video), Puppeteer (cho tự động hóa trình duyệt), LLM (Gemini/Groq).

## Ràng buộc toàn cầu

- Tất cả các gói phải sử dụng CommonJS (`require()`, `module.exports`).
- Các gói domain chỉ phụ thuộc vào `@andy-toolforge/core` (và các gói domain khác nếu được phê duyệt rõ ràng, nhưng ở đây sẽ không có).
- `LLMClient` của domain không chứa logic domain-specific trong `LLMClient` của core.
- Các skill file phải được đặt tên với tiền tố `content-research-`.

---

## Các tác vụ

### Tác vụ 1: Tạo gói `@andy-toolforge/content-research`

**Mục tiêu:** Khởi tạo cấu trúc thư mục cơ bản và `package.json` cho gói mới.

**Files:**
- Create: `packages/content-research/package.json`
- Create: `packages/content-research/lib/index.js`
- Create: `packages/content-research/skills/postinstall.js`
- Create: `packages/content-research/lib/llm.js`

**Interfaces:**
- Produces: Cấu trúc gói cơ bản, `package.json` với các phụ thuộc cần thiết, `lib/index.js` xuất các module, `postinstall.js` để tạo symlink skill, và `lib/llm.js` mở rộng `CoreLLMClient`.

- [ ] **Bước 1: Tạo thư mục gói**

```bash
mkdir -p packages/content-research/lib packages/content-research/skills
```

- [ ] **Bước 2: Tạo `packages/content-research/package.json`**

```json
{
  "name": "@andy-toolforge/content-research",
  "version": "0.1.0",
  "description": "Domain package for content research, summarization, idea generation, article management, and competitor analysis.",
  "main": "lib/index.js",
  "scripts": {
    "test": "node --test",
    "postinstall": "node skills/postinstall.js"
  },
  "keywords": [
    "toolforge",
    "content",
    "research",
    "seo",
    "automation",
    "llm",
    "browser"
  ],
  "author": "Andy Pham",
  "license": "MIT",
  "dependencies": {
    "@andy-toolforge/core": "workspace:*",
    "puppeteer": "^22.0.0"
  }
}
```

- [ ] **Bước 3: Tạo `packages/content-research/lib/index.js`**

```javascript
module.exports = {
  // Các module công cụ sẽ được xuất ở đây
};
```

- [ ] **Bước 4: Tạo `packages/content-research/skills/postinstall.js`**

```javascript
const fs = require('fs');
const path = require('path');

const skillFiles = [
    'content-research-summarizer.md',
    'content-research-ideator.md',
    'content-research-manager.md',
    'content-research-analyzer.md',
];

const targetDir = path.join(process.cwd(), '.opencode', 'skills');
const sourceDir = __dirname;

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

for (const file of skillFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath); // Xóa symlink cũ nếu tồn tại
    }
    fs.symlinkSync(path.relative(targetDir, sourcePath), targetPath, 'file');
    console.log(`Symlinked ${file} to ${targetPath}`);
}
```

- [ ] **Bước 5: Tạo `packages/content-research/lib/llm.js`**

```javascript
const fs = require('fs');
const path = require('path');
const { LLMClient: CoreLLMClient } = require('@andy-toolforge/core');

function resolveSkillFile(skillName) {
    const paths = [
        path.join(process.cwd(), '.opencode', 'skills', skillName),
        path.join(__dirname, '..', 'skills', skillName),
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(
        `Skill file not found: ${skillName}\n` +
        `  Tried:\n` +
        paths.map(p => `    - ${p}`).join('\n') + '\n' +
        `  Run: node node_modules/@andy-toolforge/content-research/skills/postinstall.js`
    );
}

class LLMClient extends CoreLLMClient {
    // Các phương thức domain-specific sẽ được thêm vào đây
}

module.exports = { LLMClient, resolveSkillFile };
```

- [ ] **Bước 6: Chạy `npm install` để cài đặt phụ thuộc và tạo symlink skill**

```bash
npm install
```

- [ ] **Bước 7: Commit**

```bash
git add packages/content-research/
git commit -m "feat(content-research): initialize new package structure"
```

### Tác vụ 2: Triển khai công cụ `ContentSummarizer`

**Mục tiêu:** Tạo module `summarizer.js` để tóm tắt nghiên cứu nội dung, bao gồm cả việc đọc skill file và gọi LLM.

**Files:**
- Create: `packages/content-research/lib/summarizer.js`
- Create: `packages/content-research/skills/content-research-summarizer.md`
- Modify: `packages/content-research/lib/index.js`
- Modify: `packages/content-research/lib/llm.js`

**Interfaces:**
- Consumes: `LLMClient` từ `lib/llm.js`
- Produces: `ContentSummarizer` class được xuất từ `lib/index.js`, phương thức `summarizeContent` trong `LLMClient`.

- [ ] **Bước 1: Tạo `packages/content-research/skills/content-research-summarizer.md`**

```markdown
Bạn là một trợ lý nghiên cứu nội dung chuyên nghiệp. Nhiệm vụ của bạn là tóm tắt các bài viết, báo cáo hoặc tài liệu nghiên cứu đã cho thành một bản tóm tắt ngắn gọn, dễ hiểu, tập trung vào các điểm chính, phát hiện và kết luận.

Đảm bảo bản tóm tắt:
- Ngắn gọn và súc tích.
- Nêu bật các thông tin quan trọng nhất.
- Trình bày rõ ràng các kết luận hoặc khuyến nghị (nếu có).
- Sử dụng ngôn ngữ phù hợp với đối tượng mục tiêu.

Cấu trúc đầu ra JSON:
```json
{
  "title": "Tiêu đề bản tóm tắt",
  "summary": "Bản tóm tắt nội dung chính",
  "keyPoints": [
    "Điểm chính 1",
    "Điểm chính 2",
    "..."
  ],
  "recommendations": [
    "Khuyến nghị 1",
    "Khuyến nghị 2",
    "..."
  ]
}
```
```

- [ ] **Bước 2: Thêm phương thức `summarizeContent` vào `packages/content-research/lib/llm.js`**

```javascript
// ... (phần trên không đổi)

class LLMClient extends CoreLLMClient {
    async summarizeContent(content, title, lang = 'vi') {
        const skillPath = resolveSkillFile('content-research-summarizer.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');

        const userPrompt = `Title: ${title}
Language: ${lang}
Content to summarize:
${content}`;

        const result = await this.chatJSON(systemPrompt, userPrompt);
        return result;
    }
    // Các phương thức domain-specific khác sẽ được thêm vào đây
}

module.exports = { LLMClient, resolveSkillFile };
```

- [ ] **Bước 3: Tạo `packages/content-research/lib/summarizer.js`**

```javascript
const { LLMClient } = require('./llm');

class ContentSummarizer {
    constructor(config) {
        this.llm = new LLMClient(config);
    }

    async summarize(content, title, lang) {
        if (!content || !title) {
            throw new Error('Missing required arguments: content, title');
        }
        return this.llm.summarizeContent(content, title, lang);
    }
}

module.exports = ContentSummarizer;
```

- [ ] **Bước 4: Cập nhật `packages/content-research/lib/index.js` để xuất `ContentSummarizer`**

```javascript
const ContentSummarizer = require('./summarizer');

module.exports = {
  ContentSummarizer,
  // Các module công cụ khác sẽ được xuất ở đây
};
```

- [ ] **Bước 5: Commit**

```bash
git add packages/content-research/
git commit -m "feat(content-research): implement ContentSummarizer tool"
```

### Tác vụ 3: Triển khai công cụ `ContentIdeator`

**Mục tiêu:** Tạo module `ideator.js` để tạo ý tưởng nội dung, bao gồm cả việc đọc skill file và gọi LLM.

**Files:**
- Create: `packages/content-research/lib/ideator.js`
- Create: `packages/content-research/skills/content-research-ideator.md`
- Modify: `packages/content-research/lib/index.js`
- Modify: `packages/content-research/lib/llm.js`

**Interfaces:**
- Consumes: `LLMClient` từ `lib/llm.js`
- Produces: `ContentIdeator` class được xuất từ `lib/index.js`, phương thức `generateContentIdeas` trong `LLMClient`.

- [ ] **Bước 1: Tạo `packages/content-research/skills/content-research-ideator.md`**

```markdown
Bạn là một chuyên gia tạo ý tưởng nội dung. Nhiệm vụ của bạn là tạo ra các ý tưởng nội dung sáng tạo và hấp dẫn dựa trên chủ đề, đối tượng mục tiêu và định dạng đã cho.

Đảm bảo các ý tưởng:
- Độc đáo và phù hợp.
- Có tiềm năng thu hút sự chú ý.
- Cung cấp giá trị cho đối tượng mục tiêu.
- Đa dạng về góc độ tiếp cận.

Cấu trúc đầu ra JSON:
```json
{
  "topic": "Chủ đề chính",
  "ideas": [
    {
      "title": "Tiêu đề ý tưởng 1",
      "hook": "Móc câu hấp dẫn",
      "format": "Định dạng (ví dụ: bài viết blog, video, infographic)",
      "keywords": ["từ khóa 1", "từ khóa 2"],
      "targetAudience": "Đối tượng mục tiêu"
    },
    {
      "title": "Tiêu đề ý tưởng 2",
      "hook": "Móc câu hấp dẫn",
      "format": "Định dạng",
      "keywords": ["từ khóa 1", "từ khóa 2"],
      "targetAudience": "Đối tượng mục tiêu"
    }
  ]
}
```
```

- [ ] **Bước 2: Thêm phương thức `generateContentIdeas` vào `packages/content-research/lib/llm.js`**

```javascript
// ... (phần trên không đổi)

class LLMClient extends CoreLLMClient {
    // ... (phương thức summarizeContent đã có)

    async generateContentIdeas(topic, audience, format, numIdeas = 3, lang = 'vi') {
        const skillPath = resolveSkillFile('content-research-ideator.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');

        const userPrompt = `Topic: ${topic}
Target Audience: ${audience}
Format: ${format}
Number of Ideas: ${numIdeas}
Language: ${lang}`;

        const result = await this.chatJSON(systemPrompt, userPrompt);
        return result;
    }
}

module.exports = { LLMClient, resolveSkillFile };
```

- [ ] **Bước 3: Tạo `packages/content-research/lib/ideator.js`**

```javascript
const { LLMClient } = require('./llm');

class ContentIdeator {
    constructor(config) {
        this.llm = new LLMClient(config);
    }

    async generate(topic, audience, format, numIdeas, lang) {
        if (!topic || !audience || !format) {
            throw new Error('Missing required arguments: topic, audience, format');
        }
        return this.llm.generateContentIdeas(topic, audience, format, numIdeas, lang);
    }
}

module.exports = ContentIdeator;
```

- [ ] **Bước 4: Cập nhật `packages/content-research/lib/index.js` để xuất `ContentIdeator`**

```javascript
const ContentSummarizer = require('./summarizer');
const ContentIdeator = require('./ideator');

module.exports = {
  ContentSummarizer,
  ContentIdeator,
  // Các module công cụ khác sẽ được xuất ở đây
};
```

- [ ] **Bước 5: Commit**

```bash
git add packages/content-research/
git commit -m "feat(content-research): implement ContentIdeator tool"
```

### Tác vụ 4: Triển khai công cụ `ArticleManager`

**Mục tiêu:** Tạo module `manager.js` để quản lý bài viết, bao gồm các chức năng cơ bản như lưu trữ, truy xuất và cập nhật.

**Files:**
- Create: `packages/content-research/lib/manager.js`
- Create: `packages/content-research/skills/content-research-manager.md`
- Modify: `packages/content-research/lib/index.js`
- Modify: `packages/content-research/lib/llm.js`

**Interfaces:**
- Consumes: `LLMClient` từ `lib/llm.js` (nếu cần cho các tác vụ liên quan đến LLM)
- Produces: `ArticleManager` class được xuất từ `lib/index.js`, phương thức `manageArticle` trong `LLMClient` (nếu có).

- [ ] **Bước 1: Tạo `packages/content-research/skills/content-research-manager.md`**

```markdown
Bạn là một trợ lý quản lý bài viết. Nhiệm vụ của bạn là hỗ trợ các tác vụ liên quan đến quản lý vòng đời của bài viết, bao gồm phân loại, gắn thẻ, tóm tắt tự động hoặc đề xuất cải tiến.

Cấu trúc đầu ra JSON:
```json
{
  "articleId": "ID bài viết",
  "title": "Tiêu đề bài viết",
  "status": "Trạng thái (ví dụ: draft, published, archived)",
  "tags": ["tag1", "tag2"],
  "category": "Danh mục",
  "summary": "Tóm tắt ngắn gọn (tự động tạo nếu cần)",
  "suggestions": [
    "Đề xuất cải tiến 1",
    "Đề xuất cải tiến 2"
  ]
}
```
```

- [ ] **Bước 2: Thêm phương thức `manageArticle` vào `packages/content-research/lib/llm.js` (nếu cần)**

```javascript
// ... (phần trên không đổi)

class LLMClient extends CoreLLMClient {
    // ... (phương thức summarizeContent, generateContentIdeas đã có)

    async manageArticle(articleContent, articleTitle, action, lang = 'vi') {
        const skillPath = resolveSkillFile('content-research-manager.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');

        const userPrompt = `Article Title: ${articleTitle}
Action: ${action}
Language: ${lang}
Article Content:
${articleContent}`;

        const result = await this.chatJSON(systemPrompt, userPrompt);
        return result;
    }
}

module.exports = { LLMClient, resolveSkillFile };
```

- [ ] **Bước 3: Tạo `packages/content-research/lib/manager.js`**

```javascript
const { LLMClient } = require('./llm');

class ArticleManager {
    constructor(config) {
        this.llm = new LLMClient(config);
    }

    async processArticle(articleContent, articleTitle, action, lang) {
        if (!articleContent || !articleTitle || !action) {
            throw new Error('Missing required arguments: articleContent, articleTitle, action');
        }
        // Ví dụ: action có thể là 'summarize', 'categorize', 'suggest_improvements'
        return this.llm.manageArticle(articleContent, articleTitle, action, lang);
    }
}

module.exports = ArticleManager;
```

- [ ] **Bước 4: Cập nhật `packages/content-research/lib/index.js` để xuất `ArticleManager`**

```javascript
const ContentSummarizer = require('./summarizer');
const ContentIdeator = require('./ideator');
const ArticleManager = require('./manager');

module.exports = {
  ContentSummarizer,
  ContentIdeator,
  ArticleManager,
  // Các module công cụ khác sẽ được xuất ở đây
};
```

- [ ] **Bước 5: Commit**

```bash
git add packages/content-research/
git commit -m "feat(content-research): implement ArticleManager tool"
```

### Tác vụ 5: Triển khai công cụ `CompetitorAnalyzer`

**Mục tiêu:** Tạo module `analyzer.js` để phân tích đối thủ cạnh tranh, bao gồm cả việc sử dụng tự động hóa trình duyệt và gọi LLM.

**Files:**
- Create: `packages/content-research/lib/analyzer.js`
- Create: `packages/content-research/skills/content-research-analyzer.md`
- Modify: `packages/content-research/lib/index.js`
- Modify: `packages/content-research/lib/llm.js`

**Interfaces:**
- Consumes: `LLMClient` từ `lib/llm.js`, `BrowserManager` từ `@andy-toolforge/core`.
- Produces: `CompetitorAnalyzer` class được xuất từ `lib/index.js`, phương thức `analyzeCompetitor` trong `LLMClient` (nếu có).

- [ ] **Bước 1: Tạo `packages/content-research/skills/content-research-analyzer.md`**

```markdown
Bạn là một chuyên gia phân tích đối thủ cạnh tranh. Nhiệm vụ của bạn là phân tích thông tin về đối thủ cạnh tranh (ví dụ: trang web, nội dung, chiến lược SEO) và cung cấp một bản phân tích chi tiết, bao gồm điểm mạnh, điểm yếu, cơ hội và mối đe dọa (SWOT).

Cấu trúc đầu ra JSON:
```json
{
  "competitorName": "Tên đối thủ",
  "website": "URL trang web",
  "analysisSummary": "Tóm tắt phân tích",
  "swot": {
    "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
    "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"],
    "opportunities": ["Cơ hội 1", "Cơ hội 2"],
    "threats": ["Mối đe dọa 1", "Mối đe dọa 2"]
  },
  "keyContentAreas": [
    "Lĩnh vực nội dung chính 1",
    "Lĩnh vực nội dung chính 2"
  ],
  "seoStrategy": "Chiến lược SEO của đối thủ"
}
```
```

- [ ] **Bước 2: Thêm phương thức `analyzeCompetitor` vào `packages/content-research/lib/llm.js` (nếu cần)**

```javascript
// ... (phần trên không đổi)

class LLMClient extends CoreLLMClient {
    // ... (phương thức summarizeContent, generateContentIdeas, manageArticle đã có)

    async analyzeCompetitor(competitorUrl, analysisScope, lang = 'vi') {
        const skillPath = resolveSkillFile('content-research-analyzer.md');
        const systemPrompt = fs.readFileSync(skillPath, 'utf-8');

        const userPrompt = `Competitor URL: ${competitorUrl}
Analysis Scope: ${analysisScope}
Language: ${lang}`;

        const result = await this.chatJSON(systemPrompt, userPrompt);
        return result;
    }
}

module.exports = { LLMClient, resolveSkillFile };
```

- [ ] **Bước 3: Tạo `packages/content-research/lib/analyzer.js`**

```javascript
const { LLMClient } = require('./llm');
const { BrowserManager } = require('@andy-toolforge/core'); // Sử dụng BrowserManager từ core

class CompetitorAnalyzer {
    constructor(config) {
        this.llm = new LLMClient(config);
        this.browserManager = new BrowserManager(); // Khởi tạo BrowserManager
    }

    async analyze(competitorUrl, analysisScope, lang) {
        if (!competitorUrl || !analysisScope) {
            throw new Error('Missing required arguments: competitorUrl, analysisScope');
        }

        let browser;
        try {
            browser = await this.browserManager.launch();
            const page = await browser.newPage();
            await page.goto(competitorUrl, { waitUntil: 'networkidle2' });

            // Lấy nội dung trang web để phân tích
            const pageContent = await page.content();

            // Gọi LLM để phân tích nội dung
            const analysisResult = await this.llm.analyzeCompetitor(
                pageContent, // Truyền nội dung trang web vào LLM
                analysisScope,
                lang
            );
            return analysisResult;
        } finally {
            if (browser) {
                await this.browserManager.close();
            }
        }
    }
}

module.exports = CompetitorAnalyzer;
```

- [ ] **Bước 4: Cập nhật `packages/content-research/lib/index.js` để xuất `CompetitorAnalyzer`**

```javascript
const ContentSummarizer = require('./summarizer');
const ContentIdeator = require('./ideator');
const ArticleManager = require('./manager');
const CompetitorAnalyzer = require('./analyzer');

module.exports = {
  ContentSummarizer,
  ContentIdeator,
  ArticleManager,
  CompetitorAnalyzer,
};
```

- [ ] **Bước 5: Commit**

```bash
git add packages/content-research/
git commit -m "feat(content-research): implement CompetitorAnalyzer tool"
```

### Tác vụ 6: Cập nhật `packages/mcp/lib/mcp-server.js` để đăng ký các công cụ mới

**Mục tiêu:** Đăng ký các công cụ mới của gói `content-research` vào MCP server để chúng có thể được gọi.

**Files:**
- Modify: `packages/mcp/lib/mcp-server.js`

**Interfaces:**
- Consumes: Các module công cụ từ `@andy-toolforge/content-research`.
- Produces: MCP server có khả năng gọi các công cụ `content-research`.

- [ ] **Bước 1: Cập nhật `packages/mcp/lib/mcp-server.js`**

```javascript
const { LLMClient } = require('@andy-toolforge/core');
const readline = require('readline');
const seoGenerate = require('./tools/seo-generate');
const analyzeScript = require('./tools/analyze-script');
const generatePrompts = require('./tools/generate-prompts');
const generateMapping = require('./tools/generate-mapping');
const suggestCover = require('./tools/suggest-cover');

// Import các công cụ mới từ gói content-research
const {
    ContentSummarizer,
    ContentIdeator,
    ArticleManager,
    CompetitorAnalyzer,
} = require('@andy-toolforge/content-research');

class MCPServer {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.provider = config.provider || 'gemini';
        this.model = config.model || (this.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.0-flash');
        this._llm = null;
        this._tools = {
            toolforge_seo_generate: seoGenerate,
            analyze_script: analyzeScript,
            generate_prompts: generatePrompts,
            generate_mapping: generateMapping,
            suggest_cover: suggestCover,
            // Đăng ký các công cụ mới
            content_research_summarize: {
                definition: {
                    name: 'content_research_summarize',
                    description: 'Tóm tắt nghiên cứu nội dung từ văn bản đã cho.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            content: { type: 'string', description: 'Nội dung cần tóm tắt' },
                            title: { type: 'string', description: 'Tiêu đề nội dung' },
                            lang: { type: 'string', description: 'Mã ngôn ngữ (vi, en)', default: 'vi' },
                        },
                        required: ['content', 'title'],
                    },
                },
                handler: async (llm, args) => {
                    const summarizer = new ContentSummarizer({ apiKey: llm.apiKey, provider: llm.provider, model: llm.model });
                    return summarizer.summarize(args.content, args.title, args.lang);
                },
            },
            content_research_ideate: {
                definition: {
                    name: 'content_research_ideate',
                    description: 'Tạo ý tưởng nội dung dựa trên chủ đề, đối tượng và định dạng.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'Chủ đề chính' },
                            audience: { type: 'string', description: 'Đối tượng mục tiêu' },
                            format: { type: 'string', description: 'Định dạng nội dung (ví dụ: blog, video)' },
                            numIdeas: { type: 'number', description: 'Số lượng ý tưởng cần tạo', default: 3 },
                            lang: { type: 'string', description: 'Mã ngôn ngữ (vi, en)', default: 'vi' },
                        },
                        required: ['topic', 'audience', 'format'],
                    },
                },
                handler: async (llm, args) => {
                    const ideator = new ContentIdeator({ apiKey: llm.apiKey, provider: llm.provider, model: llm.model });
                    return ideator.generate(args.topic, args.audience, args.format, args.numIdeas, args.lang);
                },
            },
            content_research_manage_article: {
                definition: {
                    name: 'content_research_manage_article',
                    description: 'Quản lý bài viết (phân loại, gắn thẻ, tóm tắt, đề xuất cải tiến).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            articleContent: { type: 'string', description: 'Nội dung bài viết' },
                            articleTitle: { type: 'string', description: 'Tiêu đề bài viết' },
                            action: { type: 'string', description: 'Hành động quản lý (ví dụ: summarize, categorize, suggest_improvements)' },
                            lang: { type: 'string', description: 'Mã ngôn ngữ (vi, en)', default: 'vi' },
                        },
                        required: ['articleContent', 'articleTitle', 'action'],
                    },
                },
                handler: async (llm, args) => {
                    const manager = new ArticleManager({ apiKey: llm.apiKey, provider: llm.provider, model: llm.model });
                    return manager.processArticle(args.articleContent, args.articleTitle, args.action, args.lang);
                },
            },
            content_research_analyze_competitor: {
                definition: {
                    name: 'content_research_analyze_competitor',
                    description: 'Phân tích đối thủ cạnh tranh bằng cách thu thập thông tin từ URL và sử dụng LLM.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            competitorUrl: { type: 'string', description: 'URL của đối thủ cạnh tranh' },
                            analysisScope: { type: 'string', description: 'Phạm vi phân tích (ví dụ: SEO, nội dung, chiến lược)' },
                            lang: { type: 'string', description: 'Mã ngôn ngữ (vi, en)', default: 'vi' },
                        },
                        required: ['competitorUrl', 'analysisScope'],
                    },
                },
                handler: async (llm, args) => {
                    const analyzer = new CompetitorAnalyzer({ apiKey: llm.apiKey, provider: llm.provider, model: llm.model });
                    return analyzer.analyze(args.competitorUrl, args.analysisScope, args.lang);
                },
            },
        };
    }

    // ... (các phương thức khác không đổi)
}

module.exports = MCPServer;
```

- [ ] **Bước 2: Commit**

```bash
git add packages/mcp/lib/mcp-server.js
git commit -m "feat(mcp): register new content-research tools"
```

### Tác vụ 7: Viết bài kiểm tra đơn vị cho các công cụ `content-research`

**Mục tiêu:** Đảm bảo các công cụ `ContentSummarizer`, `ContentIdeator`, `ArticleManager`, `CompetitorAnalyzer` hoạt động chính xác và xử lý lỗi đúng cách.

**Files:**
- Create: `packages/content-research/lib/summarizer.test.js`
- Create: `packages/content-research/lib/ideator.test.js`
- Create: `packages/content-research/lib/manager.test.js`
- Create: `packages/content-research/lib/analyzer.test.js`

**Interfaces:**
- Consumes: Các module công cụ từ `lib/`.
- Produces: Các bài kiểm tra đơn vị vượt qua.

- [ ] **Bước 1: Tạo `packages/content-research/lib/summarizer.test.js`**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ContentSummarizer = require('./summarizer');
const { LLMClient } = require('./llm'); // Để mock LLMClient

describe('ContentSummarizer', () => {
    it('summarizes content correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.summarizeContent = async (content, title, lang) => {
            assert.equal(content, 'Test content');
            assert.equal(title, 'Test Title');
            assert.equal(lang, 'en');
            return { title: 'Summary Title', summary: 'Summary text', keyPoints: ['Point 1'] };
        };

        const summarizer = new ContentSummarizer({});
        summarizer.llm = mockLlm; // Inject mock LLM

        const result = await summarizer.summarize('Test content', 'Test Title', 'en');
        assert.equal(result.title, 'Summary Title');
        assert.equal(result.summary, 'Summary text');
        assert.deepStrictEqual(result.keyPoints, ['Point 1']);
    });

    it('throws error if content or title is missing', async () => {
        const summarizer = new ContentSummarizer({});
        await assert.rejects(() => summarizer.summarize(null, 'Title'), /content/);
        await assert.rejects(() => summarizer.summarize('Content', null), /title/);
    });
});
```

- [ ] **Bước 2: Tạo `packages/content-research/lib/ideator.test.js`**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ContentIdeator = require('./ideator');
const { LLMClient } = require('./llm');

describe('ContentIdeator', () => {
    it('generates content ideas correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.generateContentIdeas = async (topic, audience, format, numIdeas, lang) => {
            assert.equal(topic, 'AI');
            assert.equal(audience, 'Developers');
            assert.equal(format, 'Blog Post');
            assert.equal(numIdeas, 2);
            assert.equal(lang, 'en');
            return { topic: 'AI', ideas: [{ title: 'Idea 1' }] };
        };

        const ideator = new ContentIdeator({});
        ideator.llm = mockLlm;

        const result = await ideator.generate('AI', 'Developers', 'Blog Post', 2, 'en');
        assert.equal(result.topic, 'AI');
        assert.equal(result.ideas[0].title, 'Idea 1');
    });

    it('throws error if topic, audience, or format is missing', async () => {
        const ideator = new ContentIdeator({});
        await assert.rejects(() => ideator.generate(null, 'Audience', 'Format'), /topic/);
        await assert.rejects(() => ideator.generate('Topic', null, 'Format'), /audience/);
        await assert.rejects(() => ideator.generate('Topic', 'Audience', null), /format/);
    });
});
```

- [ ] **Bước 3: Tạo `packages/content-research/lib/manager.test.js`**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ArticleManager = require('./manager');
const { LLMClient } = require('./llm');

describe('ArticleManager', () => {
    it('processes article correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.manageArticle = async (content, title, action, lang) => {
            assert.equal(content, 'Article content');
            assert.equal(title, 'Article Title');
            assert.equal(action, 'summarize');
            assert.equal(lang, 'en');
            return { articleId: '123', title: 'Article Title', summary: 'Summary' };
        };

        const manager = new ArticleManager({});
        manager.llm = mockLlm;

        const result = await manager.processArticle('Article content', 'Article Title', 'summarize', 'en');
        assert.equal(result.articleId, '123');
        assert.equal(result.summary, 'Summary');
    });

    it('throws error if articleContent, articleTitle, or action is missing', async () => {
        const manager = new ArticleManager({});
        await assert.rejects(() => manager.processArticle(null, 'Title', 'Action'), /articleContent/);
        await assert.rejects(() => manager.processArticle('Content', null, 'Action'), /articleTitle/);
        await assert.rejects(() => manager.processArticle('Content', 'Title', null), /action/);
    });
});
```

- [ ] **Bước 4: Tạo `packages/content-research/lib/analyzer.test.js`**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const CompetitorAnalyzer = require('./analyzer');
const { LLMClient } = require('./llm');
const { BrowserManager } = require('@andy-toolforge/core');

// Mock BrowserManager
class MockBrowserManager extends BrowserManager {
    async launch() {
        this.browser = {
            newPage: async () => ({
                goto: async (url) => {
                    assert.equal(url, 'http://competitor.com');
                },
                content: async () => '<html><body>Competitor content</body></html>',
            }),
            close: async () => {},
        };
        return this.browser;
    }
    async close() {
        // Do nothing
    }
}

describe('CompetitorAnalyzer', () => {
    it('analyzes competitor correctly', async () => {
        const mockLlm = new LLMClient({ apiKey: 'test', provider: 'test', model: 'test' });
        mockLlm.analyzeCompetitor = async (pageContent, scope, lang) => {
            assert.equal(pageContent, '<html><body>Competitor content</body></html>');
            assert.equal(scope, 'SEO');
            assert.equal(lang, 'en');
            return { competitorName: 'Competitor A', analysisSummary: 'Good SEO' };
        };

        const analyzer = new CompetitorAnalyzer({});
        analyzer.llm = mockLlm;
        analyzer.browserManager = new MockBrowserManager(); // Inject mock BrowserManager

        const result = await analyzer.analyze('http://competitor.com', 'SEO', 'en');
        assert.equal(result.competitorName, 'Competitor A');
        assert.equal(result.analysisSummary, 'Good SEO');
    });

    it('throws error if competitorUrl or analysisScope is missing', async () => {
        const analyzer = new CompetitorAnalyzer({});
        await assert.rejects(() => analyzer.analyze(null, 'Scope'), /competitorUrl/);
        await assert.rejects(() => analyzer.analyze('http://test.com', null), /analysisScope/);
    });
});
```

- [ ] **Bước 5: Commit**

```bash
git add packages/content-research/
git commit -m "feat(content-research): add unit tests for all tools"
```

### Tác vụ 8: Chạy tất cả các bài kiểm tra

**Mục tiêu:** Đảm bảo tất cả các bài kiểm tra trong monorepo đều vượt qua sau khi triển khai các công cụ mới.

**Files:**
- None

**Interfaces:**
- Consumes: Tất cả các bài kiểm tra trong monorepo.
- Produces: Báo cáo kiểm tra thành công.

- [ ] **Bước 1: Chạy tất cả các bài kiểm tra**

```bash
npm test
```

- [ ] **Bước 2: Commit (nếu có bất kỳ thay đổi nào cần thiết sau khi chạy kiểm tra)**

```bash
git add .
git commit -m "chore: ensure all tests pass after content-research implementation"
```

---

**Kế hoạch hoàn thành và đã lưu vào `docs/superpowers/plans/2026-07-02-content-research-implementation.md`. Hai tùy chọn thực thi:**

**1. Subagent-Driven (được khuyến nghị)** - Tôi sẽ ủy quyền một subagent mới cho mỗi tác vụ, xem xét giữa các tác vụ, lặp lại nhanh chóng.

**2. Thực thi nội tuyến** - Thực thi các tác vụ trong phiên này bằng cách sử dụng `executing-plans`, thực thi hàng loạt với các điểm kiểm tra.

**Bạn chọn cách tiếp cận nào?**
