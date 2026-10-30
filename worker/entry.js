// Copied over SvelteKit's generated worker after each build (scripts/add-cron.ts),
// which keeps the generated one as _sveltekit_worker.js. Adds the cron that
// polls feeds, a few each run.
// Also reloads pages left over from an earlier build.
import app from './_sveltekit_worker.js';

/**
 * Sent in place of an earlier build's entry scripts, which each deploy deletes. iOS reopens the
 * home-screen app from a page it saved, styled by deleted CSS; only that page's
 * script requests reach us, so they load it afresh (at most every 10s, so no loop).
 */
const RELOAD_STALE_PAGE = `if (Date.now() - (sessionStorage.staleReload || 0) > 10000) {
	sessionStorage.staleReload = Date.now();
	location.reload();
}`;

export default {
	/** @param {Request} request @param {unknown} env @param {unknown} ctx */
	async fetch(request, env, ctx) {
		// This build's files are served before the Worker runs, so this is an old build's.
		// Only its entry scripts: a page that's running has those, and SvelteKit itself
		// loads the next page afresh when one of its later chunks is gone.
		if (/^\/_app\/immutable\/entry\/.*\.js$/.test(new URL(request.url).pathname))
			return new Response(RELOAD_STALE_PAGE, {
				headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }
			});
		return app.fetch(request, env, ctx);
	},

	/** @param {unknown} _controller @param {Record<string, string | undefined>} env @param {{ waitUntil(p: Promise<unknown>): void }} ctx */
	async scheduled(_controller, env, ctx) {
		if (!env.APP_ORIGIN || !env.CRON_SECRET) return;
		const request = new Request(`${env.APP_ORIGIN}/sync`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-cron-secret': env.CRON_SECRET }
		});
		ctx.waitUntil(
			app
				.fetch(request, env, ctx)
				.then(async (res) => console.log('Sync', res.status, await res.text()))
		);
	}
};
