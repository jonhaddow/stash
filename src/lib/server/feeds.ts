import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { kindOf, type Kind, type Order } from '../kind.ts';
import { feed, item, saved, syncLog, type Feed } from './db/schema.ts';
import type { DB } from './db/index.ts';
import { get, readText, workersFetch, type Fetch } from './http.ts';
import { isReddit, withReddit } from './reddit.ts';
import { asSubreddit, subredditFeed, withShorts } from '../feed-url.ts';
import { findFeedLink, looksLikeFeed, parseFeed, type ParsedFeed } from './parse.ts';

/** Fetching feeds: subreddits through Reddit's API (reddit.ts), the rest directly. */
const feedFetch = withReddit(workersFetch);

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Each feed is fetched at most this often. */
export const FEED_EVERY_MS = 30 * MIN;
/** Feeds fetched per cron run (every 5 minutes); keeps each run inside the free plan's CPU. */
export const FEEDS_PER_RUN = 5;
/** A feed added in the app starts with entries older than this read. */
const FRESH_MS = 7 * DAY;
const LOG_DAYS = 7;
/**
 * Read entries go this long after they were read and published. Entries published
 * before then aren't stored, so a pruned one still in its feed doesn't come back.
 */
const KEEP_READ_MS = 30 * DAY;
/** Rows per insert: D1 allows 100 bound values per query, and an item has 8. */
const INSERT_CHUNK = 12;

// ---- Finding a feed ----

/** Subreddits have feeds at a known address, and Reddit's pages often refuse servers. */
function knownFeed(input: string) {
	const sub = asSubreddit(input);
	return sub ? subredditFeed(sub) : null;
}

/** A feed from a feed URL or a page that links to one. Throws a readable message if none. */
export async function discoverFeed(
	input: string,
	fetcher: Fetch = feedFetch
): Promise<{ url: string; parsed: ParsedFeed }> {
	const url = knownFeed(input) ?? input;
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

// ---- Feeds ----

/**
 * Adds a feed and stores its current entries. Throws a readable message if it can't.
 * `shorts` picks a YouTube channel's feed with or without them.
 */
export async function addFeed(
	db: DB,
	input: string,
	{
		now = new Date(),
		fetcher = feedFetch,
		shorts
	}: { now?: Date; fetcher?: Fetch; shorts?: boolean } = {}
) {
	const started = Date.now();
	// A channel feed given straight is fetched once; a channel page leads to its feed first.
	const start = shorts === undefined ? input : withShorts(input, shorts);
	let { url, parsed } = await discoverFeed(start, fetcher);
	const wanted = shorts === undefined ? url : withShorts(url, shorts);
	if (wanted !== url) ({ url, parsed } = await discoverFeed(wanted, fetcher));
	const [existing] = await db.select({ id: feed.id }).from(feed).where(eq(feed.url, url));
	if (existing) throw new Error('That feed is already here');
	const [row] = await db
		.insert(feed)
		.values({
			title: parsed.title,
			url,
			siteUrl: parsed.siteUrl,
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

/** A changed `url` (new options) is fetched afresh next time. Throws if another feed has it. */
export async function updateFeed(
	db: DB,
	id: number,
	{ url, ...values }: { title: string; url?: string }
) {
	const [current] = await db.select({ url: feed.url }).from(feed).where(eq(feed.id, id));
	const moved = url && url !== current?.url;
	if (moved) {
		const [taken] = await db.select({ id: feed.id }).from(feed).where(eq(feed.url, url));
		if (taken) throw new Error('Another feed already has those options');
	}
	await db
		.update(feed)
		.set(moved ? { ...values, url, etag: null, lastModified: null, lastFetchedAt: null } : values)
		.where(eq(feed.id, id));
}

export async function deleteFeed(db: DB, id: number) {
	await db.delete(feed).where(eq(feed.id, id));
}

/** Every feed with its unread count, for the manage page. */
export async function listFeeds(db: DB) {
	return db
		.select({
			id: feed.id,
			title: feed.title,
			url: feed.url,
			siteUrl: feed.siteUrl,
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
		.limit(10);
}

// ---- Syncing ----

/**
 * Adds entries not seen before, skipping ones too old to keep; returns how many.
 * Ones published before `readBefore` start read.
 */
async function storeItems(
	db: DB,
	feedId: number,
	parsed: ParsedFeed,
	now: Date,
	readBefore: string | null = null
) {
	const oldest = new Date(now.getTime() - KEEP_READ_MS).toISOString();
	const recent = parsed.items.filter((i) => !i.publishedAt || i.publishedAt >= oldest);
	const byGuid = new Map(recent.map((i) => [i.guid, i]));
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
				kind: kindOf(i.url, i.title),
				imageUrl: i.image,
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
export async function syncFeed(db: DB, f: Feed, now = new Date(), fetcher: Fetch = feedFetch) {
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
			// Entries published before the feed was added start read: an imported feed
			// (even if earlier fetches failed) shows only what's new since.
			const itemsAdded = await storeItems(db, f.id, parsed, now, f.createdAt);
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

/** Deletes entries read and published over KEEP_READ_MS ago. */
async function pruneRead(db: DB, now: Date) {
	const before = new Date(now.getTime() - KEEP_READ_MS).toISOString();
	await db.delete(item).where(and(lt(item.readAt, before), lt(item.publishedAt, before)));
}

/** The cron's job: the feeds fetched longest ago (if due), and tidying old logs and entries. */
export async function syncDue(db: DB, now = new Date(), fetcher: Fetch = feedFetch) {
	const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
	const waiting = await db
		.select()
		.from(feed)
		.where(
			or(
				isNull(feed.lastFetchedAt),
				lte(feed.lastFetchedAt, ago(FEED_EVERY_MS)),
				// Refused with 429 (too many requests): on Cloudflare's shared addresses that's
				// other Workers using up the quota, so it's luck, and the next run tries again.
				eq(feed.lastError, 'HTTP 429')
			)
		)
		.orderBy(sql`${feed.lastFetchedAt} is not null`, asc(feed.lastFetchedAt));
	// Reddit refuses several requests at once, so its feeds go one per run.
	const due: Feed[] = [];
	let reddit = false;
	for (const f of waiting) {
		if (due.length === FEEDS_PER_RUN) break;
		if (isReddit(new URL(f.url).hostname)) {
			if (reddit) continue;
			reddit = true;
		}
		due.push(f);
	}
	const results = await Promise.all(
		due.map(async (f) => ({ feed: f.title, ...(await syncFeed(db, f, now, fetcher)) }))
	);
	await db
		.delete(syncLog)
		.where(lt(syncLog.at, new Date(now.getTime() - LOG_DAYS * DAY).toISOString()));
	await pruneRead(db, now);
	return results;
}

// ---- Reading ----

const ofKind = (kind?: Kind | null) => (kind ? eq(item.kind, kind) : undefined);

export const PAGE = 60;

/** Feed entries, newest first unless `order` is 'oldest'; `from` (a publishedAt) pages on. */
export function listItems(
	db: DB,
	filter: {
		feedId?: number;
		kind?: Kind | null;
		unreadOnly?: boolean;
		order?: Order;
		from?: string | null;
	}
) {
	const [by, past] = filter.order === 'oldest' ? [asc, gt] : [desc, lt];
	return db
		.select({
			id: item.id,
			url: item.url,
			title: item.title,
			kind: item.kind,
			imageUrl: item.imageUrl,
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
				filter.feedId ? eq(item.feedId, filter.feedId) : undefined,
				ofKind(filter.kind),
				filter.unreadOnly ? isNull(item.readAt) : undefined,
				filter.from ? past(item.publishedAt, filter.from) : undefined
			)
		)
		.orderBy(by(item.publishedAt), by(item.id))
		.limit(PAGE);
}

export async function hasFeeds(db: DB) {
	return (await db.select({ id: feed.id }).from(feed).limit(1)).length > 0;
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

/** Unread entries in all feeds, for the Feeds tab's badge. */
export async function unreadCount(db: DB) {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(item)
		.where(isNull(item.readAt));
	return row.n;
}
