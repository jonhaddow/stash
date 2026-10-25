# Stash

Jon's read-it-later app and feed reader, replacing Readkit (with Instapaper and Inoreader). A PWA at https://stash.app.haddow.me, for one person. Two tabs: **Feeds** (the home page, `/`) and **Later** (`/later`). Later: saved links; swipe right sends one to a hidden archive. Feeds: one list of RSS/Atom entries, unread ones by default; feeds are grouped as Reddit, YouTube and Other on the manage page; read when opened or swiped right, and deleted 30 days later, with entries published over 30 days ago never stored; swipe left copies one to Later. Links open the original page (YouTube videos play in an embedded player); there's no article extraction. A cron polls a few feeds every 5 minutes, and each feed has a sync log. Links come in from the iOS share sheet through a Shortcut that posts to `/api/save` with a token.

## Worth knowing

- Names in the code: a link in Later is a `saved` row (archived ones have `archivedAt`); a feed entry is an `item`.
- Feeds are parsed with regexes (`parse.ts`), not an XML library, to stay inside the Workers CPU limit.
- Subreddit `.rss` links go through Reddit's signed-in API (`reddit.ts`; secrets from 1Password's "Reddit API") and come back as Atom.
- The add box (Settings → Feeds) searches YouTube (`YOUTUBE_API_KEY`) and Feedly by name; Reddit options and YouTube Shorts are kept in the feed URL (`feed-url.ts`).
- After each sync, a push sends the unread count for the app icon's badge.
- `/api/save` is the iOS Shortcut: `Authorization: Bearer <token>`, made in Settings, only its hash kept.
- `/api/save` takes JSON only: SvelteKit's CSRF check refuses form and plain-text posts from outside the site.
- Server code that fetches takes a `fetcher` argument, so tests pass a fake one (`feeds.spec.ts`).

## Review focus

One person uses it. Workers CPU in the cron's feed parsing, feeds that differ from the parser's assumptions. Public routes: only `/login`, `/auth/*`, `/sync` and `/api/save`.
