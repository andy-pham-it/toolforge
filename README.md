# 🔧 Toolforge — Personal Automation Toolbox

Monorepo chứa các package dùng chung cho mọi dự án automation cá nhân.
Thiết kế theo mô hình **npm workspaces** + **GitHub Packages**, mỗi package là một
domain riêng biệt, có thể publish độc lập.

## Packages

```
packages/
├── core/                 → @andy-toolforge/core                — Nền tảng (LLM, Browser, Logger, Queue)
├── footage-generation/   → @andy-toolforge/footage-generation  — Sinh ảnh/video cho podcast
├── seo-generation/       → @andy-toolforge/seo-generation      — SEO content, arbitrage, multi-platform publish
├── pm-support/           → @andy-toolforge/pm-support          — Project management, task tracking, invoicing
├── coding-support/       → @andy-toolforge/coding-support      — Code analysis, dependency graphs, complexity
├── book-writing/         → @andy-toolforge/book-writing        — Book writing, chapter generation, export
├── content-research/     → @andy-toolforge/content-research    — Content summarization, idea gen, article mgmt, competitor analysis
└── ba-support/           → @andy-toolforge/ba-support          — Business analysis, competitor research, SWOT
```

## Quick Start (local development)

```bash
# Clone & install
git clone <repo-url> ~/personal/toolforge
cd ~/personal/toolforge
npm install

# Register packages for local linking
for pkg in packages/*; do (cd "$pkg" && npm link); done
```

## Link vào client project

```bash
# Trong thư mục client project (vd: generate-images-for-podcast):
npm link @andy-toolforge/core @andy-toolforge/footage-generation

# Nếu cần skill files:
node node_modules/@andy-toolforge/footage-generation/skills/postinstall.js
```

## Publish

```bash
# Publish từng package lên GitHub Packages
npm publish -w @andy-toolforge/core
npm publish -w @andy-toolforge/footage-generation
npm publish -w @andy-toolforge/seo-generation
npm publish -w @andy-toolforge/pm-support
npm publish -w @andy-toolforge/coding-support
npm publish -w @andy-toolforge/book-writing
npm publish -w @andy-toolforge/content-research
npm publish -w @andy-toolforge/ba-support
```

Xem `docs/publishing.md` để biết chi tiết về CI/CD với GitHub Actions.

## Documentation

| File | Mô tả |
|------|-------|
| `README.md` | Giới thiệu & quick start |
| `CHANGELOG.md` | Lịch sử thay đổi |
| `CONTRIBUTING.md` | Hướng dẫn development |
| `docs/architecture.md` | Kiến trúc & design decisions |
| `docs/development.md` | Workflow dev chi tiết |
| `docs/publishing.md` | Hướng dẫn publish |
| `docs/migration-guide.md` | Migration client project |

> ⚠️ **Personal use only.** Không designed cho open-source contribution.
