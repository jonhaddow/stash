// Finding feeds by name: YouTube channels through the YouTube Data API,
// sites and podcasts through Feedly's public feed search.
// Feedly knows YouTube too, but mostly by long-dead gdata addresses.
import { channelFeed } from '../feed-url.ts';
import { get, type Fetch } from './http.ts';

export type Found = { title: string; url: string; detail: string; icon: string | null };

type YouTubeSearch = {
	items?: {
		snippet: { channelId: string; title: string; description: string };
	}[];
};
type ChannelList = {
	items?: {
		id: string;
		snippet: { thumbnails?: { default?: { url: string } } };
		statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
	}[];
};
type FeedlySearch = {
	results?: {
		feedId: string;
		title?: string;
		website?: string;
		subscribers?: number;
		iconUrl?: string;
		visualUrl?: string;
	}[];
};

const count = new Intl.NumberFormat('en-US', { notation: 'compact' });

async function json<T>(fetcher: Fetch, url: string): Promise<T> {
	const res = await get(fetcher, url, { accept: 'application/json' });
	if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
	return res.json() as Promise<T>;
}

async function youtube(q: string, key: string, fetcher: Fetch): Promise<Found[]> {
	const api = 'https://www.googleapis.com/youtube/v3';
	const search = await json<YouTubeSearch>(
		fetcher,
		`${api}/search?part=snippet&type=channel&maxResults=4&q=${encodeURIComponent(q)}&key=${key}`
	);
	const hits = search.items ?? [];
	if (!hits.length) return [];
	// Search results have tiny avatars and no subscriber counts: one more call for those.
	const ids = hits.map((h) => h.snippet.channelId).join(',');
	const { items = [] } = await json<ChannelList>(
		fetcher,
		`${api}/channels?part=snippet,statistics&id=${ids}&key=${key}`
	);
	return hits.map(({ snippet: s }) => {
		const c = items.find((i) => i.id === s.channelId);
		const subs = c?.statistics?.hiddenSubscriberCount ? null : c?.statistics?.subscriberCount;
		return {
			title: s.title,
			url: channelFeed(s.channelId.slice(2), true),
			detail: ['YouTube', subs && `${count.format(Number(subs))} subscribers`]
				.filter(Boolean)
				.join(' · '),
			icon: c?.snippet.thumbnails?.default?.url ?? null
		};
	});
}

async function feedly(q: string, fetcher: Fetch): Promise<Found[]> {
	const { results = [] } = await json<FeedlySearch>(
		fetcher,
		`https://cloud.feedly.com/v3/search/feeds?count=10&query=${encodeURIComponent(q)}`
	);
	return results
		.filter((r) => r.feedId.startsWith('feed/http') && !/youtube\.com/.test(r.feedId))
		.slice(0, 6)
		.map((r) => {
			const url = r.feedId.slice('feed/'.length);
			const site = (() => {
				try {
					return new URL(r.website ?? url).hostname.replace(/^www\./, '');
				} catch {
					return null;
				}
			})();
			return {
				title: r.title || site || url,
				url,
				detail: [site, r.subscribers && `${count.format(r.subscribers)} followers`]
					.filter(Boolean)
					.join(' · '),
				// Some are http, which the CSP blocks; Google's storage serves them on https too.
				icon: (r.iconUrl ?? r.visualUrl)?.replace(/^http:/, 'https:') ?? null
			};
		});
}

/** YouTube channels, or sites (from Feedly). Throws a readable message if the search fails. */
export async function searchFeeds(
	q: string,
	type: 'youtube' | 'rss',
	{ youtubeKey, fetcher }: { youtubeKey?: string; fetcher: Fetch }
): Promise<Found[]> {
	if (type === 'youtube' && !youtubeKey) throw new Error('YouTube search isn’t set up');
	const search =
		youtubeKey && type === 'youtube' ? youtube(q, youtubeKey, fetcher) : feedly(q, fetcher);
	return search.catch(() => {
		throw new Error('Search isn’t answering');
	});
}
