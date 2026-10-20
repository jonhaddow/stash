import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './test-db.ts';
import { feed as feedTable, item, syncLog } from './db/schema.ts';
import type { DB } from './db/index.ts';
import type { Fetch } from './http.ts';
import {
	addFeed,
	discoverFeed,
	listItems,
	markAllRead,
	syncDue,
	syncFeed,
	getFeed
} from './feeds.ts';

const now = new Date('2026-10-20T12:00:00Z');

const rss = (items: { guid: string; date: string }[]) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Blog</title><link>https://blog.example/</link>
${items.map((i) => `<item><title>${i.guid}</title><link>https://blog.example/${i.guid}</link><guid>${i.guid}</guid><pubDate>${new Date(i.date).toUTCString()}</pubDate></item>`).join('')}
</channel></rss>`;

/** A fake fetch serving fixed bodies by URL, recording the request headers. */
function fakeFetch(pages: Record<string, string | number>, seen: Headers[] = []): Fetch {
	return (input, init) => {
		const url = String(input);
		seen.push(new Headers(init?.headers));
		const page = pages[url];
		if (page === undefined) return Promise.resolve(new Response('nope', { status: 404 }));
		if (typeof page === 'number') return Promise.resolve(new Response(null, { status: page }));
		return Promise.resolve(new Response(page, { headers: { etag: '"v1"' } }));
	};
}

let db: DB;
beforeEach(async () => {
	db = await testDb();
});

describe('discoverFeed', () => {
	it('follows a page’s feed link', async () => {
		const fetcher = fakeFetch({
			'https://blog.example/':
				'<html><link rel="alternate" type="application/atom+xml" href="/atom.xml"></html>',
			'https://blog.example/atom.xml': '<feed><title>Atom blog</title></feed>'
		});
		const { url, parsed } = await discoverFeed('https://blog.example/', fetcher);
		expect(url).toBe('https://blog.example/atom.xml');
		expect(parsed.title).toBe('Atom blog');
	});

	it('goes straight to a subreddit’s feed', async () => {
		const fetcher = fakeFetch({ 'https://www.reddit.com/r/sveltejs/.rss': rss([]) });
		const { url } = await discoverFeed('https://old.reddit.com/r/sveltejs/top', fetcher);
		expect(url).toBe('https://www.reddit.com/r/sveltejs/.rss');
	});

	it('says when a page has no feed', async () => {
		const fetcher = fakeFetch({ 'https://blog.example/': '<html></html>' });
		await expect(discoverFeed('https://blog.example/', fetcher)).rejects.toThrow('No feed found');
	});
});

describe('syncing', () => {
	const url = 'https://blog.example/feed.xml';

	it('adds a feed with recent entries unread and older ones read', async () => {
		const fetcher = fakeFetch({
			[url]: rss([
				{ guid: 'new', date: '2026-10-19T00:00:00Z' },
				{ guid: 'old', date: '2026-09-01T00:00:00Z' }
			])
		});
		await addFeed(db, url, null, { now, fetcher });
		const items = await listItems(db, {});
		expect(items.map((i) => [i.title, !!i.readAt])).toEqual([
			['new', false],
			['old', true]
		]);
		await expect(addFeed(db, url, null, { now, fetcher })).rejects.toThrow('already here');
	});

	it('adds only new entries, sends the etag back and logs each fetch', async () => {
		const pages: Record<string, string | number> = {
			[url]: rss([{ guid: 'a', date: '2026-10-19T00:00:00Z' }])
		};
		const seen: Headers[] = [];
		const fetcher = fakeFetch(pages, seen);
		const f = await addFeed(db, url, null, { now, fetcher });

		pages[url] = rss([
			{ guid: 'b', date: '2026-10-20T00:00:00Z' },
			{ guid: 'a', date: '2026-10-19T00:00:00Z' }
		]);
		expect(await syncFeed(db, (await getFeed(db, f.id))!, now, fetcher)).toMatchObject({
			status: 'ok',
			itemsAdded: 1
		});
		pages[url] = 304;
		expect(await syncFeed(db, (await getFeed(db, f.id))!, now, fetcher)).toMatchObject({
			status: 'not-modified'
		});
		expect(seen.at(-1)?.get('if-none-match')).toBe('"v1"');

		pages[url] = 500;
		expect(await syncFeed(db, (await getFeed(db, f.id))!, now, fetcher)).toMatchObject({
			status: 'error',
			error: 'HTTP 500'
		});
		const feed = await getFeed(db, f.id);
		expect(feed?.lastStatus).toBe('error');
		expect((await db.select().from(syncLog)).map((l) => l.status)).toEqual([
			'ok',
			'ok',
			'not-modified',
			'error'
		]);
		expect(await db.select().from(item)).toHaveLength(2);
	});

	it('syncDue only fetches feeds not fetched in the last half hour, and tidies old logs', async () => {
		const fetcher = fakeFetch({ [url]: rss([]) });
		await addFeed(db, url, null, { now: new Date('2026-08-01T00:00:00Z'), fetcher });
		expect(await syncDue(db, new Date('2026-08-01T00:10:00Z'), fetcher)).toEqual([]);
		expect(await syncDue(db, now, fetcher)).toHaveLength(1);
		// The August log is gone; today's stays.
		expect((await db.select().from(syncLog)).map((l) => l.at)).toEqual([now.toISOString()]);
	});
});

describe('reading', () => {
	it('marks everything read up to a time', async () => {
		const url = 'https://blog.example/feed.xml';
		const fetcher = fakeFetch({
			[url]: rss([
				{ guid: 'a', date: '2026-10-19T00:00:00Z' },
				{ guid: 'b', date: '2026-10-20T00:00:00Z' }
			])
		});
		await addFeed(db, url, null, { now, fetcher });
		await markAllRead(db, {}, '2026-10-19T12:00:00.000Z', now);
		const items = await listItems(db, { unreadOnly: true });
		expect(items.map((i) => i.title)).toEqual(['b']);
	});
});

describe('imported feeds', () => {
	it('start with everything read', async () => {
		const url = 'https://blog.example/feed.xml';
		const fetcher = fakeFetch({
			[url]: rss([
				{ guid: 'new', date: '2026-10-19T00:00:00Z' },
				{ guid: 'old', date: '2026-09-01T00:00:00Z' }
			])
		});
		const [f] = await db
			.insert(feedTable)
			.values({ title: 'Blog', url, createdAt: now.toISOString() })
			.returning();
		await syncFeed(db, f, now, fetcher);
		const items = await listItems(db, {});
		expect(items.map((i) => [i.title, !!i.readAt])).toEqual([
			['new', true],
			['old', true]
		]);
	});
});
