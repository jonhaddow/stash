// Swipe actions on feed entries, for every page that lists them (Feeds, and a feed's own page).
import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { getItem, setRead } from './feeds.ts';
import { saveLink, setArchived } from './saved.ts';
import type { DB } from './db/index.ts';
import type { Action } from '@sveltejs/kit';

async function formItem(db: DB, form: FormData) {
	const it = await getItem(db, Number(form.get('id')));
	if (!it) error(404);
	return it;
}

export const itemActions = {
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
} satisfies Record<string, Action>;
