#!/usr/bin/env bash
# A fresh local database for the end-to-end tests, in .wrangler/e2e (the
# developer's own local data in .wrangler/state is left alone).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .wrangler/e2e
npx wrangler d1 migrations apply stash --local --persist-to .wrangler/e2e > /dev/null
npx wrangler d1 execute stash --local --persist-to .wrangler/e2e --file=e2e/fixtures.sql > /dev/null
