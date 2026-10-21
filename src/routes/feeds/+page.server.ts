import { error, fail } from '@sveltejs/kit';
import { kindParam } from '#lib/kind.ts';
import { PAGE, getItem, hasFeeds, listItems, markAllRead } from '#lib/server/feeds.ts';
import { saveLink, setArchived } from '#lib/server/saved.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const kind = kindParam(url.searchParams);
	// Unread ones by default; ?all=1 shows read ones too.
	const unreadOnly = url.searchParams.get('all') !== '1';
	const before = url.searchParams.get('before');
	const [anyFeeds, items] = await Promise.all([
		hasFeeds(locals.db),
		listItems(locals.db, { kind, unreadOnly, before })
	]);
	return {
		kind,
		unreadOnly,
		paged: !!before,
		hasFeeds: anyFeeds,
		items,
		more: items.length === PAGE ? items.at(-1)!.publishedAt : null,
		/** "Mark all read" stops here, so entries that arrive meanwhile stay unread. */
		loadedAt: new Date().toISOString()
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const it = await getItem(locals.db, Number((await request.formData()).get('id')));
		if (!it) error(404);
		await saveLink(locals.db, it.url, { title: it.title, image: it.imageUrl });
		return { saved: true };
	},
	unsave: async ({ request, locals }) => {
		const form = await request.formData();
		await setArchived(locals.db, Number(form.get('savedId')), new Date().toISOString());
		return { unsaved: true };
	},
	readAll: async ({ request, locals, url }) => {
		const upTo = String((await request.formData()).get('upTo'));
		if (Number.isNaN(Date.parse(upTo))) return fail(400);
		await markAllRead(locals.db, kindParam(url.searchParams), upTo);
		return { readAll: true };
	}
};
