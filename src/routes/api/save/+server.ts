import { error, text } from '@sveltejs/kit';
import { userForApiToken } from '#lib/server/auth.ts';
import { cleanUrl, saveLink } from '#lib/server/saved.ts';
import type { RequestHandler } from './$types';

/**
 * The iOS Shortcut on the share sheet: POST JSON `{ "url": "…" }` (and an
 * optional `title`) with `Authorization: Bearer <token>` from Settings. JSON
 * only: SvelteKit's CSRF check refuses form and plain-text posts from outside.
 * Answers with the saved title, which the Shortcut shows.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
	if (!token || !(await userForApiToken(locals.db, token))) error(401, 'Unknown token');

	const body = (await request.json().catch(() => ({}))) as { url?: unknown; title?: unknown };
	const url = cleanUrl(body.url);
	if (!url) error(400, 'That doesn’t look like a link');
	const row = await saveLink(locals.db, url, {
		title: typeof body.title === 'string' ? body.title : null
	});
	return text(`Saved: ${row.title}`, { status: 201 });
};
