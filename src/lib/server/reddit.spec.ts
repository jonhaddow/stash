import { describe, expect, it } from 'vitest';
import type { Fetch } from './http.ts';
import { parseFeed } from './parse.ts';
import { apiUrl, withReddit } from './reddit.ts';

const LISTING = {
	data: {
		children: [
			{
				data: {
					name: 't3_abc',
					title: 'Tom & Jerry <3',
					permalink: '/r/movies/comments/abc/tom_jerry/',
					created_utc: 1792341208,
					thumbnail: 'https://b.thumbs.redditmedia.com/x.jpg'
				}
			},
			{
				data: {
					name: 't3_def',
					title: 'A text post',
					permalink: '/r/movies/comments/def/a_text_post/',
					created_utc: 1792341208,
					thumbnail: 'self'
				}
			}
		]
	}
};

/** A fake Reddit: a token endpoint and the API, recording each request. */
function fakeReddit(calls: { url: string; headers: Headers }[]): Fetch {
	return (input, init) => {
		const url = String(input);
		calls.push({ url, headers: new Headers(init?.headers) });
		if (url.endsWith('/access_token'))
			return Promise.resolve(Response.json({ access_token: 'tok', expires_in: 86400 }));
		if (url.startsWith('https://oauth.reddit.com/')) return Promise.resolve(Response.json(LISTING));
		return Promise.resolve(new Response('<rss></rss>'));
	};
}

const creds = () => ({ id: 'id', secret: 'secret' });

describe('apiUrl', () => {
	it('maps subreddit feeds to the API, keeping the query', () => {
		expect(apiUrl('https://www.reddit.com/r/movies/top/.rss?t=week&limit=5')).toBe(
			'https://oauth.reddit.com/r/movies/top?t=week&limit=5&raw_json=1'
		);
		expect(apiUrl('https://www.reddit.com/r/movies/.rss')).toBe(
			'https://oauth.reddit.com/r/movies?raw_json=1'
		);
	});
	it('leaves everything else alone', () => {
		expect(apiUrl('https://www.reddit.com/r/movies/')).toBeNull();
		expect(apiUrl('https://blog.example/feed.rss')).toBeNull();
		expect(apiUrl('https://www.reddit.com/user/someone/.rss')).toBeNull();
		expect(apiUrl('https://www.reddit.com/r/movies/comments/abc/.rss')).toBeNull();
	});
});

describe('withReddit', () => {
	it('fetches subreddit feeds from the API as Atom, signing in once', async () => {
		const calls: { url: string; headers: Headers }[] = [];
		const fetcher = withReddit(fakeReddit(calls), creds);
		const url = 'https://www.reddit.com/r/movies/top/.rss?t=week&limit=5';
		const res = await fetcher(url, { headers: { 'if-none-match': '"x"' } });
		await fetcher(url, {});

		expect(calls.map((c) => c.url.split('?')[0])).toEqual([
			'https://www.reddit.com/api/v1/access_token',
			'https://oauth.reddit.com/r/movies/top',
			'https://oauth.reddit.com/r/movies/top'
		]);
		expect(calls[1].headers.get('authorization')).toBe('Bearer tok');
		expect(calls[1].headers.get('if-none-match')).toBeNull();

		const feed = parseFeed(await res.text(), url);
		expect(feed.title).toBe('r/movies');
		expect(feed.items).toEqual([
			{
				// The same id and link as Reddit's .rss, so entries already stored aren't added again.
				guid: 't3_abc',
				url: 'https://www.reddit.com/r/movies/comments/abc/tom_jerry/',
				title: 'Tom & Jerry <3',
				publishedAt: '2026-10-18T16:33:28.000Z',
				image: 'https://b.thumbs.redditmedia.com/x.jpg'
			},
			{
				guid: 't3_def',
				url: 'https://www.reddit.com/r/movies/comments/def/a_text_post/',
				title: 'A text post',
				publishedAt: '2026-10-18T16:33:28.000Z',
				image: null
			}
		]);
	});

	it('passes other requests through, and Reddit too without credentials', async () => {
		const calls: { url: string; headers: Headers }[] = [];
		await withReddit(fakeReddit(calls), creds)('https://blog.example/feed.xml');
		await withReddit(fakeReddit(calls), () => null)('https://www.reddit.com/r/movies/.rss');
		expect(calls.map((c) => c.url)).toEqual([
			'https://blog.example/feed.xml',
			'https://www.reddit.com/r/movies/.rss'
		]);
	});

	it('answers 401 when signing in fails', async () => {
		const fetcher = withReddit(() => Promise.resolve(new Response('no', { status: 401 })), creds);
		expect((await fetcher('https://www.reddit.com/r/movies/.rss')).status).toBe(401);
	});
});
