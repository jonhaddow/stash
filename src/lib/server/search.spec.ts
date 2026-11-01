import { describe, expect, it } from 'vitest';
import type { Fetch } from './http.ts';
import { searchFeeds } from './search.ts';

const json = (body: unknown) => Promise.resolve(Response.json(body));

const fetcher: Fetch = (input) => {
	const url = new URL(String(input));
	if (url.pathname.endsWith('/search'))
		return json({
			items: [{ snippet: { channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', title: 'Veritasium' } }]
		});
	if (url.pathname.endsWith('/channels'))
		return json({
			items: [
				{
					id: 'UCHnyfMqiRRG1u-2MsSQLbXA',
					snippet: { thumbnails: { default: { url: 'https://yt3.example/a.jpg' } } },
					statistics: { subscriberCount: '17000000' }
				}
			]
		});
	if (url.hostname === 'cloud.feedly.com')
		return json({
			results: [
				{ feedId: 'feed/http://gdata.youtube.com/feeds/x', title: 'Old YouTube' },
				{
					feedId: 'feed/https://blog.example/feed',
					title: 'A blog',
					website: 'https://www.blog.example/',
					subscribers: 1200
				}
			]
		});
	return Promise.resolve(new Response(null, { status: 404 }));
};

describe('searchFeeds', () => {
	it('finds YouTube channels', async () => {
		const found = await searchFeeds('veritasium', 'youtube', { youtubeKey: 'k', fetcher });
		expect(found).toEqual([
			{
				title: 'Veritasium',
				url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA',
				detail: 'YouTube · 17M subscribers',
				icon: 'https://yt3.example/a.jpg'
			}
		]);
	});

	it('finds sites, leaving out Feedly’s YouTube', async () => {
		expect(await searchFeeds('x', 'rss', { fetcher })).toEqual([
			{
				title: 'A blog',
				url: 'https://blog.example/feed',
				detail: 'blog.example · 1.2K followers',
				icon: null
			}
		]);
	});

	it('says so when it can’t search', async () => {
		await expect(searchFeeds('x', 'youtube', { fetcher })).rejects.toThrow('isn’t set up');
		const down: Fetch = () => Promise.resolve(new Response(null, { status: 503 }));
		await expect(searchFeeds('x', 'rss', { fetcher: down })).rejects.toThrow('isn’t answering');
	});
});
