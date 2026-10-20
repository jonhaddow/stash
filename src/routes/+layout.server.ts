import { unreadCount } from '#lib/server/feeds.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:unread');
	if (!locals.user) return { user: null, unread: 0 };
	return {
		user: { name: locals.user.name, email: locals.user.email },
		unread: await unreadCount(locals.db)
	};
};
