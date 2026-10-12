#!/usr/bin/env bash
# Build Streamly and publish Firebase Hosting only.
# The Spark plan can deploy Hosting. Cloud Functions need Blaze, which this
# project is not using. Watch links ship inside public/watch-links.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

if [[ ! -f dist/index.html ]]; then
  echo "Build failed: dist/index.html not found" >&2
  exit 1
fi

if [[ ! -f dist/watch-links.json ]]; then
  echo "Build failed: dist/watch-links.json not found. Run npm run watch-links." >&2
  exit 1
fi

npx --yes firebase-tools deploy --only hosting --project streamly-167bd --non-interactive
echo "Published dist/ to Firebase Hosting."
