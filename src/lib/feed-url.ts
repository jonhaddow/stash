// Feed addresses built from options, and read back into them: subreddits
// (sort, time window, limit) and YouTube channels (with or without Shorts).
// The options live in the stored URL, so there's nothing else to keep in step.
// Shared with the add box, which shows the options as you type.

export const SORTS = ['hot', 'new', 'top', 'rising'] as const;
export const WINDOWS = ['day', 'week', 'month', 'year', 'all'] as const;
export type Sort = (typeof SORTS)[number];
export type Window = (typeof WINDOWS)[number];
export type Subreddit = { sub: string; sort: Sort; t: Window; limit: number | null };

const isOne = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

/** Reddit allows up to 100 posts a request. */
export const clampLimit = (n: unknown) => {
	const v = Math.round(Number(n));
	return v > 0 ? Math.min(v, 100) : null;
};

/** A subreddit typed as `r/name`, or any reddit.com/r/… link (its feed included). */
export function asSubreddit(input: string): Subreddit | null {
	const typed = /^\/?r\/([\w-]+)\/?$/i.exec(input.trim());
	if (typed) return { sub: typed[1], sort: 'hot', t: 'day', limit: null };
	let url: URL;
	try {
		url = new URL(/^https?:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
	} catch {
		return null;
	}
	if (!/(^|\.)reddit\.com$/.test(url.hostname)) return null;
	const m = /^\/r\/([\w-]+)(?:\/(hot|new|top|rising))?\/?(?:\.rss\/?)?$/.exec(url.pathname);
	if (!m) return null;
	const t = url.searchParams.get('t');
	return {
		sub: m[1],
		sort: isOne(SORTS, m[2]) ? m[2] : 'hot',
		t: isOne(WINDOWS, t) ? t : 'day',
		limit: clampLimit(url.searchParams.get('limit'))
	};
}

/** The subreddit's .rss address: reddit.ts sends it to the API. */
export function subredditFeed({ sub, sort, t, limit }: Subreddit) {
	const params = new URLSearchParams();
	if (sort === 'top') params.set('t', t);
	if (limit) params.set('limit', String(limit));
	const q = params.size ? `?${params}` : '';
	return `https://www.reddit.com/r/${sub}/${sort === 'hot' ? '' : `${sort}/`}.rss${q}`;
}

/** Subreddits read from forms: the `sort`, `t` and `limit` fields. */
export const subredditFrom = (sub: string, form: FormData): Subreddit => ({
	sub,
	sort: isOne(SORTS, form.get('sort')) ? (form.get('sort') as Sort) : 'hot',
	t: isOne(WINDOWS, form.get('t')) ? (form.get('t') as Window) : 'day',
	limit: clampLimit(form.get('limit'))
});

// ---- YouTube ----

const YT_FEED = 'https://www.youtube.com/feeds/videos.xml';

/**
 * A YouTube channel's feed, read back: its id (without the `UC`) and whether
 * it has Shorts. The channel's uploads without Shorts are the `UULF` playlist.
 */
export function asChannelFeed(url: string): { id: string; shorts: boolean } | null {
	if (!url.startsWith(YT_FEED)) return null;
	const params = new URL(url).searchParams;
	const channel = /^UC([\w-]{22})$/.exec(params.get('channel_id') ?? '');
	if (channel) return { id: channel[1], shorts: true };
	const playlist = /^UULF([\w-]{22})$/.exec(params.get('playlist_id') ?? '');
	return playlist ? { id: playlist[1], shorts: false } : null;
}

export const channelFeed = (id: string, shorts: boolean) =>
	shorts ? `${YT_FEED}?channel_id=UC${id}` : `${YT_FEED}?playlist_id=UULF${id}`;

/** A channel feed with Shorts in or out; any other URL as it is. */
export function withShorts(url: string, shorts: boolean) {
	const c = asChannelFeed(url);
	return c ? channelFeed(c.id, shorts) : url;
}

// ---- What was typed ----

export type Typed = 'reddit' | 'youtube' | 'url' | 'search';

/** How the add box reads its input: a subreddit, a YouTube channel, a link, or words to search. */
export function typedAs(input: string): Typed {
	const s = input.trim();
	if (asSubreddit(s)) return 'reddit';
	if (/^@[\w.-]+$/.test(s) || /^(https?:\/\/)?([\w-]+\.)*(youtube\.com|youtu\.be)\b/i.test(s))
		return 'youtube';
	if (/^https?:\/\//i.test(s) || /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return 'url';
	return 'search';
}
