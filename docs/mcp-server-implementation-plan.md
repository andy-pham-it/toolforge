# 🏗️ Implementation Plan: `@andy-toolforge/mcp`

> MCP server cho agent (opencode) gọi tool trực tiếp từ `@andy-toolforge/*` packages.
> Tạo trong monorepo toolforge, publish lên npmjs.org, agent dùng qua `npx -y`.

---

## 1. Vấn đề cần giải quyết

Hiện tại `@andy-toolforge/core` và `@andy-toolforge/footage-generation` là **thư viện JavaScript thuần** — agent không thể gọi function từ JS lib trực tiếp. Agent chỉ có thể:
- Đọc skill `.md` hướng dẫn → tự suy luận → làm tay
- Viết script `require('@andy-toolforge/...')` rồi chạy `bash` tạm thời

**Giải pháp:** Tạo MCP server package expose các tool qua JSON-RPC stdin/stdout. Agent gọi tool như gọi `tsc_check`, `eslint_check` — 1 lệnh, không suy luận.

---

## 2. Package `@andy-toolforge/mcp`

### 2.1. Cấu trúc

```
packages/mcp/
  package.json
  index.mjs                       ← Entry: MCP server (stdin/stdout JSON-RPC)
  lib/
    mcp-server.mjs                ← MCP protocol handler (khởi tạo, routing)
    tools/
      seo-generate.mjs            ← Tool: sinh SEO YouTube/TikTok/Facebook
      analyze-script.mjs          ← Tool: phân tích kịch bản → segments
      generate-prompts.mjs        ← Tool: tạo prompts.md
      generate-mapping.mjs        ← Tool: tạo mapping-phan-canh.md
      suggest-cover.mjs           ← Tool: tạo cover prompts
  test/
    seo-generate.test.mjs
    analyze-script.test.mjs
    mcp-server.test.mjs
  AGENTS.md
```

### 2.2. package.json

```json
{
  "name": "@andy-toolforge/mcp",
  "version": "1.0.0",
  "description": "MCP server for Andy Toolforge — AI-powered tools for podcast production",
  "type": "module",
  "main": "index.mjs",
  "bin": {
    "toolforge-mcp": "./index.mjs"
  },
  "dependencies": {
    "@andy-toolforge/core": "^1.0.0",
    "@andy-toolforge/footage-generation": "^1.0.0"
  },
  "scripts": {
    "test": "node --test test/*.test.mjs",
    "start": "node index.mjs",
    "prepublishOnly": "npm test"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

> **⚠️ Lưu ý registry:** Các package `@andy-toolforge/core` và `@andy-toolforge/footage-generation` hiện có `"publishConfig": { "registry": "https://npm.pkg.github.com" }` trong package.json của chúng, nhưng thực tế đã publish lên **npmjs.org** thành công (do token npm đã ghi đè). Cần xoá dòng registry khỏi tất cả package.json — nếu không npm publish sẽ cố đẩy lên GitHub Packages và fail.
>
> **Fix:**
> - `packages/core/package.json`: xoá `"publishConfig"` hoặc sửa thành `"access": "public"`
> - `packages/footage-generation/package.json`: tương tự
> - `packages/mcp/package.json`: chỉ giữ `"access": "public"`

### 2.3. index.mjs (entry point)

MCP protocol: stdin/stdout JSON-RPC.

```javascript
#!/usr/bin/env node
import { McpServer } from './lib/mcp-server.js';

const server = new McpServer({
  name: '@andy-toolforge/mcp',
  version: '1.0.0',
  tools: [
    import('./lib/tools/seo-generate.js'),
    import('./lib/tools/analyze-script.js'),
    import('./lib/tools/generate-prompts.js'),
    import('./lib/tools/generate-mapping.js'),
    import('./lib/tools/suggest-cover.js'),
  ]
});

// MCP transport: stdin → process → stdout
process.stdin.on('data', async (raw) => {
  try {
    const msg = JSON.parse(raw.toString().trim());
    const response = await server.handleMessage(msg);
    if (response) process.stdout.write(JSON.stringify(response) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', id: null, error: { code: -32603, message: err.message }
    }) + '\n');
  }
});
```

---

## 3. Danh sách tools

| Tool name | Input | Output | Mô tả |
|-----------|-------|--------|-------|
| `toolforge_seo_generate` | `{ script, title, platforms? }` | `{ seo: { youtube: {...}, tiktok: {...}, facebook: {...} } }` | Full SEO cho tất cả nền tảng |
| `toolforge_analyze_script` | `{ script, outline? }` | `{ segments, totalDuration }` | Chia kịch bản → phân đoạn + thời gian |
| `toolforge_generate_prompts` | `{ script, segments, lang }` | `{ prompts_md }` | Tạo file prompts.md hoàn chỉnh |
| `toolforge_generate_mapping` | `{ title, segments }` | `{ mapping_md }` | Tạo file mapping-phan-canh.md |
| `toolforge_suggest_cover` | `{ title, outline?, chapter? }` | `{ prompts_covers_md }` | Tạo cover prompts |

---

## 4. Chi tiết từng tool

### 4.1. `toolforge_seo_generate`

**File:** `lib/tools/seo-generate.js`

**Input validation:**
- `script` required, string, >= 50 ký tự
- `title` required, string, >= 5 ký tự
- `platforms` optional, array `['youtube', 'tiktok', 'facebook']`, default: all

**Logic:**
1. Tạo `LLMClient` từ `@andy-toolforge/core`
2. Build system prompt (chuyên gia SEO tiếng Việt)
3. Build user prompt (script + title + platform filter)
4. Gọi `client.chat()`, parse JSON response
5. Validate JSON structure, fallback nếu parse fail
6. Return kết quả

**Prompt template (lưu trong code, không cần file riêng):**

````
Bạn là chuyên gia SEO nội dung số tiếng Việt.

Yêu cầu tạo SEO từ kịch bản podcast.

TIÊU ĐỀ TẬP: {title}

KỊCH BẢN:
{script}

{NẾU CÓ platforms filter: Chỉ tạo cho: {platforms}}

Trả về JSON CHÍNH XÁC:
{JSON schema mẫu}

CHỈ trả về JSON, không kèm giải thích.
````

**Output format:**

```json
{
  "youtube": {
    "title": "...",
    "description": "...",
    "tags": ["tag1", "tag2"],
    "thumbnail": "..."
  },
  "tiktok": {
    "caption": "...",
    "hashtags": ["#a", "#b"]
  },
  "facebook": {
    "headline": "...",
    "description": "...",
    "tags": ["tag1", "tag2"]
  }
}
```

### 4.2. `toolforge_analyze_script`

**File:** `lib/tools/analyze-script.js`

**Logic:**
1. Gọi LLMClient với prompt yêu cầu chia segments
2. Mỗi segment có: `{ id, name, summary, estimatedSeconds, visualType }`
3. Tính cumulative timestamps từ estimatedSeconds
4. Trả về segments array + tổng duration

**Visual types:** `surrealist`, `lineart`, `comparison`, `typography`, `infographic`

### 4.3. `toolforge_generate_prompts`

**File:** `lib/tools/generate-prompts.js`

**Logic:**
1. Với mỗi segment, xác định visual type
2. Gọi LLM (hoặc PromptWriter từ footage-generation) sinh 5 prompts (a,b,c,d,e)
3. Ghép thành markdown đúng format prompts.md
4. Return string markdown

**Prompt rules được hardcode:**
- Không dùng `--ar`, `--no`
- 16:9 aspect ratio
- Single-line (không xuống hàng)
- No photorealistic humans → silhouette/stylized
- Text = tiếng Việt nếu có chữ
- Vietnamese language instruction nếu có text

### 4.4. `toolforge_generate_mapping`

**File:** `lib/tools/generate-mapping.js`

**Logic:**
1. Nhận segments (có timestamps)
2. Sinh mapping table: mỗi segment → 5 ảnh a/b/c/d/e
3. Gợi ý edit: xen kẽ A↔B, dùng E để chuyển tiếp
4. Trả về markdown mapping

### 4.5. `toolforge_suggest_cover`

**File:** `lib/tools/suggest-cover.js`

**Logic:**
1. Nếu có outline → đọc chapter titles
2. Gọi LLM chọn visual style phù hợp (Surrealist/Symbolic/Cosmic/...)
3. Sinh prompts cho series cover + chapter covers
4. Trả về markdown prompts-covers.md

---

## 5. Testing

### 5.1. Unit test (node --test)

```javascript
// test/seo-generate.test.mjs
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('SEO Generate', () => {
  it('should reject script < 50 chars', async () => {
    const result = await validateInput({ script: 'ngắn', title: 'Test' });
    assert.equal(result.error, 'script must be >= 50 chars');
  });

  it('should parse valid LLM response', async () => {
    const mockResponse = JSON.stringify({
      youtube: { title: 'Test', description: '...', tags: ['a'] }
    });
    const parsed = parseSeoResponse(mockResponse);
    assert.equal(parsed.youtube.title, 'Test');
  });

  it('should fallback gracefully on invalid JSON from LLM', async () => {
    const parsed = parseSeoResponse('```json\n{invalid}\n```');
    assert.ok(parsed.error);
  });
});
```

Chạy: `npm test` (dùng `node --test` built-in, không cần Jest/Vitest).

### 5.2. Integration test (thủ công, dùng cho dev)

```bash
# Test MCP protocol với seo tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"toolforge_seo_generate","arguments":{"script":"Đây là kịch bản podcast dài hơn 50 ký tự để test MCP server...","title":"Test Episode"}}}' | node index.mjs
```

### 5.3. Package-level test pattern

```
packages/mcp/
  test/
    seo-generate.test.mjs     ← validate input, parse response, error fallback
    analyze-script.test.mjs   ← segment splitting, timestamp calc
    mcp-server.test.mjs       ← protocol routing, error codes
    fixtures/
      sample-script.txt       ← kịch bản mẫu 1000+ từ để test
      expected-seo.json       ← expected output reference
```

---

## 6. CI/CD — GitHub Actions

**File:** `toolforge/.github/workflows/publish-mcp.yml`

(Nên gộp vào workflow publish hiện có, hoặc tạo riêng nếu có `paths` filter cho monorepo)

```yaml
name: Publish @andy-toolforge/mcp

on:
  push:
    paths:
      - 'packages/mcp/**'
    branches: [main]

jobs:
  test-and-publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: packages/mcp
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm test
      
      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

> **Cần:** `NPM_TOKEN` trong GitHub Secrets. Nếu chưa có, tạo token ở npmjs.com → Access Tokens → Generate new token (type: Automation — không cần 2FA cho CI).

---

## 7. Cấu hình phía client (dùng cho agent)

Thêm vào **global** `~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "toolforge": {
      "command": "npx",
      "args": ["-y", "@andy-toolforge/mcp"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

Sau khi thêm, restart opencode → agent có tools mới. Dùng được ở **mọi folder, mọi project**.

> **GEMINI_API_KEY:** có thể set trong `~/.zshrc` hoặc dùng `.env` mà opencode tự load.

---

## 8. Roadmap mở rộng

| Phase | Tools | Ghi chú |
|-------|-------|---------|
| **1 (MVP)** | `seo_generate`, `analyze_script` | 2 tools, publish lên npm, test global config |
| **2** | `generate_prompts`, `generate_mapping` | Thay thế hoàn toàn podcast-processor skill |
| **3** | `suggest_cover` | Thay thế podcast-cover-generator skill |
| **4** | `batch_generate_images` | Dùng BrowserManager từ core, sinh ảnh thật |
| **5** | `run_full_pipeline` | Tool tổng hợp chạy từ A→Z: script → ảnh → SEO |

---

## 9. Danh sách công việc cụ thể

1. **Sửa registry** trong `packages/core/package.json` và `packages/footage-generation/package.json` — xoá `publishConfig.registry` GitHub
2. **Tạo** `packages/mcp/` với cấu trúc thư mục
3. **Viết** `lib/mcp-server.js` — protocol handler đơn giản (routing, error handling)
4. **Viết** `lib/tools/seo-generate.js` — validation + LLM call + JSON parse
5. **Viết** `lib/tools/analyze-script.js` — script segmentation
6. **Viết** test cho 2 tools trên
7. **Viết** `index.mjs` — entry point stdin/stdout
8. **Chạy** `npm test` — pass hết
9. **Tạo** GitHub Actions workflow mới (hoặc sửa workflow hiện có)
10. **Push** lên main → CI chạy → publish lên npm
11. **Thêm** MCP config vào `~/.config/opencode/opencode.json`
12. **Kiểm tra** — restart opencode, gọi tool, verify output
