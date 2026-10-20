#!/usr/bin/env bash
# Waits until the live app is running a commit (default: origin/main), up to 10 minutes.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
want=$(git rev-parse "${1:-origin/main}")
for _ in $(seq 120); do
	live=$(curl -s https://stash.app.haddow.me/_app/version.json | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)
	[ "$live" = "$want" ] && echo "live: ${want:0:7}" && exit 0
	sleep 5
done
echo "not live after 10 minutes (live: ${live:-unknown}, want: ${want:0:7})" >&2
exit 1
