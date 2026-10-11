#!/usr/bin/env bash
# Point the old GitHub Pages URL at Firebase Hosting.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_URL="${STREAMLY_LIVE_URL:-https://watchstreamly.web.app/}"
JSON_URL="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$LIVE_URL")"

TMP="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

git fetch origin gh-pages
git worktree add --force "$TMP" origin/gh-pages

find "$TMP" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

cat > "$TMP/index.html" <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=${LIVE_URL}" />
    <link rel="canonical" href="${LIVE_URL}" />
    <title>Streamly</title>
    <script>
      location.replace(${JSON_URL} + location.search + location.hash)
    </script>
  </head>
  <body>
    <p><a href="${LIVE_URL}">Continue to Streamly</a></p>
  </body>
</html>
EOF
cp "$TMP/index.html" "$TMP/404.html"
touch "$TMP/.nojekyll"

cd "$TMP"
git checkout -B gh-pages
git add -A
if git diff --cached --quiet; then
  echo "No changes to deploy."
  exit 0
fi

git commit -m "Redirect GitHub Pages to Firebase Hosting"
git push -u origin HEAD:gh-pages
echo "Published GitHub Pages redirect to ${LIVE_URL}"
