// Copied over SvelteKit's generated worker after each build (scripts/add-cron.ts),
// which keeps the generated one as _sveltekit_worker.js. Adds the cron that
// polls feeds, a few each run.
import app from './_sveltekit_worker.js';

export default {
	fetch: app.fetch,

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
