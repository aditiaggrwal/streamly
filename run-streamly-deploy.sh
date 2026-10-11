#!/bin/bash
set -euo pipefail
cd /Users/aditiaggrwal/Projects/streamly
export PATH="/Users/aditiaggrwal/.local/node/bin:$PATH"
npm ci
npm run deploy:firebase
npm run deploy:gh-pages
