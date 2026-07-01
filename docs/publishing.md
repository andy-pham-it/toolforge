# Publishing to GitHub Packages

Hướng dẫn publish toolforge packages lên GitHub Packages registry.

## Prerequisites

- GitHub token với scope `read:packages` và `write:packages`
- Đã config npm để dùng GitHub Packages

## 1. Cấu hình npm

```bash
# Tạo token tại https://github.com/settings/tokens
# Cần scope: read:packages, write:packages, repo

# Login vào GitHub Packages
npm login --registry=https://npm.pkg.github.com --scope=@andy-toolforge
```

Khi được hỏi username: nhập GitHub username
Password: dùng **personal access token** (không phải password GitHub)
Email: email đăng ký GitHub

## 2. Từng package cần có

Mỗi `package.json` cần:

```json
{
  "name": "@andy-toolforge/core",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<your-org>/toolforge.git"
  }
}
```

## 3. Publish thủ công

```bash
# Build (nếu cần) rồi publish từng package
npm publish -w @andy-toolforge/core
npm publish -w @andy-toolforge/footage-generation
npm publish -w @andy-toolforge/seo-generation
# ...etc
```

## 4. CI/CD với GitHub Actions

Tạo `.github/workflows/publish.yml`:

```yaml
name: Publish to GitHub Packages

on:
  push:
    branches: [main]
    paths:
      - 'packages/**'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
          scope: '@andy-toolforge'
      - run: npm ci
      - name: Publish changed packages
        run: |
          for pkg in packages/*/; do
            name=$(node -p "require('./$pkg/package.json').name")
            version=$(node -p "require('./$pkg/package.json').version")
            # Check if this version exists on registry
            if ! npm view "$name@$version" version 2>/dev/null; then
              npm publish -w "$name"
            fi
          done
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Note:** `GITHUB_TOKEN` tự động có sẵn trong GitHub Actions, không cần tạo PAT riêng.

## 5. Install từ client project

Sau khi publish, client project cần:

```bash
# Tạo .npmrc trong client project
echo "@andy-toolforge:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=${GH_TOKEN}" >> .npmrc

# Install
npm install @andy-toolforge/core @andy-toolforge/footage-generation
```

## 6. Version management

- Dùng [semver](https://semver.org/)
- Version bump thủ công trong `package.json` của từng package
- Pre-release: `1.0.0-alpha.1`, `1.0.0-beta.1`

## 7. Troubleshooting

### 401 Unauthorized

```bash
# Kiểm tra token
npm ping --registry=https://npm.pkg.github.com
```

### 403 Forbidden

Token thiếu scope `write:packages`. Tạo lại token với đúng scope.

### Package name conflict

GitHub Packages dùng scope theo org/user. Đảm bảo `@andy-toolforge` scope
đã được tạo trong GitHub org.
