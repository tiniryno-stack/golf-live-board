#!/usr/bin/env bash
# Publishes the current branch's app files to main under /preview/, so the work in progress can be
# tried on a phone at https://tiniryno-stack.github.io/golf-live-board/preview/ without touching the
# live app (main's own index.html, css/, js/ are left alone). Run: npm run preview
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SHA=$(git rev-parse --short HEAD)
WT=$(mktemp -d)
git fetch -q origin main
git worktree add -q "$WT" origin/main
rm -rf "$WT/preview"
mkdir -p "$WT/preview"
cp -r index.html sim.html icon-180.png css js "$WT/preview/"
cd "$WT"
git add -A preview
if git diff --cached --quiet; then echo "preview already up to date"; else
  git commit -q -m "Preview: $BRANCH @ $SHA (under /preview/, live app untouched)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git push -q origin HEAD:main
  echo "published $BRANCH @ $SHA → https://tiniryno-stack.github.io/golf-live-board/preview/ (live in ~1 min)"
fi
cd - >/dev/null
git worktree remove --force "$WT"
