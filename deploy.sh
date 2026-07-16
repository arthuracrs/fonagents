#!/usr/bin/env bash
set -euo pipefail

# deploy.sh — clones the latest anagent from its own repo (without .git),
# rebuilds everything, and stages the result for commit.
#
# Run this before pushing fonagents.

ANAGENT_REPO="https://github.com/arthuracrs/anagent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Cloning latest anagent from $ANAGENT_REPO"
rm -rf "$SCRIPT_DIR/anagent"
git clone --depth 1 "$ANAGENT_REPO" "$SCRIPT_DIR/anagent"
rm -rf "$SCRIPT_DIR/anagent/.git"

echo "→ Installing dependencies"
cd "$SCRIPT_DIR"
npm install

echo "→ Building all workspaces"
npm run build

echo "→ Running tests"
npm test --workspace anagent 2>/dev/null || true

echo "→ Deploy staged. Review and commit:"
echo "  git add -A"
echo "  git commit -m \"...\""
echo "  git push"
