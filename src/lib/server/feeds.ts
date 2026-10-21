import { and, asc, desc, eq, inArray, isNull, lt, lte, not, or, sql } from 'drizzle-orm';
import { kindOf, type Kind } from '../kind.ts';
import { feed, folder, item, saved, syncLog, type Feed } from './db/schema.ts';
import type { DB } from './db/index.ts';
import { get, readText, workersFetch, type Fetch } from './http.ts';
import { findFeedLink, looksLikeFeed, parseFeed, type ParsedFeed } from './parse.ts';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Each feed is fetched at most this often. */
export const FEED_EVERY_MS = 30 * MIN;
/** Feeds fetched per cron run (every 5 minutes); keeps each run inside the free plan's CPU. */
export const FEEDS_PER_RUN = 5;
/** A feed refused with 429 (too many requests; Reddit does this) waits this long before trying again. */
export const RATE_LIMITED_MS = 2 * 60 * MIN;
/** A feed added in the app starts with entries older than this read. */
const FRESH_MS = 7 * DAY;
const LOG_DAYS = 30;
/** Rows per insert: D1 allows 100 bound values per query, and an item has 7. */
const INSERT_CHUNK = 14;

// ---- Finding a feed ----

/** Subreddits have feeds at a known address, and Reddit's pages often refuse servers. */
function knownFeed(url: URL) {
	const sub = /^\/r\/([\w-]+)/.exec(url.pathname);
	if (/(^|\.)reddit\.com$/.test(url.hostname) && sub)
		return `https://www.reddit.com/r/${sub[1]}/.rss`;
	return null;
}

/** A feed from a feed URL or a page that links to one. Throws a readable message if none. */
export async function discoverFeed(
	input: string,
	fetcher: Fetch = workersFetch
): Promise<{ url: string; parsed: ParsedFeed }> {
	const url = knownFeed(new URL(input)) ?? input;
	const res = await get(fetcher, url);
	if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
	const body = await readText(res);
	if (looksLikeFeed(body)) return { url: res.url || url, parsed: parseFeed(body, url) };

	const link = findFeedLink(body, res.url || url);
	if (!link) throw new Error('No feed found on that page');
	const feedRes = await get(fetcher, link);
	if (!feedRes.ok) throw new Error(`The feed answered ${feedRes.status}`);
	return { url: link, parsed: parseFeed(await readText(feedRes), link) };
}

// ---- Folders ----

export const listFolders = (db: DB) =>
	db.select().from(folder).orderBy(asc(folder.sortOrder), asc(folder.name));

/** A folder by name, made if it's new. */
export async function folderNamed(db: DB, name: string) {
	const [row] = await db
		.insert(folder)
		.values({ name })
		.onConflictDoUpdate({ target: folder.name, set: { name } })
		.returning();
	return row.id;
}

// ---- Feeds ----

/** Adds a feed and stores its current entries. Throws a readable message if it can't. */
export async function addFeed(
	db: DB,
	input: string,
	folderId: number | null,
	{ now = new Date(), fetcher = workersFetch }: { now?: Date; fetcher?: Fetch } = {}
) {
	const started = Date.now();
	const { url, parsed } = await discoverFeed(input, fetcher);
	const [existing] = await db.select({ id: feed.id }).from(feed).where(eq(feed.url, url));
	if (existing) throw new Error('That feed is already here');
	const [row] = await db
		.insert(feed)
		.values({
			title: parsed.title,
			url,
			siteUrl: parsed.siteUrl,
			folderId,
			createdAt: now.toISOString()
		})
		.returning();
	const added = await storeItems(
		db,
		row.id,
		parsed,
		now,
		new Date(now.getTime() - FRESH_MS).toISOString()
	);
	await recordFetch(db, row.id, now, {
		status: 'ok',
		httpStatus: 200,
		itemsAdded: added,
		ms: Date.now() - started
	});
	return row;
}

export async function updateFeed(
	db: DB,
	id: number,
	values: { title: string; folderId: number | null }
) {
	await db.update(feed).set(values).where(eq(feed.id, id));
}

export async function deleteFeed(db: DB, id: number) {
	await db.delete(feed).where(eq(feed.id, id));
}

/** Every feed with its folder and unread count, for the manage page. */
export async function listFeeds(db: DB) {
	return db
		.select({
			id: feed.id,
			title: feed.title,
			url: feed.url,
			folderId: feed.folderId,
			lastFetchedAt: feed.lastFetchedAt,
			lastStatus: feed.lastStatus,
			lastError: feed.lastError,
			unread: sql<number>`(select count(*) from ${item} where ${item.feedId} = ${feed.id} and ${item.readAt} is null)`
		})
		.from(feed)
		.orderBy(sql`${feed.title} collate nocase`);
}

export async function getFeed(db: DB, id: number) {
	const [row] = await db.select().from(feed).where(eq(feed.id, id));
	return row ?? null;
}

export function feedLog(db: DB, feedId: number) {
	return db
		.select()
		.from(syncLog)
		.where(eq(syncLog.feedId, feedId))
		.orderBy(desc(syncLog.at))
		.limit(100);
}

// ---- Syncing ----

/** Adds entries not seen before; returns how many. Ones published before `readBefore` start read. */
async function storeItems(
	db: DB,
	feedId: number,
	parsed: ParsedFeed,
	now: Date,
	readBefore: string | null = null
) {
	const byGuid = new Map(parsed.items.map((i) => [i.guid, i]));
	const guids = [...byGuid.keys()];
	const seen = new Set<string>();
	for (let i = 0; i < guids.length; i += 90) {
		const rows = await db
			.select({ guid: item.guid })
			.from(item)
			.where(and(eq(item.feedId, feedId), inArray(item.guid, guids.slice(i, i + 90))));
		for (const r of rows) seen.add(r.guid);
	}
	const nowIso = now.toISOString();
	const fresh = [...byGuid.values()]
		.filter((i) => !seen.has(i.guid))
		.map((i) => {
			const publishedAt = i.publishedAt && i.publishedAt < nowIso ? i.publishedAt : nowIso;
			const old = readBefore !== null && publishedAt <= readBefore;
			return {
				feedId,
				guid: i.guid,
				url: i.url,
				title: i.title,
				kind: kindOf(i.url),
				publishedAt,
				readAt: old ? nowIso : null
			};
		});
	for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
		await db
			.insert(item)
			.values(fresh.slice(i, i + INSERT_CHUNK))
			.onConflictDoNothing();
	}
	return fresh.length;
}

type FetchResult = {
	status: 'ok' | 'not-modified' | 'error';
	httpStatus?: number | null;
	itemsAdded?: number;
	error?: string | null;
	ms: number;
};

async function recordFetch(
	db: DB,
	feedId: number,
	now: Date,
	r: FetchResult,
	cache?: { etag: string | null; lastModified: string | null }
) {
	const at = now.toISOString();
	await db.batch([
		db
			.update(feed)
			.set({
				lastFetchedAt: at,
				lastStatus: r.status,
				lastError: r.error ?? null,
				...(cache ?? {})
			})
			.where(eq(feed.id, feedId)),
		db.insert(syncLog).values({
			feedId,
			at,
			status: r.status,
			httpStatus: r.httpStatus ?? null,
			itemsAdded: r.itemsAdded ?? 0,
			error: r.error ?? null,
			ms: r.ms
		})
	]);
}

/** Fetches one feed (conditionally, so unchanged feeds are cheap) and logs how it went. */
export async function syncFeed(db: DB, f: Feed, now = new Date(), fetcher: Fetch = workersFetch) {
	const started = Date.now();
	const headers: Record<string, string> = {};
	if (f.etag) headers['if-none-match'] = f.etag;
	if (f.lastModified) headers['if-modified-since'] = f.lastModified;
	let result: FetchResult;
	let cache: { etag: string | null; lastModified: string | null } | undefined;
	try {
		const res = await get(fetcher, f.url, headers);
		if (res.status === 304) {
			result = { status: 'not-modified', httpStatus: 304, ms: Date.now() - started };
		} else if (!res.ok) {
			result = {
				status: 'error',
				httpStatus: res.status,
				error: `HTTP ${res.status}`,
				ms: Date.now() - started
			};
		} else {
			const parsed = parseFeed(await readText(res), f.url);
			// No entries yet (an imported feed, even if earlier fetches failed): what's
			// already in it starts read, so only new entries show as unread.
			const [any] = await db
				.select({ id: item.id })
				.from(item)
				.where(eq(item.feedId, f.id))
				.limit(1);
			const itemsAdded = await storeItems(db, f.id, parsed, now, any ? null : now.toISOString());
			cache = { etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
			result = { status: 'ok', httpStatus: res.status, itemsAdded, ms: Date.now() - started };
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		result = { status: 'error', error: message.slice(0, 500), ms: Date.now() - started };
	}
	await recordFetch(db, f.id, now, result, cache);
	return result;
}

/** The cron's job: the feeds fetched longest ago (if due), and tidying old logs. */
export async function syncDue(db: DB, now = new Date(), fetcher: Fetch = workersFetch) {
	const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
	const waiting = await db
		.select()
		.from(feed)
		.where(
			or(
				isNull(feed.lastFetchedAt),
				and(
					lte(feed.lastFetchedAt, ago(FEED_EVERY_MS)),
					or(
						isNull(feed.lastError),
						not(eq(feed.lastError, 'HTTP 429')),
						lte(feed.lastFetchedAt, ago(RATE_LIMITED_MS))
					)
				)
			)
		)
		.orderBy(sql`${feed.lastFetchedAt} is not null`, asc(feed.lastFetchedAt));
	// Reddit refuses several requests at once, so its feeds go one per run.
	let reddit = false;
	const due = waiting
		.filter((f) => {
			if (!isReddit(f.url)) return true;
			if (reddit) return false;
			reddit = true;
			return true;
		})
		.slice(0, FEEDS_PER_RUN);
	const results = await Promise.all(
		due.map(async (f) => ({ feed: f.title, ...(await syncFeed(db, f, now, fetcher)) }))
	);
	await db
		.delete(syncLog)
		.where(lt(syncLog.at, new Date(now.getTime() - LOG_DAYS * DAY).toISOString()));
	return results;
}

const isReddit = (url: string) => /(^|\.)reddit\.com$/.test(new URL(url).hostname);

// ---- Reading ----

export type ItemFilter = { folderId?: number | null; feedId?: number | null; kind?: Kind | null };

function itemWhere({ folderId, feedId, kind }: ItemFilter) {
	return and(
		feedId ? eq(item.feedId, feedId) : undefined,
		folderId ? eq(feed.folderId, folderId) : undefined,
		kind ? eq(item.kind, kind) : undefined
	);
}

export const PAGE = 60;

/** Feed entries, newest first; `before` (a publishedAt) pages back. */
export function listItems(
	db: DB,
	filter: ItemFilter & { unreadOnly?: boolean; before?: string | null }
) {
	return db
		.select({
			id: item.id,
			url: item.url,
			title: item.title,
			kind: item.kind,
			publishedAt: item.publishedAt,
			readAt: item.readAt,
			feedTitle: feed.title,
			/** In Later already. */
			savedId: saved.id
		})
		.from(item)
		.innerJoin(feed, eq(item.feedId, feed.id))
		.leftJoin(saved, and(eq(saved.url, item.url), isNull(saved.archivedAt)))
		.where(
			and(
				itemWhere(filter),
				filter.unreadOnly ? isNull(item.readAt) : undefined,
				filter.before ? lt(item.publishedAt, filter.before) : undefined
			)
		)
		.orderBy(desc(item.publishedAt), desc(item.id))
		.limit(PAGE);
}

/** Unread entries per folder (null: not in one), for the folder chips. */
export async function unreadByFolder(db: DB) {
	return db
		.select({ folderId: feed.folderId, n: sql<number>`count(*)` })
		.from(item)
		.innerJoin(feed, eq(item.feedId, feed.id))
		.where(isNull(item.readAt))
		.groupBy(feed.folderId);
}

export async function setRead(db: DB, id: number, read: boolean, now = new Date()) {
	await db
		.update(item)
		.set({ readAt: read ? now.toISOString() : null })
		.where(eq(item.id, id));
}

export async function getItem(db: DB, id: number) {
	const [row] = await db.select().from(item).where(eq(item.id, id));
	return row ?? null;
}

/** Marks everything matching the filter read (up to entries published by `upTo`). */
export async function markAllRead(db: DB, filter: ItemFilter, upTo: string, now = new Date()) {
	const ids = db
		.select({ id: item.id })
		.from(item)
		.innerJoin(feed, eq(item.feedId, feed.id))
		.where(and(itemWhere(filter), isNull(item.readAt), lte(item.publishedAt, upTo)));
	await db.update(item).set({ readAt: now.toISOString() }).where(inArray(item.id, ids));
}

/** Unread entries in all feeds, for the Feeds tab's badge. */
export async function unreadCount(db: DB) {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(item)
		.where(isNull(item.readAt));
	return row.n;
}
