import { error } from '@sveltejs/kit';
import { setRead } from '#lib/server/feeds.ts';
import type { RequestHandler } from './$types';

/** Opening a feed entry marks it read (sent as the link opens, so it can't wait for a reply). */
export const POST: RequestHandler = async ({ params, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404);
	await setRead(locals.db, id, true);
	return new Response(null, { status: 204 });
};
