import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { kindOf, type Kind, type Order } from '../kind.ts';
import { saved } from './db/schema.ts';
import type { DB } from './db/index.ts';
import { get, readText, workersFetch, type Fetch } from './http.ts';
import { pageInfo } from './parse.ts';

/** A link someone typed or shared, as a full http(s) URL, or null. */
export function cleanUrl(raw: unknown) {
	if (typeof raw !== 'string') return null;
	// Shared text sometimes carries words around the link ("Look at this https://…").
	const found = /https?:\/\/\S+/i.exec(raw.trim())?.[0] ?? raw.trim();
	try {
		const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(found) ? found : `https://${found}`);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		if (!url.hostname.includes('.')) return null;
		url.hash = '';
		return url.href;
	} catch {
		return null;
	}
}

/** A page's title and image from its <head>, or nulls if they can't be had quickly. */
export async function fetchPage(fetcher: Fetch, url: string) {
	try {
		const res = await get(fetcher, url, { accept: 'text/html' });
		// The <head> comes first; YouTube's pages are a few MB in all.
		if (res.ok) return pageInfo(await readText(res, 300_000), url);
	} catch {
		// Saved without them.
	}
	return { title: null, image: null };
}

/**
 * Saves a link to Later, fetching its title and image from the page if no title
 * is given (a feed entry brings its own). Saving one that's already there (or
 * archived) brings it back to the top.
 */
export async function saveLink(
	db: DB,
	url: string,
	given: { title?: string | null; image?: string | null } = {},
	{ now = new Date(), fetcher = workersFetch }: { now?: Date; fetcher?: Fetch } = {}
) {
	const title = given.title?.trim();
	const page = title ? { title, image: given.image ?? null } : await fetchPage(fetcher, url);
	const addedAt = now.toISOString();
	const finalTitle = page.title || new URL(url).hostname;
	const [row] = await db
		.insert(saved)
		.values({
			url,
			title: finalTitle,
			kind: kindOf(url, finalTitle),
			imageUrl: page.image,
			addedAt
		})
		.onConflictDoUpdate({ target: saved.url, set: { addedAt, archivedAt: null } })
		.returning();
	return row;
}

/** Later (or the archive), newest first unless `order` is 'oldest'. */
export function listSaved(
	db: DB,
	{
		kind,
		archived = false,
		order = 'newest'
	}: { kind?: Kind | null; archived?: boolean; order?: Order }
) {
	const by = order === 'oldest' ? asc : desc;
	return db
		.select()
		.from(saved)
		.where(
			and(
				archived ? isNotNull(saved.archivedAt) : isNull(saved.archivedAt),
				kind ? eq(saved.kind, kind) : undefined
			)
		)
		.orderBy(archived ? by(saved.archivedAt) : by(saved.addedAt))
		.limit(archived ? 200 : 500);
}

export async function laterCount(db: DB) {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(saved)
		.where(isNull(saved.archivedAt));
	return row.n;
}

/** Archives a link. `archivedAt` null puts it back in Later. */
export async function setArchived(db: DB, id: number, archivedAt: string | null) {
	await db.update(saved).set({ archivedAt }).where(eq(saved.id, id));
}
