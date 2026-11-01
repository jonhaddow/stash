import { fail } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { feedType, sourceOf } from '#lib/feed-url.ts';
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
		const type = feedType(form.get('type'));
		const url = feedFromForm(form);
		if (!url)
			return fail(400, {
				error: type === 'reddit' ? 'That isn’t a subreddit' : 'That doesn’t look like a link',
				url: typed,
				type
			});
		try {
			const feed = await addFeed(locals.db, url, {
				shorts: type === 'youtube' ? form.get('shorts') === 'on' : undefined
			});
			return { added: feed.title, type };
		} catch (e) {
			const error = e instanceof Error ? e.message : 'Couldn’t add that';
			return fail(400, { error, url: typed, type });
		}
	},
	search: async ({ request }) => {
		const form = await request.formData();
		const q = String(form.get('url') ?? '').trim();
		const type = feedType(form.get('type')) === 'youtube' ? 'youtube' : 'rss';
		if (!q) return fail(400, { error: 'Type a name to search for', url: q, type });
		try {
			const found = await searchFeeds(q.slice(0, 100), type, {
				youtubeKey: env.YOUTUBE_API_KEY,
				fetcher: workersFetch
			});
			return { found, url: q, type };
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Search failed', url: q, type });
		}
	}
};
