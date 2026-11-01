import { kindParam, orderOf } from '#lib/kind.ts';
import { PAGE, hasFeeds, listItems } from '#lib/server/feeds.ts';
import { itemActions } from '#lib/server/item-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const kind = kindParam(url.searchParams);
	// Unread ones by default; ?all=1 shows read ones too.
	const unreadOnly = url.searchParams.get('all') !== '1';
	const order = orderOf(cookies.get('order-feeds'));
	const from = url.searchParams.get('from');
	const [anyFeeds, items] = await Promise.all([
		hasFeeds(locals.db),
		listItems(locals.db, { kind, unreadOnly, order, from })
	]);
	return {
		kind,
		unreadOnly,
		order,
		paged: !!from,
		hasFeeds: anyFeeds,
		items,
		more: items.length === PAGE ? items.at(-1)!.publishedAt : null
	};
};

export const actions: Actions = itemActions;
