import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { kindOf, type Kind } from '../kind.ts';
import { saved } from './db/schema.ts';
import type { DB } from './db/index.ts';
import { get, readText, workersFetch, type Fetch } from './http.ts';
import { pageTitle } from './parse.ts';

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

/** A page's title from its <head>, or null if it can't be had quickly. */
export async function fetchTitle(fetcher: Fetch, url: string) {
	try {
		const res = await get(fetcher, url, { accept: 'text/html' });
		if (!res.ok) return null;
		// The <head> comes first; YouTube's pages are a few MB in all.
		return pageTitle(await readText(res, 300_000));
	} catch {
		return null;
	}
}

/**
 * Saves a link to Later, fetching its title if none is given. Saving one that's
 * already there (or archived) brings it back to the top.
 */
export async function saveLink(
	db: DB,
	url: string,
	title?: string | null,
	{ now = new Date(), fetcher = workersFetch }: { now?: Date; fetcher?: Fetch } = {}
) {
	const name = title?.trim() || (await fetchTitle(fetcher, url)) || new URL(url).hostname;
	const addedAt = now.toISOString();
	const [row] = await db
		.insert(saved)
		.values({ url, title: name, kind: kindOf(url), addedAt })
		.onConflictDoUpdate({ target: saved.url, set: { addedAt, archivedAt: null } })
		.returning();
	return row;
}

/** Later (or the archive), newest first. */
export function listSaved(
	db: DB,
	{ kind, archived = false }: { kind?: Kind | null; archived?: boolean }
) {
	return db
		.select()
		.from(saved)
		.where(
			and(
				archived ? isNotNull(saved.archivedAt) : isNull(saved.archivedAt),
				kind ? eq(saved.kind, kind) : undefined
			)
		)
		.orderBy(archived ? desc(saved.archivedAt) : desc(saved.addedAt))
		.limit(archived ? 200 : 500);
}

export async function laterCount(db: DB) {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(saved)
		.where(isNull(saved.archivedAt));
	return row.n;
}

/** Done: to the archive. `archivedAt` null puts it back in Later. */
export async function setArchived(db: DB, id: number, archivedAt: string | null) {
	await db.update(saved).set({ archivedAt }).where(eq(saved.id, id));
}
