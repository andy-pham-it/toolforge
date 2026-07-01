#!/usr/bin/env bash
# =====================================
# verify-links.sh
# Kiểm tra npm links từ toolforge packages vào client project.
# Chạy từ thư mục client project (vd: generate-images-for-podcast).
#
# Usage:
#   bash scripts/verify-links.sh
#   # or after chmod +x:
#   ./scripts/verify-links.sh
# =====================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verifying toolforge package links..."
echo ""

TOOLFORGE_DIR="${TOOLFORGE_DIR:-$HOME/personal/toolforge}"
PKGS=("core" "footage-generation" "seo-generation" "book-writing" "pm-support" "ba-support" "coding-support")

ALL_OK=true

for PKG in "${PKGS[@]}"; do
    NAME="@toolforge/$PKG"
    EXPECTED_PATH="$TOOLFORGE_DIR/packages/$PKG"
    
    RESOLVED=$(node -e "
        try {
            const p = require.resolve('$NAME');
            console.log(p);
        } catch(e) {
            process.exit(1);
        }
    " 2>/dev/null || echo "")

    if [ -z "$RESOLVED" ]; then
        echo -e "${YELLOW}⚠️  $NAME — NOT LINKED${NC}"
        ALL_OK=false
    elif echo "$RESOLVED" | grep -q "$EXPECTED_PATH"; then
        echo -e "${GREEN}✅ $NAME → $RESOLVED${NC}"
    else
        echo -e "${YELLOW}⚠️  $NAME — resolved but NOT from toolforge: $RESOLVED${NC}"
        ALL_OK=false
    fi
done

echo ""

if [ "$ALL_OK" = false ]; then
    echo -e "${YELLOW}🔧 Fixing links...${NC}"
    (cd "$TOOLFORGE_DIR" && for p in packages/*; do (cd "$p" && npm link 2>/dev/null); done)
    echo -e "${GREEN}✅ Links re-registered. Run this script again to verify.${NC}"
else
    echo -e "${GREEN}✅ All toolforge packages are correctly linked.${NC}"
fi
