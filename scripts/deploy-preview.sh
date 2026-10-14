#!/usr/bin/env bash
# Build Streamly and publish it to the private "test" preview channel.
# The live site (watchstreamly.web.app) is not touched.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

if [[ ! -f dist/index.html ]]; then
  echo "Build failed: dist/index.html not found" >&2
  exit 1
fi

npx --yes firebase-tools hosting:channel:deploy test --expires 30d --project streamly-167bd --non-interactive
echo "Published to the test preview channel. Live site unchanged."
