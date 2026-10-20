import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { syncDue } from '#lib/server/feeds.ts';
import type { RequestHandler } from './$types';

/** The cron (worker/entry.js): fetches the feeds that are due. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!env.CRON_SECRET || request.headers.get('x-cron-secret') !== env.CRON_SECRET)
		error(403, 'Forbidden');
	const results = await syncDue(locals.db);
	return json(
		results.map((r) => `${r.feed}: ${r.status}${r.itemsAdded ? ` +${r.itemsAdded}` : ''}`)
	);
};
