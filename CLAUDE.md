# Stash

Jon's read-it-later app and feed reader, replacing Readkit (with Instapaper and Inoreader). A PWA at https://stash.app.haddow.me, for one person. Two tabs: **Later** (saved links; swipe right sends one to a hidden archive) and **Feeds** (one list of RSS/Atom entries, unread ones by default; feeds are grouped in one-level folders in Settings; read when opened or swiped right, swipe left copies one to Later). Links open the original page (YouTube videos play in an embedded player); there's no article extraction. A cron polls a few feeds every 5 minutes, and each feed has a sync log. Links come in from the iOS share sheet through a Shortcut that posts to `/api/save` with a token.

Stack, workflow, commands and shared gotchas: the `app-stack` skill.

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

## Review focus

One person uses it. Workers CPU in the cron's feed parsing, feeds that differ from the parser's assumptions. Public routes: only `/login`, `/auth/*`, `/sync` and `/api/save`.

## Notes

- `/api/save` takes JSON only: SvelteKit's CSRF check refuses form and plain-text posts from outside the site.
- Server code that fetches takes a `fetcher` argument, so tests pass a fake one (`feeds.spec.ts`).
