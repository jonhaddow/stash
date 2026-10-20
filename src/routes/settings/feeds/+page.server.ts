import { fail } from '@sveltejs/kit';
import { addFeed, listFeeds, listFolders } from '#lib/server/feeds.ts';
import { folderFromForm } from '#lib/server/feed-form.ts';
import { cleanUrl } from '#lib/server/saved.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [folders, feeds] = await Promise.all([listFolders(locals.db), listFeeds(locals.db)]);
	// Grouped by folder, in folder order; feeds without one last.
	const groups = [...folders, { id: null, name: 'No folder' }]
		.map((f) => ({ ...f, feeds: feeds.filter((x) => x.folderId === f.id) }))
		.filter((g) => g.feeds.length);
	return { folders, groups, count: feeds.length };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await request.formData();
		const url = cleanUrl(form.get('url'));
		if (!url)
			return fail(400, { error: 'That doesn’t look like a link', url: String(form.get('url')) });
		try {
			const folderId = await folderFromForm(locals.db, form);
			const feed = await addFeed(locals.db, url, folderId);
			return { added: feed.title };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Couldn’t add that', url });
		}
	}
};
