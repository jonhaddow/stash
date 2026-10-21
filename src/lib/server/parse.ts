// RSS 2.0, RSS 1.0 (RDF) and Atom, read with regular expressions rather than an
// XML library: Workers' free plan allows about 10 ms of CPU per run, and this
// only needs a few fields from each entry. Also finds a page's feed, title and image.

export type ParsedItem = {
	guid: string;
	url: string;
	title: string;
	publishedAt: string | null;
	image: string | null;
};
export type ParsedFeed = { title: string; siteUrl: string | null; items: ParsedItem[] };

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

/** Text with CDATA unwrapped, tags dropped, entities decoded and space collapsed. */
export function text(raw: string) {
	return raw
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/<[^>]*>/g, '')
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
			if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
			const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1));
			return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
		})
		.replace(/\s+/g, ' ')
		.trim();
}

/** The contents of the first <tag>, e.g. `title` matches <title> but not <media:title>. */
function first(xml: string, tag: string) {
	const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
	return m ? m[1] : null;
}

/** An attribute from a tag's markup. */
export function attr(tag: string, name: string) {
	const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
	return m ? text(m[2] ?? m[3]) : null;
}

/** Atom's <link href> for the page (rel="alternate", or no rel at all). */
function atomLink(xml: string) {
	for (const [tag] of xml.matchAll(/<link\b[^>]*>/gi)) {
		const rel = attr(tag, 'rel');
		const href = attr(tag, 'href');
		if (href && (!rel || rel === 'alternate')) return href;
	}
	return null;
}

function isoDate(raw: string | null) {
	if (!raw) return null;
	const t = Date.parse(text(raw));
	return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function absolute(url: string, base: string) {
	try {
		return new URL(url, base).href;
	} catch {
		return null;
	}
}

/** An https image URL (the CSP allows no others), made absolute. */
function imageUrl(raw: string | null, base: string) {
	const url = raw ? absolute(raw, base) : null;
	return url?.startsWith('https:') ? url : null;
}

/** The first <img> in some HTML that isn't a tracking pixel. */
function firstImg(html: string) {
	for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
		if (attr(tag, 'width') === '1' || attr(tag, 'height') === '1') continue;
		const src = attr(tag, 'src');
		if (src) return src;
	}
	return null;
}

/**
 * An entry's thumbnail: Media RSS (YouTube, Reddit) or an image enclosure, else
 * the first <img> in its HTML (in CDATA, or escaped, so unescaped first).
 */
function entryImage(block: string) {
	for (const [tag, name] of block.matchAll(
		/<(media:thumbnail|media:content|enclosure)\b[^>]*>/gi
	)) {
		const url = attr(tag, 'url');
		if (
			url &&
			(name.toLowerCase() === 'media:thumbnail' ||
				attr(tag, 'type')?.startsWith('image/') ||
				attr(tag, 'medium') === 'image')
		)
			return url;
	}
	return firstImg(
		block
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&')
	);
}

/** Whether a response body is a feed rather than a web page. */
export const looksLikeFeed = (body: string) =>
	/<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));

/** A feed's title, site and entries. Throws if it isn't a feed. */
export function parseFeed(xml: string, feedUrl: string): ParsedFeed {
	if (!looksLikeFeed(xml)) throw new Error('Not an RSS or Atom feed');
	const atom = /<feed[\s>]/i.test(xml.slice(0, 2000));
	const blocks = [
		...xml.matchAll(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi)
	].map((m) => m[0]);
	// The feed's own fields come before its first entry.
	const head = blocks.length ? xml.slice(0, xml.indexOf(blocks[0])) : xml;
	const rawSite = atom ? atomLink(head) : first(head, 'link');
	const siteUrl = rawSite ? absolute(text(rawSite), feedUrl) : null;

	const items: ParsedItem[] = [];
	for (const block of blocks) {
		const rawUrl = atom ? atomLink(block) : (first(block, 'link') ?? first(block, 'guid'));
		const url = rawUrl ? absolute(text(rawUrl), siteUrl ?? feedUrl) : null;
		if (!url || !/^https?:/.test(url)) continue;
		const guid = text(first(block, atom ? 'id' : 'guid') ?? '') || url;
		const title = text(first(block, 'title') ?? '') || url;
		const publishedAt = isoDate(
			atom
				? (first(block, 'published') ?? first(block, 'updated'))
				: (first(block, 'pubDate') ?? first(block, 'dc:date'))
		);
		const image = imageUrl(entryImage(block), url);
		items.push({ guid, url, title, publishedAt, image });
	}
	return { title: text(first(head, 'title') ?? '') || hostTitle(feedUrl), siteUrl, items };
}

const hostTitle = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/** The feed a web page points to (<link rel="alternate" type="application/rss+xml">). */
export function findFeedLink(html: string, pageUrl: string) {
	for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
		const type = attr(tag, 'type')?.toLowerCase() ?? '';
		const href = attr(tag, 'href');
		if (
			attr(tag, 'rel')?.toLowerCase().split(/\s+/).includes('alternate') &&
			href &&
			/(rss|atom)\+xml/.test(type)
		)
			return absolute(href, pageUrl);
	}
	return null;
}

/** A saved link's title (og:title, else <title>) and image (og:image). */
export function pageInfo(html: string, pageUrl: string) {
	let title: string | null = null;
	let image: string | null = null;
	for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
		const key = attr(tag, 'property') ?? attr(tag, 'name');
		if (!title && (key === 'og:title' || key === 'twitter:title')) title = attr(tag, 'content');
		if (!image && (key === 'og:image' || key === 'twitter:image'))
			image = imageUrl(attr(tag, 'content'), pageUrl);
	}
	if (!title) {
		const raw = first(html, 'title');
		title = raw ? text(raw) || null : null;
	}
	return { title, image };
}
