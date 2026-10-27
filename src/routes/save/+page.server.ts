import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { cleanUrl, saveLink } from '#lib/server/saved.ts';
import type { PageServerLoad } from './$types';

/**
 * The bookmarklet in Settings: `/save?url=…` saves the link to Later. A GET,
 * so any site could send a signed-in browser here; the worst it can do is add
 * a link.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const link = cleanUrl(url.searchParams.get('url'));
	if (!link) error(400, 'That doesn’t look like a link');
	const row = await saveLink(locals.db, link, {}, { youtubeKey: env.YOUTUBE_API_KEY });
	return { title: row.title, url: link };
};
