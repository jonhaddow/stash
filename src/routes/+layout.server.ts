import { unreadCount } from '#lib/server/feeds.ts';
import { badgeShown } from '#lib/server/push.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:unread');
	if (!locals.user) return { user: null, unread: 0 };
	const unread = await unreadCount(locals.db);
	// The page puts this count on the app icon.
	await badgeShown(locals.db, unread);
	return { user: { name: locals.user.name, email: locals.user.email }, unread };
};
