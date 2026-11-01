import { describe, expect, it } from 'vitest';
import { findFeedLink, pageInfo, parseFeed, text } from './parse.ts';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
	<title>A &amp; B Blog</title>
	<link>https://blog.example/</link>
	<item>
		<title><![CDATA[First <post>]]></title>
		<link>https://blog.example/first</link>
		<guid isPermaLink="false">post-1</guid>
		<pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate>
		<description>&lt;img src="https://pixel.example/t.gif" width="1"&gt;&lt;p&gt;Hi &lt;img src=&quot;/img/a.jpg?w=1&amp;amp;h=2&quot;&gt;</description>
	</item>
	<item>
		<title>Relative &#8217;link&#x2019;</title>
		<link>/second</link>
	</item>
</channel></rss>`;

// YouTube and Reddit both serve Atom.
const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
	<link rel="self" href="https://www.youtube.com/feeds/videos.xml?channel_id=UC1"/>
	<link rel="alternate" href="https://www.youtube.com/channel/UC1"/>
	<title>A Channel</title>
	<entry>
		<id>yt:video:abc</id>
		<title>A video</title>
		<link rel="alternate" href="https://www.youtube.com/watch?v=abc"/>
		<published>2026-10-18T10:00:00+00:00</published>
		<updated>2026-10-19T10:00:00+00:00</updated>
		<media:group>
			<media:title>Not this</media:title>
			<media:thumbnail url="https://i1.ytimg.com/vi/abc/hqdefault.jpg" width="480" height="360"/>
		</media:group>
	</entry>
</feed>`;

describe('parseFeed', () => {
	it("names a channel's uploads without Shorts after the channel", () => {
		const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
			<link rel="self" href="http://www.youtube.com/feeds/videos.xml?playlist_id=UULF1"/>
			<yt:playlistId>UULF1</yt:playlistId>
			<title>Videos</title>
			<author><name>Hannah Fry</name><uri>https://www.youtube.com/channel/UC1</uri></author>
		</feed>`;
		const feed = parseFeed(xml, 'https://www.youtube.com/feeds/videos.xml?playlist_id=UULF1');
		expect(feed.title).toBe('Hannah Fry');
		expect(feed.siteUrl).toBe('https://www.youtube.com/channel/UC1');
	});

	it('reads RSS', () => {
		const feed = parseFeed(RSS, 'https://blog.example/feed.xml');
		expect(feed.title).toBe('A & B Blog');
		expect(feed.siteUrl).toBe('https://blog.example/');
		expect(feed.items).toEqual([
			{
				guid: 'post-1',
				url: 'https://blog.example/first',
				title: 'First',
				publishedAt: '2026-10-19T08:00:00.000Z',
				image: 'https://blog.example/img/a.jpg?w=1&h=2'
			},
			{
				guid: 'https://blog.example/second',
				url: 'https://blog.example/second',
				title: 'Relative ’link’',
				publishedAt: null,
				image: null
			}
		]);
	});

	it('reads Atom, taking the alternate link and the entry’s own title', () => {
		const feed = parseFeed(ATOM, 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1');
		expect(feed.title).toBe('A Channel');
		expect(feed.siteUrl).toBe('https://www.youtube.com/channel/UC1');
		expect(feed.items).toEqual([
			{
				guid: 'yt:video:abc',
				url: 'https://www.youtube.com/watch?v=abc',
				title: 'A video',
				publishedAt: '2026-10-18T10:00:00.000Z',
				image: 'https://i1.ytimg.com/vi/abc/hqdefault.jpg'
			}
		]);
	});

	it('takes images from enclosures and CDATA, https only', () => {
		const rss = (inner: string) =>
			parseFeed(
				`<rss><channel><item><link>https://a.example/1</link>${inner}</item></channel></rss>`,
				'https://a.example/feed'
			).items[0].image;
		expect(rss('<enclosure url="https://a.example/p.png" type="image/png"/>')).toBe(
			'https://a.example/p.png'
		);
		expect(rss('<enclosure url="https://a.example/e.mp3" type="audio/mpeg"/>')).toBeNull();
		expect(
			rss(
				'<content:encoded><![CDATA[<p><img src="https://a.example/c.jpg"></p>]]></content:encoded>'
			)
		).toBe('https://a.example/c.jpg');
		expect(rss('<media:content url="http://a.example/m.jpg" medium="image"/>')).toBeNull();
	});

	it('refuses web pages', () => {
		expect(() => parseFeed('<!doctype html><html></html>', 'https://x.example')).toThrow(
			'Not an RSS or Atom feed'
		);
	});
});

describe('findFeedLink', () => {
	it('finds the alternate feed, resolving relative links', () => {
		const html = `<head><link rel="stylesheet" href="/a.css">
			<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml"></head>`;
		expect(findFeedLink(html, 'https://blog.example/post')).toBe('https://blog.example/feed.xml');
	});
	it('returns null when there is none', () => {
		expect(findFeedLink('<html></html>', 'https://blog.example')).toBeNull();
	});
});

describe('pageInfo', () => {
	const url = 'https://site.example/post';
	it('prefers og:title, and takes og:image', () => {
		expect(
			pageInfo(
				`<title>Site | Thing</title><meta property="og:title" content="Thing &amp; more">
				<meta property="og:image" content="/cover.jpg">`,
				url
			)
		).toEqual({ title: 'Thing & more', image: 'https://site.example/cover.jpg' });
	});
	it('falls back to <title>', () => {
		expect(pageInfo('<title>\n  Hello  world\n</title>', url)).toEqual({
			title: 'Hello world',
			image: null
		});
		expect(pageInfo('<p>none</p>', url)).toEqual({ title: null, image: null });
	});
});

describe('text', () => {
	it('decodes entities and drops tags', () => {
		expect(text('a &lt;b&gt; <i>c</i> &#169; &unknown;')).toBe('a <b> c © &unknown;');
	});
});
