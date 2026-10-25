import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './test-db.ts';
import { saved } from './db/schema.ts';
import type { DB } from './db/index.ts';
import { cleanUrl, isoSeconds, listSaved, saveLink, setArchived } from './saved.ts';
import type { Fetch } from './http.ts';

let db: DB;
beforeEach(async () => {
	db = await testDb();
});

const page: Fetch = () =>
	Promise.resolve(
		new Response(
			'<head><title>A page</title><meta property="og:image" content="https://img.example/a.jpg"></head>',
			{ status: 200 }
		)
	);

describe('cleanUrl', () => {
	it('finds the link in shared text', () => {
		expect(cleanUrl('Look at this https://example.com/a#top')).toBe('https://example.com/a');
		expect(cleanUrl('example.com/a')).toBe('https://example.com/a');
	});
	it('refuses things that aren’t web links', () => {
		expect(cleanUrl('javascript:alert(1)')).toBeNull();
		expect(cleanUrl('hello')).toBeNull();
		expect(cleanUrl(null)).toBeNull();
	});
});

describe('isoSeconds', () => {
	it('reads the Data API’s durations', () => {
		expect(isoSeconds('PT12M34S')).toBe(754);
		expect(isoSeconds('PT1H')).toBe(3600);
		expect(isoSeconds('P1DT2S')).toBe(86402);
		expect(isoSeconds('P0D')).toBeNull();
		expect(isoSeconds(undefined)).toBeNull();
	});
});

describe('saveLink', () => {
	it('fetches the title and works out the kind', async () => {
		const row = await saveLink(db, 'https://www.youtube.com/watch?v=1', {}, { fetcher: page });
		expect(row).toMatchObject({
			title: 'A page',
			kind: 'video',
			imageUrl: 'https://img.example/a.jpg'
		});
		expect(await listSaved(db, { kind: 'article' })).toEqual([]);
	});

	it('looks up a YouTube video’s length when there’s a key, even with a title given', async () => {
		const asked: string[] = [];
		const api: Fetch = async (input) => {
			asked.push(String(input));
			return Response.json({ items: [{ contentDetails: { duration: 'PT4M5S' } }] });
		};
		const yt = 'https://youtu.be/xyz';
		const row = await saveLink(db, yt, { title: 'A video' }, { fetcher: api, youtubeKey: 'k' });
		expect(row.duration).toBe(245);
		expect(asked).toEqual([
			'https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=xyz&key=k'
		]);
		await db.update(saved).set({ duration: null });
		const again = await saveLink(db, yt, { title: 'A video' }, { fetcher: api, youtubeKey: 'k' });
		expect(again.duration).toBe(245);
		const other = await saveLink(db, 'https://a.example/', { title: 'A' }, { fetcher: api });
		expect(other.duration).toBeNull();
		expect(asked).toHaveLength(2);
	});

	const redirectsTo =
		(final: string): Fetch =>
		async (input) => {
			const res = await page(input);
			Object.defineProperty(res, 'url', { value: final });
			return res;
		};

	it('keeps the link a tracker redirects to, without tracking params', async () => {
		const row = await saveLink(
			db,
			'https://buttondown.example/c/abc',
			{},
			{ fetcher: redirectsTo('https://news.ycombinator.com/item?id=1&utm_term=comment&fbclid=x') }
		);
		expect(row.url).toBe('https://news.ycombinator.com/item?id=1');
	});

	it('keeps the shared link when it redirects to a login or consent page', async () => {
		const insta = 'https://www.instagram.com/p/abc/';
		const login = 'https://www.instagram.com/accounts/login/?next=%2Fp%2Fabc%2F';
		expect((await saveLink(db, insta, {}, { fetcher: redirectsTo(login) })).url).toBe(insta);
		const yt = 'https://www.youtube.com/watch?v=1';
		const consent = `https://consent.youtube.com/m?continue=${encodeURIComponent(yt)}`;
		expect((await saveLink(db, yt, {}, { fetcher: redirectsTo(consent) })).url).toBe(yt);
	});

	it('takes a [video] title as a video, and lists oldest first when asked', async () => {
		const hn = 'https://news.ycombinator.com/item?id=1';
		await saveLink(db, hn, { title: 'A talk [video]' }, { now: new Date('2026-10-01T00:00:00Z') });
		await saveLink(
			db,
			'https://b.example/',
			{ title: 'B' },
			{ now: new Date('2026-10-02T00:00:00Z') }
		);
		expect((await listSaved(db, { kind: 'video' })).map((s) => s.url)).toEqual([hn]);
		expect((await listSaved(db, { order: 'oldest' })).map((s) => s.title)).toEqual([
			'A talk [video]',
			'B'
		]);
	});

	it('brings an archived link back to the top when saved again', async () => {
		const first = await saveLink(
			db,
			'https://a.example/',
			{ title: 'A' },
			{
				now: new Date('2026-10-01T00:00:00Z')
			}
		);
		await saveLink(
			db,
			'https://b.example/',
			{ title: 'B' },
			{ now: new Date('2026-10-02T00:00:00Z') }
		);
		await setArchived(db, first.id, '2026-10-03T00:00:00Z');
		expect((await listSaved(db, { archived: true })).map((s) => s.title)).toEqual(['A']);

		await saveLink(
			db,
			'https://a.example/',
			{ title: 'A again' },
			{ now: new Date('2026-10-04T00:00:00Z') }
		);
		expect((await listSaved(db, {})).map((s) => s.title)).toEqual(['A', 'B']);
	});
});
