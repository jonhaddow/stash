import { env } from 'cloudflare:workers';
import { fail } from '@sveltejs/kit';
import { kindParam, orderOf } from '#lib/kind.ts';
import { cleanUrl, listSaved, saveLink, setArchived } from '#lib/server/saved.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const kind = kindParam(url.searchParams);
	const order = orderOf(cookies.get('order-later'));
	return { kind, order, links: await listSaved(locals.db, { kind, order }) };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const raw = (await request.formData()).get('url');
		const url = cleanUrl(raw);
		if (!url) return fail(400, { error: 'That doesn’t look like a link', url: String(raw ?? '') });
		await saveLink(locals.db, url, {}, { youtubeKey: env.YOUTUBE_API_KEY });
		return { added: true };
	},
	archive: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		await setArchived(locals.db, id, new Date().toISOString());
		return { archived: { id, title: String(form.get('title') ?? '') } };
	},
	undo: async ({ request, locals }) => {
		await setArchived(locals.db, Number((await request.formData()).get('id')), null);
		return { undone: true };
	}
};
