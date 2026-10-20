#!/usr/bin/env bash
# Screenshots a page of the local app, signed in as the e2e user, on the e2e database.
# Usage: scripts/shot.sh /transactions [out.png] [shot flags: --desktop --full --el <css>]
# Starts the e2e dev server on port 5183 if it isn't running (stop: scripts/shot.sh --stop).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=5183
if [ "${1:-}" = "--stop" ]; then pkill -f "vite dev --port $PORT" || true; exit 0; fi
if ! curl -s -o /dev/null "http://localhost:$PORT/login"; then
	./e2e/reset-db.sh
	E2E_DB=.wrangler/e2e/v3 setsid npx vite dev --port $PORT --strictPort > /tmp/stash-shot-dev.log 2>&1 &
	for _ in $(seq 60); do curl -s -o /dev/null "http://localhost:$PORT/login" && break; sleep 1; done
	rm -f e2e/.auth/user.json
fi
[ -f e2e/.auth/user.json ] || E2E_REUSE=1 npx playwright test --project=setup > /dev/null
path=$1; shift
exec shot "http://localhost:$PORT$path" "$@" --state e2e/.auth/user.json
