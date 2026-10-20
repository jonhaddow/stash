import { describe, expect, it } from 'vitest';
import { hostOf, kindOf } from './kind.ts';

describe('kindOf', () => {
	it('knows video sites, with or without www', () => {
		expect(kindOf('https://www.youtube.com/watch?v=abc')).toBe('video');
		expect(kindOf('https://youtu.be/abc')).toBe('video');
		expect(kindOf('https://m.youtube.com/watch?v=abc')).toBe('video');
		expect(kindOf('https://player.vimeo.com/video/1')).toBe('video');
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
