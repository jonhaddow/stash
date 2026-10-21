#!/usr/bin/env bash
# Waits until the live app is running a commit (default: origin/main), up to 10 minutes.
# If it isn't live after a minute and Cloudflare hasn't started a build of it,
# starts one (scripts/start-build.ts): Cloudflare sometimes misses a merge.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
want=$(git rev-parse "${1:-origin/main}")
for i in $(seq 120); do
	live=$(curl -s https://stash.app.haddow.me/_app/version.json | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)
	[ "$live" = "$want" ] && echo "live: ${want:0:7}" && exit 0
	if [ "$i" = 12 ]; then
		CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-op://Claude/Cloudflare/credential} \
			op-claude run -- node scripts/start-build.ts "$want" || true
	fi
	sleep 5
done
echo "not live after 10 minutes (live: ${live:-unknown}, want: ${want:0:7})" >&2
exit 1
