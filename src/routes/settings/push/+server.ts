import { error } from '@sveltejs/kit';
import { subscribe } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

/** This device's push subscription (PushSubscription.toJSON()), from Settings. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { endpoint, keys } = (await request.json().catch(() => ({}))) as {
		endpoint?: unknown;
		keys?: { p256dh?: unknown; auth?: unknown };
	};
	const { p256dh, auth } = keys ?? {};
	if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) error(400, 'No endpoint');
	if (typeof p256dh !== 'string' || typeof auth !== 'string') error(400, 'No keys');
	await subscribe(locals.db, { endpoint, p256dh, auth });
	return new Response(null, { status: 204 });
};
