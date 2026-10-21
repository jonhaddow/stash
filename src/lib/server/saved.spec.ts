import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './test-db.ts';
import type { DB } from './db/index.ts';
import { cleanUrl, listSaved, saveLink, setArchived } from './saved.ts';
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
