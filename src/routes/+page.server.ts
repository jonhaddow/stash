import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { kindParam, orderOf } from '#lib/kind.ts';
import { PAGE, getItem, hasFeeds, listItems, setRead } from '#lib/server/feeds.ts';
import { saveLink, setArchived } from '#lib/server/saved.ts';
import type { DB } from '#lib/server/db/index.ts';
import type { Actions, PageServerLoad } from './$types';

async function formItem(db: DB, form: FormData) {
	const it = await getItem(db, Number(form.get('id')));
	if (!it) error(404);
	return it;
}

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

export const actions: Actions = {
	// Swipe left. Saving an entry marks it read too; the answer is for the Undo bar.
	save: async ({ request, locals }) => {
		const it = await formItem(locals.db, await request.formData());
		const row = await saveLink(
			locals.db,
			it.url,
			{ title: it.title, image: it.imageUrl },
			{ youtubeKey: env.YOUTUBE_API_KEY }
		);
		await setRead(locals.db, it.id, true);
		return { saved: { id: it.id, title: it.title, savedId: row.id } };
	},
	/** Back to unread, and out of Later. */
	undo: async ({ request, locals }) => {
		const form = await request.formData();
		await setRead(locals.db, Number(form.get('id')), false);
		const savedId = Number(form.get('savedId'));
		if (savedId) await setArchived(locals.db, savedId, new Date().toISOString());
		return { undone: true };
	},
	unsave: async ({ request, locals }) => {
		const form = await request.formData();
		await setArchived(locals.db, Number(form.get('savedId')), new Date().toISOString());
		return { unsaved: true };
	}
};
