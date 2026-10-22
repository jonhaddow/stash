import { error } from '@sveltejs/kit';
import { setPosition } from '#lib/server/positions.ts';
import type { RequestHandler } from './$types';

/** The player saving where a video's got to: JSON `{ video, seconds }`, `seconds: null` once it's finished. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => ({}))) as { video?: unknown; seconds?: unknown };
	const { video, seconds } = body;
	if (typeof video !== 'string' || !/^[\w-]{1,32}$/.test(video)) error(400, 'Unknown video');
	if (seconds !== null && (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)) error(400, 'Bad time');
	await setPosition(locals.db, video, seconds);
	return new Response(null, { status: 204 });
};
