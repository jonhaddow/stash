import { fail } from '@sveltejs/kit';
import { kindParam } from '#lib/kind.ts';
import {
	PAGE,
	listFolders,
	listItems,
	markAllRead,
	unreadByFolder,
	type ItemFilter
} from '#lib/server/feeds.ts';
import { saveLink, setArchived } from '#lib/server/saved.ts';
import type { Actions, PageServerLoad } from './$types';

const id = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

function filterFrom(params: URLSearchParams): ItemFilter {
	return { folderId: id(params.get('folder')), kind: kindParam(params) };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const filter = filterFrom(url.searchParams);
	// Unread ones by default; ?all=1 shows read ones too.
	const unreadOnly = url.searchParams.get('all') !== '1';
	const before = url.searchParams.get('before');
	const [folders, counts, items] = await Promise.all([
		listFolders(locals.db),
		unreadByFolder(locals.db),
		listItems(locals.db, { ...filter, unreadOnly, before })
	]);
	const unread = new Map(counts.map((c) => [c.folderId, c.n]));
	return {
		...filter,
		unreadOnly,
		paged: !!before,
		folders: folders.map((f) => ({ ...f, unread: unread.get(f.id) ?? 0 })),
		totalUnread: counts.reduce((sum, c) => sum + c.n, 0),
		items,
		more: items.length === PAGE ? items.at(-1)!.publishedAt : null,
		/** "Mark all read" stops here, so entries that arrive meanwhile stay unread. */
		loadedAt: new Date().toISOString()
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const form = await request.formData();
		await saveLink(locals.db, String(form.get('url')), String(form.get('title')));
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
		await markAllRead(locals.db, filterFrom(url.searchParams), upTo);
		return { readAll: true };
	}
};
