#!/usr/bin/env bash
# A worktree for a branch in /tmp/stash-<branch>, with node_modules and .dev.vars
# from the main checkout (wherever this is run from).
set -euo pipefail
cd "$(dirname "$0")/.."
main=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
dir=/tmp/stash-$1
git worktree add -q -b "$1" "$dir" "${2:-main}"
cp "$main/.dev.vars" "$dir/" 2>/dev/null || true
# Each package is linked, except $app: svelte-kit sync writes that with paths
# relative to itself, so the worktree needs its own. Dot entries (build caches)
# are left out too, bar .bin.
mkdir "$dir/node_modules"
for entry in "$main"/node_modules/* "$main"/node_modules/.bin "$main"/node_modules/.package-lock.json; do
	[[ $entry == */\$app ]] && continue
	ln -s "$entry" "$dir/node_modules/"
done
(cd "$dir" && npm run -s prepare >/dev/null)
echo "$dir"
