import { fail } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { sourceOf } from '#lib/feed-url.ts';
import { addFeed, listFeeds } from '#lib/server/feeds.ts';
import { feedFromForm } from '#lib/server/feed-form.ts';
import { workersFetch } from '#lib/server/http.ts';
import { searchFeeds } from '#lib/server/search.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const feeds = await listFeeds(locals.db);
	const groups = (['Reddit', 'YouTube', 'Other'] as const)
		.map((name) => ({ name, feeds: feeds.filter((f) => sourceOf(f.url, f.siteUrl) === name) }))
		.filter((g) => g.feeds.length);
	return { groups, count: feeds.length };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const form = await request.formData();
		const typed = String(form.get('url') ?? '');
		const url = feedFromForm(form);
		if (!url) return fail(400, { error: 'That doesn’t look like a link', url: typed });
		try {
			const feed = await addFeed(locals.db, url, {
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
