import { describe, expect, it } from 'vitest';
import {
	asChannelFeed,
	asSubreddit,
	sourceOf,
	subredditFeed,
	searches,
	subredditNamed,
	withShorts
} from './feed-url.ts';

describe('subreddits', () => {
	it('reads r/name and links', () => {
		expect(asSubreddit('r/rust')).toEqual({ sub: 'rust', sort: 'hot', t: 'day', limit: null });
		expect(asSubreddit('reddit.com/r/rust/top/?t=week&limit=500')).toEqual({
			sub: 'rust',
			sort: 'top',
			t: 'week',
			limit: 100
		});
		expect(asSubreddit('https://www.reddit.com/r/rust/s/AbC123')).toMatchObject({ sub: 'rust' });
		expect(asSubreddit('rust')).toBeNull();
	});

	it('builds the feed, and reads it back', () => {
		const o = { sub: 'rust', sort: 'top', t: 'month', limit: 10 } as const;
		const url = subredditFeed(o);
		expect(url).toBe('https://www.reddit.com/r/rust/top/.rss?t=month&limit=10');
		expect(asSubreddit(url)).toEqual(o);
		expect(subredditFeed({ ...o, sort: 'hot', limit: null })).toBe(
			'https://www.reddit.com/r/rust/.rss'
		);
	});
});

describe('YouTube', () => {
	const id = 'HnyfMqiRRG1u-2MsSQLbXA';
	const channel = `https://www.youtube.com/feeds/videos.xml?channel_id=UC${id}`;
	const noShorts = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${id}`;

	it('swaps between the channel and its no-Shorts playlist', () => {
		expect(asChannelFeed(noShorts)).toEqual({ id, shorts: false });
		expect(withShorts(channel, false)).toBe(noShorts);
		expect(withShorts(noShorts, true)).toBe(channel);
		expect(withShorts('https://blog.example/feed', false)).toBe('https://blog.example/feed');
	});
});

it('searches by name, and adds links', () => {
	expect(searches('youtube', 'veritasium')).toBe(true);
	expect(searches('youtube', '@veritasium')).toBe(false);
	expect(searches('youtube', 'youtube.com/@veritasium')).toBe(false);
	expect(searches('rss', 'daring fireball')).toBe(true);
	expect(searches('rss', 'daringfireball.net')).toBe(false);
	expect(searches('rss', 'https://blog.example/x')).toBe(false);
	expect(searches('reddit', 'rust')).toBe(false);
});

it('takes a bare subreddit name', () => {
	expect(subredditNamed(' rust ')).toEqual({ sub: 'rust', sort: 'hot', t: 'day', limit: null });
	expect(subredditNamed('r/rust')?.sub).toBe('rust');
	expect(subredditNamed('rust lang')).toBeNull();
});

it('groups feeds by where they come from', () => {
	expect(sourceOf('https://www.reddit.com/r/rust/.rss', null)).toBe('Reddit');
	expect(sourceOf('https://feeds.invalid/x.xml', 'https://www.youtube.com/@bread')).toBe('YouTube');
	expect(sourceOf('https://blog.example/feed', 'https://blog.example/')).toBe('Other');
});
