import type { DB } from '#lib/server/db/index.ts';
import type { SessionUser } from '#lib/server/auth.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		interface Locals {
			db: DB;
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

declare global {
	namespace Cloudflare {
		interface Env {
			/** Google OAuth client (wrangler.jsonc vars; .dev.vars locally). */
			GOOGLE_CLIENT_ID: string;
			/** Worker secret: `wrangler secret put GOOGLE_CLIENT_SECRET`. */
			GOOGLE_CLIENT_SECRET: string;
			/** Stash's Reddit app (Worker secrets), for subreddit feeds through the API. */
			REDDIT_CLIENT_ID?: string;
			REDDIT_CLIENT_SECRET?: string;
			/** Authenticates the cron's call to /sync. */
			CRON_SECRET?: string;
			/** Web Push (push.ts): the public key (wrangler.jsonc vars) and private scalar (Worker secret). */
			VAPID_PUBLIC_KEY?: string;
			VAPID_PRIVATE_KEY?: string;
			/** e.g. https://stash.app.haddow.me (used by the cron). */
			APP_ORIGIN?: string;
		}
	}
}

export {};
