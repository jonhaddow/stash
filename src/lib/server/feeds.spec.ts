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
	getFeed,
	updateFeed
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

	it('goes straight to a subreddit’s feed, keeping its sort', async () => {
		const feed = 'https://www.reddit.com/r/sveltejs/top/.rss?t=week';
		const fetcher = fakeFetch({ [feed]: rss([]) });
		const { url } = await discoverFeed('https://old.reddit.com/r/sveltejs/top/?t=week', fetcher);
		expect(url).toBe(feed);
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
		await addFeed(db, url, { now, fetcher });
		const items = await listItems(db, {});
		expect(items.map((i) => [i.title, !!i.readAt])).toEqual([
			['new', false],
			['old', true]
		]);
		await expect(addFeed(db, url, { now, fetcher })).rejects.toThrow('already here');
	});

	it('adds only new entries, sends the etag back and logs each fetch', async () => {
		const pages: Record<string, string | number> = {
			[url]: rss([{ guid: 'a', date: '2026-10-19T00:00:00Z' }])
		};
		const seen: Headers[] = [];
		const fetcher = fakeFetch(pages, seen);
		const f = await addFeed(db, url, { now, fetcher });

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
		await addFeed(db, url, { now: new Date('2026-08-01T00:00:00Z'), fetcher });
		expect(await syncDue(db, new Date('2026-08-01T00:10:00Z'), fetcher)).toEqual([]);
		expect(await syncDue(db, now, fetcher)).toHaveLength(1);
		// The August log is gone; today's stays.
		expect((await db.select().from(syncLog)).map((l) => l.at)).toEqual([now.toISOString()]);
	});
});

describe('options', () => {
	const channel = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA';
	const noShorts =
		'https://www.youtube.com/feeds/videos.xml?playlist_id=UULFHnyfMqiRRG1u-2MsSQLbXA';
	const page = 'https://www.youtube.com/@veritasium';

	it('adds a YouTube channel without Shorts', async () => {
		const fetcher = fakeFetch({
			[page]: `<link rel="alternate" type="application/rss+xml" href="${channel}">`,
			[channel]: rss([]),
			[noShorts]: rss([])
		});
		const f = await addFeed(db, page, { now, fetcher, shorts: false });
		expect(f.url).toBe(noShorts);
	});

	it('changes a feed’s options, fetching it afresh', async () => {
		const fetcher = fakeFetch({ [channel]: rss([]) });
		const f = await addFeed(db, channel, { now, fetcher });
		await updateFeed(db, f.id, { title: 'V', url: noShorts });
		const after = await getFeed(db, f.id);
		expect(after).toMatchObject({ url: noShorts, title: 'V', etag: null, lastFetchedAt: null });
	});
});

describe('syncDue', () => {
	const at = (min: number) => new Date(now.getTime() + min * 60_000);

	it('fetches one Reddit feed each run', async () => {
		const pages: Record<string, string> = {};
		for (const sub of ['a', 'b', 'c']) pages[`https://www.reddit.com/r/${sub}/.rss`] = rss([]);
		pages['https://blog.example/feed.xml'] = rss([]);
		pages['https://blog.example/other.xml'] = rss([]);
		const fetcher = fakeFetch(pages);
		await db
			.insert(feedTable)
			.values(Object.keys(pages).map((url) => ({ title: url, url, createdAt: now.toISOString() })));
		expect((await syncDue(db, now, fetcher)).map((r) => r.feed)).toEqual([
			'https://www.reddit.com/r/a/.rss',
			'https://blog.example/feed.xml',
			'https://blog.example/other.xml'
		]);
		expect((await syncDue(db, at(5), fetcher)).map((r) => r.feed)).toEqual([
			'https://www.reddit.com/r/b/.rss'
		]);
	});

	it('tries a feed refused with 429 again on the next run', async () => {
		const url = 'https://www.reddit.com/r/a/.rss';
		await db.insert(feedTable).values({ title: 'r/a', url, createdAt: now.toISOString() });
		expect(await syncDue(db, now, fakeFetch({ [url]: 429 }))).toMatchObject([
			{ status: 'error', error: 'HTTP 429' }
		]);
		const fetcher = fakeFetch({ [url]: rss([]) });
		expect(await syncDue(db, at(5), fetcher)).toMatchObject([{ status: 'ok' }]);
		// Fetched fine: back to every half hour.
		expect(await syncDue(db, at(10), fetcher)).toEqual([]);
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
		await addFeed(db, url, { now, fetcher });
		await markAllRead(db, null, '2026-10-19T12:00:00.000Z', now);
		const items = await listItems(db, { unreadOnly: true });
		expect(items.map((i) => i.title)).toEqual(['b']);
	});

	it('lists oldest first, paging on to newer ones', async () => {
		const url = 'https://blog.example/feed.xml';
		const fetcher = fakeFetch({
			[url]: rss([
				{ guid: 'c', date: '2026-10-20T00:00:00Z' },
				{ guid: 'a', date: '2026-10-18T00:00:00Z' },
				{ guid: 'b', date: '2026-10-19T00:00:00Z' }
			])
		});
		await addFeed(db, url, { now, fetcher });
		const all = await listItems(db, { order: 'oldest' });
		expect(all.map((i) => i.title)).toEqual(['a', 'b', 'c']);
		const after = await listItems(db, { order: 'oldest', from: all[0].publishedAt });
		expect(after.map((i) => i.title)).toEqual(['b', 'c']);
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
		// Refused at first (Reddit does this), then fine.
		await syncFeed(db, f, now, fakeFetch({ [url]: 429 }));
		await syncFeed(db, (await getFeed(db, f.id))!, now, fetcher);
		const items = await listItems(db, {});
		expect(items.map((i) => [i.title, !!i.readAt])).toEqual([
			['new', true],
			['old', true]
		]);
	});
});
