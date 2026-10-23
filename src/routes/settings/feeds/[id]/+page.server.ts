import { error, fail, redirect } from '@sveltejs/kit';
import { deleteFeed, feedLog, getFeed, syncFeed, updateFeed } from '#lib/server/feeds.ts';
import { urlWithOptions } from '#lib/server/feed-form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const feed = await getFeed(locals.db, Number(params.id));
	if (!feed) error(404, 'No such feed');
	return { feed, log: await feedLog(locals.db, feed.id) };
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'It needs a name' });
		const feed = await getFeed(locals.db, Number(params.id));
		if (!feed) error(404, 'No such feed');
		try {
			await updateFeed(locals.db, feed.id, {
				title,
				url: urlWithOptions(feed.url, form)
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Couldn’t save that' });
		}
		redirect(303, '/settings/feeds');
	},
	fetch: async ({ locals, params }) => {
		const feed = await getFeed(locals.db, Number(params.id));
		if (!feed) error(404, 'No such feed');
		return { fetched: await syncFeed(locals.db, feed) };
	},
	delete: async ({ locals, params }) => {
		await deleteFeed(locals.db, Number(params.id));
		redirect(303, '/settings/feeds');
	}
};
