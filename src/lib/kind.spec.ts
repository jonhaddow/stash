import { describe, expect, it } from 'vitest';
import { hackUrl, hostOf, kindOf, youtubeId } from './kind.ts';

describe('kindOf', () => {
	it('knows video sites, with or without www', () => {
		expect(kindOf('https://www.youtube.com/watch?v=abc')).toBe('video');
		expect(kindOf('https://youtu.be/abc')).toBe('video');
		expect(kindOf('https://m.youtube.com/watch?v=abc')).toBe('video');
		expect(kindOf('https://player.vimeo.com/video/1')).toBe('video');
	});
	it('takes [video] in the title to mean a video', () => {
		expect(kindOf('https://news.ycombinator.com/item?id=1', 'A talk [video] | Hacker News')).toBe(
			'video'
		);
		expect(kindOf('https://example.com/a', 'A talk [Video]')).toBe('video');
		expect(kindOf('https://example.com/a', 'Video games')).toBe('article');
	});
	it('treats everything else as an article', () => {
		expect(kindOf('https://news.ycombinator.com/item?id=1')).toBe('article');
		expect(kindOf('https://notyoutube.com/x')).toBe('article');
		expect(kindOf('not a url')).toBe('article');
	});
});

describe('hostOf', () => {
	it('drops www', () => {
		expect(hostOf('https://www.theverge.com/a')).toBe('theverge.com');
	});
});

describe('youtubeId', () => {
	it('finds the video in each kind of link', () => {
		expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe('dQw4w9WgXcQ');
		expect(youtubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
		expect(youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(youtubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});
	it('is null for channels, other sites and nonsense', () => {
		expect(youtubeId('https://www.youtube.com/@bread')).toBeNull();
		expect(youtubeId('https://www.youtube.com/watch')).toBeNull();
		expect(youtubeId('https://vimeo.com/1234567')).toBeNull();
		expect(youtubeId('not a url')).toBeNull();
	});
});

describe('hackUrl', () => {
	it('turns a Hacker News thread into a Hack link', () => {
		expect(hackUrl('https://news.ycombinator.com/item?id=37620043')).toBe(
			'hack://item?id=37620043'
		);
	});
	it('is null for other Hacker News pages, other sites and nonsense', () => {
		expect(hackUrl('https://news.ycombinator.com/news')).toBeNull();
		expect(hackUrl('https://example.com/item?id=1')).toBeNull();
		expect(hackUrl('not a url')).toBeNull();
	});
});
