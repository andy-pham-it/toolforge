# Development Workflow

Hướng dẫn chi tiết cho development hàng ngày với toolforge.

## 1. Cấu trúc branch

```
main              — ổn định, đã publish
feature/*         — phát triển tính năng mới
fix/*             — sửa lỗi
```

Commit messages theo conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`).

## 2. Phát triển local

### 2.1. Sửa code trong core package

Vì workspace link, sửa `packages/core/lib/llm.js` là hiệu lực ngay.
Test bằng cách require trong monorepo:

```bash
node -e "
  const { LLMClient } = require('@andy-toolforge/core');
  const c = new LLMClient({provider:'groq', apiKey:'test', model:'test'});
  console.log(c.baseUrl);
"
```

### 2.2. Sửa code trong domain package

Tương tự — sửa file là xong:

```bash
node -e "
  const { ImageGenerator } = require('@andy-toolforge/footage-generation');
  console.log(Object.keys(ImageGenerator));
"
```

### 2.3. Thêm module mới

1. Tạo file trong `packages/<name>/lib/`
2. Export trong `lib/index.js`

Ví dụ thêm `packages/core/lib/retry.js`:

```js
// packages/core/lib/retry.js
class Retry {
    static async withBackoff(fn, maxRetries = 3) { ... }
}
module.exports = Retry;
```

```js
// packages/core/lib/index.js
module.exports = {
    LLMClient: require('./llm'),
    Retry: require('./retry'),
    // ...
};
```

### 2.4. Test

```bash
# Test tất cả
npm test

# Test một package
npm test -w @andy-toolforge/core

# Test với Node --test (nếu package dùng built-in test runner)
node --test packages/core/lib/*.test.js
```

## 3. Validate trước commit

Kiểm tra monorepo hoạt động:

```bash
# Resolve tất cả package
npm ls

# Test import chain
node -e "
  const pkgs = ['core', 'footage-generation', 'seo-generation', 'book-writing',
                'pm-support', 'ba-support', 'coding-support'];
  pkgs.forEach(name => {
    try {
      const m = require('@andy-toolforge/' + name);
      console.log('✅ @andy-toolforge/' + name, '→', Object.keys(m).join(', '));
    } catch(e) {
      console.log('❌ @andy-toolforge/' + name, '→', e.message);
    }
  });
"
```

## 4. Link với client project thật

Sau khi sửa local, test với project thật:

```bash
cd ~/personal/generate-images-for-podcast
npm link @andy-toolforge/core @andy-toolforge/footage-generation

# Chạy thử server
node server.js

# Test API
curl -X POST http://localhost:3456/jobs/new \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test","script":"Hello world","lang":"vi"}'
```

## 5. Debugging

### Import không resolve được

```bash
# Kiểm tra workspace link
npm ls @andy-toolforge/core

# Nếu missing, reinstall
npm install
```

### Skill file không tìm thấy

```bash
# Chạy postinstall thủ công
node node_modules/@andy-toolforge/<package>/skills/postinstall.js

# Kiểm tra
ls .opencode/skills/ | grep <domain>-
```

### npm link bị lỗi

```bash
# Unlink rồi link lại
npm unlink @andy-toolforge/core && npm link @andy-toolforge/core
```
