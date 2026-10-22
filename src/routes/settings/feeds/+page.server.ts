import { fail } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { addFeed, listFeeds, listFolders } from '#lib/server/feeds.ts';
import { feedFromForm, folderFromForm } from '#lib/server/feed-form.ts';
import { workersFetch } from '#lib/server/http.ts';
import { searchFeeds } from '#lib/server/search.ts';
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
		const typed = String(form.get('url') ?? '');
		const url = feedFromForm(form);
		if (!url) return fail(400, { error: 'That doesn’t look like a link', url: typed });
		try {
			const folderId = await folderFromForm(locals.db, form);
			const feed = await addFeed(locals.db, url, folderId, {
				shorts: form.get('shorts') === 'on'
			});
			return { added: feed.title };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Couldn’t add that', url: typed });
		}
	},
	search: async ({ request }) => {
		const q = String((await request.formData()).get('url') ?? '').trim();
		if (!q) return fail(400, { error: 'Type a name to search for', url: q });
		try {
			const found = await searchFeeds(q.slice(0, 100), {
				youtubeKey: env.YOUTUBE_API_KEY,
				fetcher: workersFetch
			});
			return { found, url: q };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Search failed', url: q });
		}
	}
};
