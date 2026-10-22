import { error } from '@sveltejs/kit';
import { setRead, unreadCount } from '#lib/server/feeds.ts';
import { badgeShown } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

/** Opening or swiping a feed entry marks it read (sent as the link opens, so it can't wait for a reply). */
export const POST: RequestHandler = ({ params, locals }) => mark(locals.db, params.id, true);

/** Swiping a read entry marks it unread again. */
export const DELETE: RequestHandler = ({ params, locals }) => mark(locals.db, params.id, false);

async function mark(db: App.Locals['db'], param: string, read: boolean) {
	const id = Number(param);
	if (!Number.isInteger(id)) error(404);
	await setRead(db, id, read);
	// The page has already changed the icon's badge to match.
	await badgeShown(db, await unreadCount(db));
	return new Response(null, { status: 204 });
}
