# Stash

A read-it-later list and a feed reader in one. Save links from the iOS share sheet; read RSS, YouTube and Reddit feeds in folders; each feed has a sync log. Links open the original page.

Stack: SvelteKit 3 (Svelte 5) on Cloudflare Workers, Drizzle ORM on Cloudflare D1 (SQLite, EU), Vitest and Playwright. Set up like the plants app.

## Installing on a phone

Open https://stash.app.haddow.me in Safari, sign in, then Share → Add to Home Screen. For the share sheet, make a key in Settings → Share sheet and follow the steps there to build the "Save to Stash" Shortcut.

## Running locally

```sh
npm install
npm run db:migrate:local
npx wrangler d1 execute stash --local --command "INSERT INTO user (email, name) VALUES ('you@example.com', 'You')"
cp .dev.vars.example .dev.vars
npm run dev    # the login page has a dev-only "Sign in as" button
```

## Sign-in

Google OAuth, sharing budget's client, through the shared redirect `https://auth.app.haddow.me/callback` (`~/code/auth`). Only emails in the `user` table can sign in.

## Your data

Everything is in the D1 database `stash`: `npx wrangler d1 export stash --remote --output stash.sql`.

## Configuration

Vars in `wrangler.jsonc` (`APP_ORIGIN`, `GOOGLE_CLIENT_ID`). Secrets (`wrangler secret put`): `GOOGLE_CLIENT_SECRET`, `CRON_SECRET` (any long random string; authenticates the cron's call to `/sync`).

## Deploying

As plants: pushing to `main` deploys through Cloudflare Workers Builds, whose deploy command `npm run deploy:ci` applies migrations first.
