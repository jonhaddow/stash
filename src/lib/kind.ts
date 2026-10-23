// What kind of link a URL is (article or video), and other things read from links:
// the site, a YouTube video, a Hacker News thread. Also the lists' filters and order.
// Articles and videos are different reading sessions, so both lists filter by kind.

export const KINDS = ['article', 'video'] as const;
export type Kind = (typeof KINDS)[number];

/** Sites whose links are watched, not read. */
const VIDEO_HOSTS = [
	'youtube.com',
	'youtu.be',
	'vimeo.com',
	'twitch.tv',
	'tiktok.com',
	'nebula.tv'
];

/** Hacker News marks links to talks and other videos like this. */
const VIDEO_TITLE = /\[video\]/i;

export function kindOf(url: string, title?: string | null): Kind {
	if (title && VIDEO_TITLE.test(title)) return 'video';
	try {
		const host = new URL(url).hostname.replace(/^(www|m)\./, '');
		return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? 'video' : 'article';
	} catch {
		return 'article';
	}
}

/** "theverge.com" for showing where a link goes. */
export function hostOf(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/** Lists' date order, newest first unless chosen otherwise (and remembered in a cookie per list). */
export type Order = 'newest' | 'oldest';

export const orderOf = (raw: string | undefined): Order => (raw === 'oldest' ? 'oldest' : 'newest');

/** `?kind=` from a URL's query, if it's one we know. */
export const kindParam = (params: URLSearchParams): Kind | null => {
	const k = params.get('kind');
	return KINDS.includes(k as Kind) ? (k as Kind) : null;
};

/**
 * The video's ID if the link is to one YouTube video (watch, youtu.be, Shorts,
 * live), so it can play in the app.
 */
export function youtubeId(url: string): string | null {
	try {
		const u = new URL(url);
		const host = u.hostname.replace(/^(www|m)\./, '');
		const id =
			host === 'youtu.be'
				? u.pathname.slice(1)
				: host === 'youtube.com'
					? u.pathname === '/watch'
						? u.searchParams.get('v')
						: u.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1]
					: null;
		return id && /^[\w-]+$/.test(id) ? id : null;
	} catch {
		return null;
	}
}

/** The Hack app's link for a Hacker News thread, so it opens there on the phone. */
export function hackUrl(url: string): string | null {
	try {
		const u = new URL(url);
		const id = u.searchParams.get('id');
		return u.hostname === 'news.ycombinator.com' && u.pathname === '/item' && id && /^\d+$/.test(id)
			? `hack://item?id=${id}`
			: null;
	} catch {
		return null;
	}
}
