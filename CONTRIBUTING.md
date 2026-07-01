# Contributing to Toolforge

Hướng dẫn setup môi trường development cho toolforge monorepo.

## Yêu cầu

- Node.js >= 20
- npm >= 10
- Git

## Setup

```bash
cd ~/personal/toolforge
npm install
```

Sau `npm install`, npm workspaces tự động liên kết các package nội bộ
(`@andy-toolforge/core` → `packages/core`), không cần `npm link` riêng.

## Development workflow

### 1. Sửa code trong một package

Mọi package đều được workspace-linked — sửa file trong `packages/<name>/lib/`
là có hiệu lực ngay trong toàn bộ monorepo. Không cần build hay copy.

### 2. Test một package riêng

```bash
# Chạy test của core
npm test -w @andy-toolforge/core

# Chạy test của footage-generation
npm test -w @andy-toolforge/footage-generation
```

### 3. Thêm dependency cho một package

```bash
npm install <dep> -w @andy-toolforge/core
```

### 4. Thêm package mới

```bash
mkdir -p packages/new-domain/lib packages/new-domain/skills packages/new-domain/templates
```

Tạo `package.json`:

```json
{
  "name": "@andy-toolforge/new-domain",
  "version": "0.1.0",
  "main": "lib/index.js",
  "scripts": {
    "postinstall": "node skills/postinstall.js"
  },
  "dependencies": {
    "@andy-toolforge/core": "^1.0.0"
  }
}
```

Thêm `"packages/new-domain"` vào mảng `workspaces` trong root `package.json`,
rồi `npm install` để workspace link.

## Linking vào client project bên ngoài

```bash
# 1. Register từng package (chạy 1 lần sau khi clone)
for pkg in packages/*; do (cd "$pkg" && npm link); done

# 2. Trong thư mục client project
npm link @andy-toolforge/core @andy-toolforge/footage-generation
```

## Coding conventions

- CommonJS (`require` / `module.exports`) — tránh ESM để tương thích rộng
- Mỗi package export qua `lib/index.js`
- Skill files đặt trong `skills/`, symlink vào `.opencode/skills/` qua `postinstall.js`
- Template files đặt trong `templates/`
- Domain-specific LLM methods kế thừa `@andy-toolforge/core`'s `LLMClient`

## Package dependency graph

```
core          ← không phụ thuộc gì
     ↑
footage-generation → core
seo-generation     → core
book-writing       → core
pm-support         → core
ba-support         → core
coding-support     → core
```
