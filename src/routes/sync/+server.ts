import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { syncDue } from '#lib/server/feeds.ts';
import { pushUnread } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

/** The cron (worker/entry.js): fetches the feeds that are due, then updates the icon badges. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!env.CRON_SECRET || request.headers.get('x-cron-secret') !== env.CRON_SECRET)
		error(403, 'Forbidden');
	const results = await syncDue(locals.db);
	const pushed =
		env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.APP_ORIGIN
			? await pushUnread(locals.db, {
					publicKey: env.VAPID_PUBLIC_KEY,
					privateKey: env.VAPID_PRIVATE_KEY,
					subject: env.APP_ORIGIN
				})
			: [];
	return json([
		...results.map((r) => `${r.feed}: ${r.status}${r.itemsAdded ? ` +${r.itemsAdded}` : ''}`),
		...pushed
	]);
};
