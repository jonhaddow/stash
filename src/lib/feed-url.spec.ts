import { describe, expect, it } from 'vitest';
import { asChannelFeed, asSubreddit, subredditFeed, typedAs, withShorts } from './feed-url.ts';

describe('subreddits', () => {
	it('reads r/name and links', () => {
		expect(asSubreddit('r/rust')).toEqual({ sub: 'rust', sort: 'hot', t: 'day', limit: null });
		expect(asSubreddit('reddit.com/r/rust/top/?t=week&limit=500')).toEqual({
			sub: 'rust',
			sort: 'top',
			t: 'week',
			limit: 100
		});
		expect(asSubreddit('https://www.reddit.com/r/rust/comments/abc/x/')).toBeNull();
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

it('tells what was typed', () => {
	expect(typedAs('r/rust')).toBe('reddit');
	expect(typedAs('@veritasium')).toBe('youtube');
	expect(typedAs('youtube.com/@veritasium')).toBe('youtube');
	expect(typedAs('daringfireball.net')).toBe('url');
	expect(typedAs('https://blog.example/x')).toBe('url');
	expect(typedAs('daring fireball')).toBe('search');
	expect(typedAs('veritasium')).toBe('search');
});
