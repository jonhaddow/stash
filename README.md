# Stash

A read-it-later list and a feed reader in one, as a phone web app.

Save links from the iOS share sheet to read later, and follow RSS, Atom, YouTube and Reddit feeds in one list. Swipe to archive, mark read or save for later, and the app icon's badge shows the unread count.

## Tech stack

- [SvelteKit](https://svelte.dev) (Svelte 5) and TypeScript, as an installable PWA
- [Cloudflare Workers](https://workers.cloudflare.com), with [D1](https://developers.cloudflare.com/d1/) (SQLite) through [Drizzle ORM](https://orm.drizzle.team)
- Google sign-in ([Arctic](https://arcticjs.dev)) for an allowlist of users
- [Tailwind CSS](https://tailwindcss.com) and [shadcn-svelte](https://shadcn-svelte.com)
- YouTube Data API and Reddit API, with feeds synced by a cron trigger and web push for the badge
- [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev) for tests
- Deployed from `main` by Cloudflare Workers Builds

## Development

See [`docs/development.md`](docs/development.md) for running it locally, configuration and deploying.
