# Stash

A read-it-later list and a feed reader in one, built for one person as a phone web app.

- **Later:** links saved from the iOS share sheet. Swipe right to archive.
- **Feeds:** RSS, Atom, YouTube and Reddit feeds in one list; the manage page groups them as Reddit, YouTube and Other. Swipe right to mark read, left to save to Later. Each feed has a sync log.
- Links open the original page (YouTube plays in an embedded player). There's no article extraction.
- A push notification keeps the app icon's badge at the unread count.

Stack: SvelteKit (Svelte 5) on Cloudflare Workers, Drizzle ORM on Cloudflare D1, Vitest and Playwright.

## Running locally

```sh
npm install
npm run db:migrate:local
npx wrangler d1 execute stash --local --command "INSERT INTO user (email, name) VALUES ('you@example.com', 'You')"
cp .dev.vars.example .dev.vars
npm run dev    # the login page has a dev-only "Sign in as" button
```

Tests: `npm test` (unit), `npm run test:e2e` (Playwright), `npm run check` (types), `npm run lint`.

## Installing on a phone

Open the app in Safari, sign in, then Share → Add to Home Screen. To save from the share sheet, make a key in Settings → Share sheet and follow the steps there to build the "Save to Stash" Shortcut.

## Sign-in

Google OAuth. Only emails in the `user` table can sign in.

## Configuration

Vars in `wrangler.jsonc`: `APP_ORIGIN`, `GOOGLE_CLIENT_ID`, `VAPID_PUBLIC_KEY`.

Secrets (`wrangler secret put`):

- `GOOGLE_CLIENT_SECRET`
- `CRON_SECRET`: any long random string; authenticates the cron's call to `/sync`.
- `VAPID_PRIVATE_KEY`: for push notifications.
- `YOUTUBE_API_KEY`: optional, for searching YouTube channels when adding a feed.
- `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`: optional, a Reddit app (reddit.com/prefs/apps) for subreddit feeds. Without them it falls back to Reddit's public `.rss`, which mostly refuses requests from Cloudflare.

## Deploying

Pushing to `main` deploys through Cloudflare Workers Builds, whose deploy command `npm run deploy:ci` applies D1 migrations first. Back up the data with `npx wrangler d1 export stash --remote --output stash.sql`.
