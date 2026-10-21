import { unreadCount } from '#lib/server/feeds.ts';
import { toLook } from '#lib/looks.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('app:unread');
	const look = toLook(cookies.get('look'));
	if (!locals.user) return { user: null, unread: 0, look };
	return {
		user: { name: locals.user.name, email: locals.user.email },
		unread: await unreadCount(locals.db),
		look
	};
};
