#!/usr/bin/env bash
# Build Streamly and publish dist/ to the gh-pages branch (no GitHub Actions).
# Use this when Actions cannot run, or to ship a production TMDB build locally:
#   VITE_TMDB_API_KEY=... npm run deploy:gh-pages
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

if [[ ! -f dist/index.html ]]; then
  echo "Build failed: dist/index.html not found" >&2
  exit 1
fi

touch dist/.nojekyll

TMP="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

git fetch origin gh-pages
git worktree add --force "$TMP" origin/gh-pages

# Replace published site with fresh dist (keep .git via worktree)
find "$TMP" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a dist/. "$TMP/"

cd "$TMP"
git checkout -B gh-pages
git add -A
if git diff --cached --quiet; then
  echo "No changes to deploy."
  exit 0
fi

git commit -m "Deploy Streamly $(date -u +%Y-%m-%dT%H:%MZ)"
git push -u origin HEAD:gh-pages
echo "Published dist/ to origin/gh-pages."
