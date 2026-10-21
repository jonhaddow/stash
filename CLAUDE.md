# Stash

Jon's read-it-later app and feed reader, replacing Readkit (with Instapaper and Inoreader). A PWA at https://stash.app.haddow.me, for one person. Two tabs: **Later** (saved links; swipe right sends one to a hidden archive) and **Feeds** (one list of RSS/Atom entries, unread ones by default; feeds are grouped in one-level folders in Settings; read when opened or swiped right, swipe left copies one to Later). Links open the original page (YouTube videos play in an embedded player); there's no article extraction. A cron polls a few feeds every 5 minutes, and each feed has a sync log. Links come in from the iOS share sheet through a Shortcut that posts to `/api/save` with a token. SvelteKit 3 (Svelte 5) on Cloudflare Workers, D1 via Drizzle. The same stack and setup as `~/code/plants` and `~/code/budget` (copy code patterns from there, not their look: stash has its own, see `app.css`).

## Where things are

- `src/lib/server/parse.ts`: RSS/Atom parsing with regexes (not an XML library, for CPU), feed discovery from a page, page titles; pure, unit tested
- `src/lib/server/feeds.ts`: finding and adding feeds, syncing (conditional requests, logs), folders, listing and marking entries read
- `src/lib/server/saved.ts`: saving links (title fetched from the page), Later and the archive
- `src/lib/server/http.ts`: fetching other sites (User-Agent, timeout, size cap)
- `src/lib/server/reddit.ts`: subreddit `.rss` requests go to Reddit's signed-in API (Jon's app, `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` secrets, from 1Password's "Reddit API") and come back as Atom
- `src/lib/server/push.ts`: Web Push (VAPID, RFC 8291 encryption with WebCrypto) sending the unread count after each sync, for the app icon's badge; the service worker shows it. `VAPID_PRIVATE_KEY` secret, public key in `wrangler.jsonc`
- `src/lib/kind.ts`: article or video, by the link's site; YouTube video IDs for the player (`components/Player.svelte`)
- `src/routes/sync`: called by the cron (`worker/entry.js`) with `CRON_SECRET`
- `src/routes/api/save`: the iOS Shortcut, `Authorization: Bearer <token>` (Settings makes the token; only its hash is kept)
- Routes: `/` Later, `/feeds`, `/settings`, `/settings/feeds` (+ `[id]` with its sync log), `/settings/push` (saves the device's push subscription), `/archive`
- Schema: `src/lib/server/db/schema.ts`. Product choices: `docs/decisions.md`; what's next: `docs/roadmap.md`.

## Commands

Same as plants: `npm test`, `npm run test:e2e`, `npm run check`, `npm run lint`, `scripts/shot.sh <path>`, `scripts/worktree.sh <branch>`. Wrangler: `CLOUDFLARE_API_TOKEN='op://Claude/Cloudflare/credential' op-claude run -- npx wrangler ...`

## Workflow

- Work in a worktree (`scripts/worktree.sh <branch>`), never in `~/code/stash` itself.
- `main` is what's live, so never push to it directly. Every change goes through a PR:
  1. Branch, commit, push, `gh pr create` (gh needs the PAT: `GH_TOKEN='op://Claude/GitHub Personal Access Token/token' op-claude run -- gh ...`).
  2. Straight away, run the `bug-hunter` and `simplifier` agents in parallel on the branch (repo path, base `main`). Apply real findings; skip any you disagree with and say why. Docs-only PRs skip this step.
  3. Push the fixes, then `scripts/pr-wait.sh` (with the PAT) for the Checks run (lint, types, unit, e2e).
  4. When green, send Jon the PR link, one line per finding (applied or skipped) and a screenshot if the UI changed (open it with Read).
  5. When Jon approves, merge (`gh pr merge --squash`); Cloudflare Workers Builds deploys `main` by itself, so then just `scripts/wait-deploy.sh`.
- Schema change: edit `schema.ts`, `npm run db:generate`, `npm run db:migrate:local`. The deploy applies migrations before the new code. Before merging, note a restore point (`wrangler d1 time-travel info stash`).
- Keep docs current; record product or architecture choices (including ideas turned down) in `docs/decisions.md`, and planned features in `docs/roadmap.md`.

## Review focus

A one-person app: simple beats defensive. Cutting code is a good outcome, and bugs only matter if Jon's likely to hit them. Watch for: Workers CPU (feed parsing in the cron) and D1 limits (queries per run, 100 bound values), feeds that differ from the parser's assumptions, sign-in checks on new routes (only `/login`, `/auth/*`, `/sync` and `/api/save` are public).

## Gotchas

budget's CLAUDE.md gotchas apply here too (SvelteKit 3 imports, Workers CPU limit, unbound `fetch`, D1 limits, `db.batch` tuples, strict CSP). Also:

- `scripts/shot.sh` and the e2e tests use `.wrangler/e2e`, a fresh database with the fixtures in `e2e/fixtures.sql`, on port 5183 (budget 5180, energy 5181, plants 5182).
- Client code can't import from `#lib/server`, even types: shared things live in `src/lib` (`kind.ts`, `time.ts`).
- `/api/save` takes JSON only: SvelteKit's CSRF check refuses form and plain-text posts that come from outside the site.
- Server code that fetches takes a `fetcher` argument, so tests pass a fake one (`feeds.spec.ts`).
